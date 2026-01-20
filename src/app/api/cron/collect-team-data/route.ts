import { NextResponse } from 'next/server'
import { ballDontLieApi } from '@/lib/api/balldontlie'
import { addDays } from 'date-fns'
import type { PrismaClient, SportType } from '@prisma/client'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/collect-team-data
 * 크론: 7일 이내 경기 팀 데이터 수집
 * BallDontLie API 사용 (Football, Basketball, Baseball 통합)
 *
 * 수집 항목:
 * - 팀 시즌 스탯 (순위표 기반)
 * - 최근 경기 데이터
 *
 * Query Parameters:
 * - sport: football|basketball|baseball (기본값: football)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { matchId: string; teamsUpdated: string[]; errors: string[] }[] = []
  let totalApiCalls = 0

  // sport 파라미터로 스포츠 타입 필터
  const sportType = getSportFromRequest(request)
  const sportTypeEnum = sportIdToEnum(sportType) as SportType

  try {
    const now = new Date()
    const in7Days = addDays(now, 7)

    // 7일 이내 예정된 경기의 팀 데이터 수집
    const upcomingMatches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: now,
          lte: in7Days,
        },
        status: { in: ['SCHEDULED', 'TIMED'] },
        sportType: sportTypeEnum,
      },
      include: {
        homeTeam: {
          include: { seasonStats: true, recentMatches: true },
        },
        awayTeam: {
          include: { seasonStats: true, recentMatches: true },
        },
        league: true,
      },
    })

    // 리그별로 순위표를 한 번만 가져오도록 캐싱
    const standingsCache: Record<string, unknown> = {}

    for (const match of upcomingMatches) {
      const matchResult = {
        matchId: match.id,
        teamsUpdated: [] as string[],
        errors: [] as string[],
      }

      try {
        // 리그 순위표 가져오기 (캐싱)
        if (!standingsCache[match.league.slug!]) {
          try {
            if (sportType === 'football') {
              standingsCache[match.league.slug!] = await ballDontLieApi.getSoccerStandings(match.league.slug!)
            } else if (sportType === 'basketball') {
              standingsCache[match.league.slug!] = await ballDontLieApi.getStandings()
            } else if (sportType === 'baseball') {
              standingsCache[match.league.slug!] = await ballDontLieApi.getBaseballStandings()
            }
            totalApiCalls++
            await delay(13000) // Rate limiting
          } catch (error) {
            console.error(`Failed to fetch standings for ${match.league.slug}:`, error)
            matchResult.errors.push(`Standings fetch failed: ${String(error)}`)
            continue
          }
        }

        // 홈팀 스탯 수집 (없는 경우)
        if (!match.homeTeam.seasonStats) {
          try {
            await collectTeamStats(
              prisma,
              match.homeTeam.id,
              match.homeTeam.externalId!,
              match.league.slug!,
              sportType,
              sportTypeEnum
            )
            matchResult.teamsUpdated.push(match.homeTeam.name)
            totalApiCalls++
            await delay(13000) // Rate limiting
          } catch (error) {
            matchResult.errors.push(`Home team stats (${match.homeTeam.name}): ${String(error)}`)
          }
        }

        // 원정팀 스탯 수집
        if (!match.awayTeam.seasonStats) {
          try {
            await collectTeamStats(
              prisma,
              match.awayTeam.id,
              match.awayTeam.externalId!,
              match.league.slug!,
              sportType,
              sportTypeEnum
            )
            matchResult.teamsUpdated.push(match.awayTeam.name)
            totalApiCalls++
            await delay(13000) // Rate limiting
          } catch (error) {
            matchResult.errors.push(`Away team stats (${match.awayTeam.name}): ${String(error)}`)
          }
        }
      } catch (error) {
        matchResult.errors.push(`Match processing: ${String(error)}`)
      }

      results.push(matchResult)
    }

    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: `collect-team-data-${sportType}`,
        result: results.every((r) => r.errors.length === 0) ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: totalApiCalls,
      },
    })

    return NextResponse.json({
      success: true,
      sportType,
      duration,
      apiCalls: totalApiCalls,
      matchesProcessed: results.length,
      results,
    })
  } catch (error) {
    console.error(`Cron collect-team-data-${sportType} error:`, error)

    await prisma.schedulerLog.create({
      data: {
        jobName: `collect-team-data-${sportType}`,
        result: 'failed',
        details: { error: String(error) },
        duration: Date.now() - startTime,
      },
    })

    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// 팀 시즌 스탯 수집 (BallDontLie API 기반)
async function collectTeamStats(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string,
  leagueSlug: string,
  sportType: 'football' | 'basketball' | 'baseball',
  sportTypeEnum: SportType
) {
  try {
    let standings: unknown
    let teamStats: {
      rank?: number
      points?: number
      gamesPlayed: number
      wins: number
      draws?: number
      losses: number
      goalsFor?: number
      goalsAgainst?: number
      goalDifference?: number
      form?: string
    } | null = null

    if (sportType === 'football') {
      standings = await ballDontLieApi.getSoccerStandings(leagueSlug)
      const standingsData = standings as { data: Array<{
        team: { id: number; name: string }
        rank: number
        points: number
        games_played: number
        wins: number
        draws: number
        losses: number
        goals_for: number
        goals_against: number
        goal_difference: number
      }> }

      const teamEntry = standingsData.data.find(t => String(t.team.id) === externalTeamId)
      if (teamEntry) {
        teamStats = {
          rank: teamEntry.rank,
          points: teamEntry.points,
          gamesPlayed: teamEntry.games_played,
          wins: teamEntry.wins,
          draws: teamEntry.draws,
          losses: teamEntry.losses,
          goalsFor: teamEntry.goals_for,
          goalsAgainst: teamEntry.goals_against,
          goalDifference: teamEntry.goal_difference,
        }
      }
    } else if (sportType === 'basketball') {
      // NBA standings
      standings = await ballDontLieApi.getStandings()
      const standingsData = standings as { data: Array<{
        team: { id: number; name: string }
        conference: string
        conference_rank: number
        wins: number
        losses: number
        win_pct: string
        games_back: string
      }> }

      const teamEntry = standingsData.data.find(t => String(t.team.id) === externalTeamId)
      if (teamEntry) {
        teamStats = {
          rank: teamEntry.conference_rank,
          gamesPlayed: teamEntry.wins + teamEntry.losses,
          wins: teamEntry.wins,
          losses: teamEntry.losses,
        }
      }
    } else if (sportType === 'baseball') {
      // MLB standings
      standings = await ballDontLieApi.getBaseballStandings()
      const standingsData = standings as { data: Array<{
        team: { id: number; name: string }
        division: string
        division_rank: number
        wins: number
        losses: number
        win_pct: string
        games_back: string
      }> }

      const teamEntry = standingsData.data.find(t => String(t.team.id) === externalTeamId)
      if (teamEntry) {
        teamStats = {
          rank: teamEntry.division_rank,
          gamesPlayed: teamEntry.wins + teamEntry.losses,
          wins: teamEntry.wins,
          losses: teamEntry.losses,
        }
      }
    }

    if (!teamStats) {
      console.warn(`Team stats not found for ${externalTeamId} in ${leagueSlug}`)
      return
    }

    const currentYear = new Date().getFullYear()
    const season = new Date().getMonth() < 7 ? currentYear - 1 : currentYear

    await prisma.teamSeasonStats.upsert({
      where: { teamId },
      create: {
        teamId,
        sportType: sportTypeEnum,
        season,
        gamesPlayed: teamStats.gamesPlayed,
        wins: teamStats.wins,
        draws: teamStats.draws ?? null,
        losses: teamStats.losses,
        rank: teamStats.rank ?? null,
        points: teamStats.points ?? null,
        goalsFor: teamStats.goalsFor ?? null,
        goalsAgainst: teamStats.goalsAgainst ?? null,
        goalDifference: teamStats.goalDifference ?? null,
        form: teamStats.form ?? null,
      },
      update: {
        gamesPlayed: teamStats.gamesPlayed,
        wins: teamStats.wins,
        draws: teamStats.draws ?? null,
        losses: teamStats.losses,
        rank: teamStats.rank ?? null,
        points: teamStats.points ?? null,
        goalsFor: teamStats.goalsFor ?? null,
        goalsAgainst: teamStats.goalsAgainst ?? null,
        goalDifference: teamStats.goalDifference ?? null,
        form: teamStats.form ?? null,
      },
    })
  } catch (error) {
    console.error(`Failed to collect team stats for ${teamId}:`, error)
    throw error
  }
}

// Rate limiting helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

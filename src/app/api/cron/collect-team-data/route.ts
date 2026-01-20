import { NextResponse } from 'next/server'
import { ballDontLieApi } from '@/lib/api/balldontlie'
import { footballDataApi, FREE_COMPETITIONS, type StandingTableEntry } from '@/lib/api/football-data'
import { addDays } from 'date-fns'
import type { PrismaClient, SportType } from '@prisma/client'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// 리그 DB code를 Football-Data.org 코드로 변환
const LEAGUE_CODE_TO_FD_CODE: Record<string, string> = {
  'PL': FREE_COMPETITIONS.PREMIER_LEAGUE,
  'PD': FREE_COMPETITIONS.LA_LIGA,
  'SA': FREE_COMPETITIONS.SERIE_A,
  'BL1': FREE_COMPETITIONS.BUNDESLIGA,
  'FL1': FREE_COMPETITIONS.LIGUE_1,
}

/**
 * GET /api/cron/collect-team-data
 * 크론: 7일 이내 경기 팀 데이터 수집
 * - Football: Football-Data.org API 사용
 * - Basketball/Baseball: BallDontLie API 사용
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
    const standingsCache: Record<string, StandingTableEntry[] | unknown> = {}

    for (const match of upcomingMatches) {
      const matchResult = {
        matchId: match.id,
        teamsUpdated: [] as string[],
        errors: [] as string[],
      }

      try {
        const leagueCode = match.league.code || ''

        // 리그 순위표 가져오기 (캐싱)
        if (!standingsCache[leagueCode]) {
          try {
            if (sportType === 'football') {
              const fdCode = LEAGUE_CODE_TO_FD_CODE[leagueCode]
              if (fdCode) {
                const response = await footballDataApi.getStandings(fdCode)
                // TOTAL 타입의 순위표만 사용
                const totalStanding = response.standings.find(s => s.type === 'TOTAL')
                standingsCache[leagueCode] = totalStanding?.table || []
              } else {
                console.warn(`Unknown league code: ${leagueCode}`)
                continue
              }
            } else if (sportType === 'basketball') {
              standingsCache[leagueCode] = await ballDontLieApi.getStandings()
            } else if (sportType === 'baseball') {
              standingsCache[leagueCode] = await ballDontLieApi.getBaseballStandings()
            }
            totalApiCalls++
          } catch (error) {
            console.error(`Failed to fetch standings for ${leagueCode}:`, error)
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
              leagueCode,
              sportType,
              sportTypeEnum,
              standingsCache[leagueCode]
            )
            matchResult.teamsUpdated.push(match.homeTeam.name)
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
              leagueCode,
              sportType,
              sportTypeEnum,
              standingsCache[leagueCode]
            )
            matchResult.teamsUpdated.push(match.awayTeam.name)
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

// 팀 시즌 스탯 수집
async function collectTeamStats(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string,
  leagueSlug: string,
  sportType: 'football' | 'basketball' | 'baseball',
  sportTypeEnum: SportType,
  cachedStandings: StandingTableEntry[] | unknown
) {
  try {
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
      // Football-Data.org 순위표에서 팀 찾기
      const standings = cachedStandings as StandingTableEntry[]
      const teamEntry = standings.find(t => String(t.team.id) === externalTeamId)

      if (teamEntry) {
        teamStats = {
          rank: teamEntry.position,
          points: teamEntry.points,
          gamesPlayed: teamEntry.playedGames,
          wins: teamEntry.won,
          draws: teamEntry.draw,
          losses: teamEntry.lost,
          goalsFor: teamEntry.goalsFor,
          goalsAgainst: teamEntry.goalsAgainst,
          goalDifference: teamEntry.goalDifference,
          form: teamEntry.form || undefined,
        }
      }
    } else if (sportType === 'basketball') {
      // BallDontLie NBA standings
      const standingsData = cachedStandings as { data: Array<{
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
      // BallDontLie MLB standings
      const standingsData = cachedStandings as { data: Array<{
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

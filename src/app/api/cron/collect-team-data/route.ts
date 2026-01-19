import { NextResponse } from 'next/server'
import {
  footballDataApi,
  type Match as FDMatch,
  type Person,
  getMatchResult,
} from '@/lib/api/football-data'
import { addDays } from 'date-fns'
import type { PrismaClient } from '@prisma/client'

// Vercel Function 설정 - App Router에서는 이렇게 설정
export const maxDuration = 300 // 5분
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/collect-team-data
 * 크론: 7일 이내 경기 팀 데이터 수집
 * Football-Data.org API 사용
 *
 * 수집 항목:
 * - 리그 순위표에서 팀 시즌 스탯
 * - 팀 최근 15경기 목록
 * - 선수단 (스쿼드)
 * - 상대전적 (H2H)
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
        sportType: 'FOOTBALL',
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
    const standingsCache: Record<string, Awaited<ReturnType<typeof footballDataApi.getStandings>>> = {}

    for (const match of upcomingMatches) {
      const matchResult = {
        matchId: match.id,
        teamsUpdated: [] as string[],
        errors: [] as string[],
      }

      try {
        // 리그 순위표 가져오기 (캐싱)
        if (!standingsCache[match.league.code!]) {
          standingsCache[match.league.code!] = await footballDataApi.getStandings(match.league.code!)
          totalApiCalls++
        }
        const standings = standingsCache[match.league.code!]

        // 홈팀 스탯 수집 (없거나 오래된 경우)
        if (!match.homeTeam.seasonStats) {
          try {
            await collectTeamStatsFromStandings(
              prisma,
              match.homeTeam.id,
              match.homeTeam.externalId!,
              standings
            )
            matchResult.teamsUpdated.push(match.homeTeam.name)
          } catch (error) {
            matchResult.errors.push(`Home team stats (${match.homeTeam.name}): ${String(error)}`)
          }
        }

        // 원정팀 스탯 수집
        if (!match.awayTeam.seasonStats) {
          try {
            await collectTeamStatsFromStandings(
              prisma,
              match.awayTeam.id,
              match.awayTeam.externalId!,
              standings
            )
            matchResult.teamsUpdated.push(match.awayTeam.name)
          } catch (error) {
            matchResult.errors.push(`Away team stats (${match.awayTeam.name}): ${String(error)}`)
          }
        }

        // 홈팀 최근 경기 수집
        if (!match.homeTeam.recentMatches) {
          try {
            await collectTeamRecentMatches(
              prisma,
              match.homeTeam.id,
              match.homeTeam.externalId!
            )
            totalApiCalls++
            if (!matchResult.teamsUpdated.includes(match.homeTeam.name)) {
              matchResult.teamsUpdated.push(match.homeTeam.name)
            }
          } catch (error) {
            matchResult.errors.push(`Home team recent (${match.homeTeam.name}): ${String(error)}`)
          }
        }

        // 원정팀 최근 경기 수집
        if (!match.awayTeam.recentMatches) {
          try {
            await collectTeamRecentMatches(
              prisma,
              match.awayTeam.id,
              match.awayTeam.externalId!
            )
            totalApiCalls++
            if (!matchResult.teamsUpdated.includes(match.awayTeam.name)) {
              matchResult.teamsUpdated.push(match.awayTeam.name)
            }
          } catch (error) {
            matchResult.errors.push(`Away team recent (${match.awayTeam.name}): ${String(error)}`)
          }
        }

        // 홈팀 스쿼드 수집 (선수가 없는 경우)
        const homePlayerCount = await prisma.player.count({ where: { teamId: match.homeTeam.id } })
        if (homePlayerCount === 0) {
          try {
            await collectTeamSquad(
              prisma,
              match.homeTeam.id,
              match.homeTeam.externalId!
            )
            totalApiCalls++
          } catch (error) {
            matchResult.errors.push(`Home team squad (${match.homeTeam.name}): ${String(error)}`)
          }
        }

        // 원정팀 스쿼드 수집 (선수가 없는 경우)
        const awayPlayerCount = await prisma.player.count({ where: { teamId: match.awayTeam.id } })
        if (awayPlayerCount === 0) {
          try {
            await collectTeamSquad(
              prisma,
              match.awayTeam.id,
              match.awayTeam.externalId!
            )
            totalApiCalls++
          } catch (error) {
            matchResult.errors.push(`Away team squad (${match.awayTeam.name}): ${String(error)}`)
          }
        }

        // 상대전적 수집
        try {
          await collectHeadToHead(
            prisma,
            match.homeTeam.id,
            match.awayTeam.id,
            match.externalId!
          )
          totalApiCalls++
        } catch (error) {
          matchResult.errors.push(`H2H: ${String(error)}`)
        }
      } catch (error) {
        matchResult.errors.push(`Match processing: ${String(error)}`)
      }

      results.push(matchResult)
    }

    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-team-data',
        result: results.every((r) => r.errors.length === 0) ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: totalApiCalls,
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      apiCalls: totalApiCalls,
      matchesProcessed: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron collect-team-data error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-team-data',
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

// 순위표에서 팀 시즌 스탯 수집
async function collectTeamStatsFromStandings(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string,
  standingsResponse: Awaited<ReturnType<typeof footballDataApi.getStandings>>
) {
  // TOTAL 타입 순위표 찾기
  const totalStandings = standingsResponse.standings.find(s => s.type === 'TOTAL')
  const homeStandings = standingsResponse.standings.find(s => s.type === 'HOME')
  const awayStandings = standingsResponse.standings.find(s => s.type === 'AWAY')

  if (!totalStandings) return

  // 팀 찾기
  const teamEntry = totalStandings.table.find(t => String(t.team.id) === externalTeamId)
  if (!teamEntry) return

  const homeEntry = homeStandings?.table.find(t => String(t.team.id) === externalTeamId)
  const awayEntry = awayStandings?.table.find(t => String(t.team.id) === externalTeamId)

  const currentYear = new Date().getFullYear()
  const season = new Date().getMonth() < 7 ? currentYear - 1 : currentYear

  await prisma.teamSeasonStats.upsert({
    where: { teamId },
    create: {
      teamId,
      sportType: 'FOOTBALL',
      season,
      gamesPlayed: teamEntry.playedGames,
      wins: teamEntry.won,
      draws: teamEntry.draw,
      losses: teamEntry.lost,
      rank: teamEntry.position,
      points: teamEntry.points,
      goalsFor: teamEntry.goalsFor,
      goalsAgainst: teamEntry.goalsAgainst,
      goalDifference: teamEntry.goalDifference,
      form: teamEntry.form,
      // 홈 스탯
      homeGames: homeEntry?.playedGames ?? 0,
      homeWins: homeEntry?.won ?? 0,
      homeDraws: homeEntry?.draw,
      homeLosses: homeEntry?.lost,
      homeGoalsFor: homeEntry?.goalsFor,
      homeGoalsAgainst: homeEntry?.goalsAgainst,
      homeAvgFor: homeEntry ? homeEntry.goalsFor / homeEntry.playedGames : null,
      homeAvgAgainst: homeEntry ? homeEntry.goalsAgainst / homeEntry.playedGames : null,
      // 원정 스탯
      awayGames: awayEntry?.playedGames ?? 0,
      awayWins: awayEntry?.won ?? 0,
      awayDraws: awayEntry?.draw,
      awayLosses: awayEntry?.lost,
      awayGoalsFor: awayEntry?.goalsFor,
      awayGoalsAgainst: awayEntry?.goalsAgainst,
      awayAvgFor: awayEntry ? awayEntry.goalsFor / awayEntry.playedGames : null,
      awayAvgAgainst: awayEntry ? awayEntry.goalsAgainst / awayEntry.playedGames : null,
    },
    update: {
      gamesPlayed: teamEntry.playedGames,
      wins: teamEntry.won,
      draws: teamEntry.draw,
      losses: teamEntry.lost,
      rank: teamEntry.position,
      points: teamEntry.points,
      goalsFor: teamEntry.goalsFor,
      goalsAgainst: teamEntry.goalsAgainst,
      goalDifference: teamEntry.goalDifference,
      form: teamEntry.form,
      homeGames: homeEntry?.playedGames ?? 0,
      homeWins: homeEntry?.won ?? 0,
      homeDraws: homeEntry?.draw,
      homeLosses: homeEntry?.lost,
      homeGoalsFor: homeEntry?.goalsFor,
      homeGoalsAgainst: homeEntry?.goalsAgainst,
      homeAvgFor: homeEntry ? homeEntry.goalsFor / homeEntry.playedGames : null,
      homeAvgAgainst: homeEntry ? homeEntry.goalsAgainst / homeEntry.playedGames : null,
      awayGames: awayEntry?.playedGames ?? 0,
      awayWins: awayEntry?.won ?? 0,
      awayDraws: awayEntry?.draw,
      awayLosses: awayEntry?.lost,
      awayGoalsFor: awayEntry?.goalsFor,
      awayGoalsAgainst: awayEntry?.goalsAgainst,
      awayAvgFor: awayEntry ? awayEntry.goalsFor / awayEntry.playedGames : null,
      awayAvgAgainst: awayEntry ? awayEntry.goalsAgainst / awayEntry.playedGames : null,
    },
  })
}

// 팀 최근 경기 수집
async function collectTeamRecentMatches(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string
) {
  const teamMatchesResponse = await footballDataApi.getTeamMatches(parseInt(externalTeamId), {
    status: 'FINISHED',
    limit: 15,
  })

  const matches = teamMatchesResponse.matches

  if (matches.length > 0) {
    const matchesJson = matches.map((m: FDMatch) => ({
      date: m.utcDate,
      opponent: m.homeTeam.id === parseInt(externalTeamId) ? m.awayTeam.name : m.homeTeam.name,
      opponentCrest: m.homeTeam.id === parseInt(externalTeamId) ? m.awayTeam.crest : m.homeTeam.crest,
      isHome: m.homeTeam.id === parseInt(externalTeamId),
      result: getMatchResult(m, parseInt(externalTeamId)),
      score: `${m.score.fullTime.home ?? 0}-${m.score.fullTime.away ?? 0}`,
      competition: m.competition.name,
    }))

    // 최근 5경기 폼 계산
    const recentForm = matchesJson
      .slice(0, 5)
      .map((m: { result: string | null }) => m.result)
      .filter(Boolean)
      .join('')

    await prisma.teamRecentMatches.upsert({
      where: { teamId },
      create: {
        teamId,
        sportType: 'FOOTBALL',
        matchesJson,
        recentForm,
      },
      update: {
        matchesJson,
        recentForm,
      },
    })
  }
}

// 상대전적 수집
async function collectHeadToHead(
  prisma: PrismaClient,
  teamAId: string,
  teamBId: string,
  matchExternalId: string
) {
  const h2hResponse = await footballDataApi.getHeadToHead(parseInt(matchExternalId), 10)

  if (h2hResponse.matches.length > 0) {
    const matchesJson = h2hResponse.matches.map((m: FDMatch) => ({
      date: m.utcDate,
      homeTeam: m.homeTeam.name,
      homeTeamCrest: m.homeTeam.crest,
      awayTeam: m.awayTeam.name,
      awayTeamCrest: m.awayTeam.crest,
      score: `${m.score.fullTime.home ?? 0}-${m.score.fullTime.away ?? 0}`,
      winner: m.score.winner === 'HOME_TEAM' ? m.homeTeam.name :
              m.score.winner === 'AWAY_TEAM' ? m.awayTeam.name : 'Draw',
      competition: m.competition.name,
    }))

    // 집계 정보도 저장
    const aggregates = h2hResponse.aggregates

    await prisma.headToHead.upsert({
      where: {
        teamAId_teamBId: { teamAId, teamBId },
      },
      create: {
        teamAId,
        teamBId,
        sportType: 'FOOTBALL',
        matchesJson: {
          matches: matchesJson,
          aggregates: {
            numberOfMatches: aggregates.numberOfMatches,
            totalGoals: aggregates.totalGoals,
            homeTeam: aggregates.homeTeam,
            awayTeam: aggregates.awayTeam,
          },
        },
      },
      update: {
        matchesJson: {
          matches: matchesJson,
          aggregates: {
            numberOfMatches: aggregates.numberOfMatches,
            totalGoals: aggregates.totalGoals,
            homeTeam: aggregates.homeTeam,
            awayTeam: aggregates.awayTeam,
          },
        },
      },
    })
  }
}

// 팀 스쿼드(선수 명단) 수집
async function collectTeamSquad(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string
) {
  const teamResponse = await footballDataApi.getTeam(parseInt(externalTeamId))

  if (!teamResponse.squad || teamResponse.squad.length === 0) {
    return
  }

  // 기존 선수 삭제 후 새로 삽입 (upsert 대신 효율적)
  await prisma.player.deleteMany({ where: { teamId } })

  const players = teamResponse.squad.map((person: Person) => ({
    teamId,
    name: person.name,
    firstName: person.firstName || null,
    lastName: person.lastName || null,
    position: person.position || null,
    nationality: person.nationality || null,
    birthDate: person.dateOfBirth ? new Date(person.dateOfBirth) : null,
    shirtNumber: person.shirtNumber || null,
    marketValue: person.marketValue || null,
    contractStart: person.contract?.start ? new Date(person.contract.start) : null,
    contractEnd: person.contract?.until ? new Date(person.contract.until) : null,
    externalId: String(person.id),
  }))

  await prisma.player.createMany({
    data: players,
    skipDuplicates: true,
  })
}

import { NextResponse } from 'next/server'
import { footballApi, getCurrentFootballSeason } from '@/lib/api/sports-api'
import { addHours } from 'date-fns'
import type { PrismaClient } from '@prisma/client'

const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/collect-team-stats
 * 크론: 경기 48시간 전 팀 스탯 수집
 * 실행: 매일 여러 번 (필요한 경기만)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { matchId: string; teamsUpdated: string[]; errors: string[] }[] = []

  try {
    const now = new Date()
    const in48Hours = addHours(now, 48)

    // 48시간 이내 경기 중 아직 팀 스탯이 없는 것들 조회
    const upcomingMatches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: now,
          lte: in48Hours,
        },
        status: 'SCHEDULED',
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

    const season = getCurrentFootballSeason()

    for (const match of upcomingMatches) {
      const matchResult = {
        matchId: match.id,
        teamsUpdated: [] as string[],
        errors: [] as string[],
      }

      // 홈팀 스탯 수집 (없거나 오래된 경우)
      if (!match.homeTeam.seasonStats || !match.homeTeam.recentMatches) {
        try {
          await collectTeamStats(
            prisma,
            match.homeTeam.id,
            match.homeTeam.externalId!,
            match.league.externalId!,
            season
          )
          matchResult.teamsUpdated.push(match.homeTeam.name)
        } catch (error) {
          matchResult.errors.push(`Home team (${match.homeTeam.name}): ${String(error)}`)
        }
      }

      // 원정팀 스탯 수집
      if (!match.awayTeam.seasonStats || !match.awayTeam.recentMatches) {
        try {
          await collectTeamStats(
            prisma,
            match.awayTeam.id,
            match.awayTeam.externalId!,
            match.league.externalId!,
            season
          )
          matchResult.teamsUpdated.push(match.awayTeam.name)
        } catch (error) {
          matchResult.errors.push(`Away team (${match.awayTeam.name}): ${String(error)}`)
        }
      }

      // 상대전적 수집
      try {
        await collectHeadToHead(
          prisma,
          match.homeTeam.id,
          match.awayTeam.id,
          match.homeTeam.externalId!,
          match.awayTeam.externalId!
        )
      } catch (error) {
        matchResult.errors.push(`H2H: ${String(error)}`)
      }

      results.push(matchResult)
    }

    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-team-stats',
        result: results.every((r) => r.errors.length === 0) ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: results.reduce((sum, r) => sum + r.teamsUpdated.length, 0),
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      matchesProcessed: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron collect-team-stats error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-team-stats',
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

async function collectTeamStats(
  prisma: PrismaClient,
  teamId: string,
  externalTeamId: string,
  externalLeagueId: string,
  season: number
) {
  // 1. 팀 시즌 통계 수집
  const stats = await footballApi.getTeamStatistics(
    parseInt(externalTeamId),
    parseInt(externalLeagueId),
    season
  )

  if (stats.length > 0) {
    const teamStats = stats[0]

    await prisma.teamSeasonStats.upsert({
      where: { teamId },
      create: {
        teamId,
        sportType: 'FOOTBALL',
        season,
        gamesPlayed: teamStats.fixtures.played.total,
        wins: teamStats.fixtures.wins.total,
        draws: teamStats.fixtures.draws.total,
        losses: teamStats.fixtures.loses.total,
        goalsFor: teamStats.goals.for.total.total,
        goalsAgainst: teamStats.goals.against.total.total,
        homeGames: teamStats.fixtures.played.home,
        homeWins: teamStats.fixtures.wins.home,
        homeAvgFor: parseFloat(teamStats.goals.for.average.home),
        homeAvgAgainst: parseFloat(teamStats.goals.against.average.home),
        awayGames: teamStats.fixtures.played.away,
        awayWins: teamStats.fixtures.wins.away,
        awayAvgFor: parseFloat(teamStats.goals.for.average.away),
        awayAvgAgainst: parseFloat(teamStats.goals.against.average.away),
      },
      update: {
        gamesPlayed: teamStats.fixtures.played.total,
        wins: teamStats.fixtures.wins.total,
        draws: teamStats.fixtures.draws.total,
        losses: teamStats.fixtures.loses.total,
        goalsFor: teamStats.goals.for.total.total,
        goalsAgainst: teamStats.goals.against.total.total,
        homeGames: teamStats.fixtures.played.home,
        homeWins: teamStats.fixtures.wins.home,
        homeAvgFor: parseFloat(teamStats.goals.for.average.home),
        homeAvgAgainst: parseFloat(teamStats.goals.against.average.home),
        awayGames: teamStats.fixtures.played.away,
        awayWins: teamStats.fixtures.wins.away,
        awayAvgFor: parseFloat(teamStats.goals.for.average.away),
        awayAvgAgainst: parseFloat(teamStats.goals.against.average.away),
      },
    })
  }

  // 2. 최근 경기 목록 수집 (10~15경기)
  const recentFixtures = await footballApi.getTeamLastFixtures(
    parseInt(externalTeamId),
    15
  )

  if (recentFixtures.length > 0) {
    const matchesJson = recentFixtures.map((f) => ({
      date: f.fixture.date,
      opponent:
        f.teams.home.id === parseInt(externalTeamId)
          ? f.teams.away.name
          : f.teams.home.name,
      isHome: f.teams.home.id === parseInt(externalTeamId),
      result: getMatchResult(f, parseInt(externalTeamId)),
      score: `${f.goals.home ?? 0}-${f.goals.away ?? 0}`,
    }))

    // 최근 5경기 폼 계산
    const recentForm = matchesJson
      .slice(0, 5)
      .map((m) => m.result)
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

async function collectHeadToHead(
  prisma: PrismaClient,
  teamAId: string,
  teamBId: string,
  externalTeamAId: string,
  externalTeamBId: string
) {
  const h2hFixtures = await footballApi.getHeadToHead(
    parseInt(externalTeamAId),
    parseInt(externalTeamBId),
    5
  )

  if (h2hFixtures.length > 0) {
    const matchesJson = h2hFixtures.map((f) => ({
      date: f.fixture.date,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      score: `${f.goals.home ?? 0}-${f.goals.away ?? 0}`,
      winner:
        f.goals.home! > f.goals.away!
          ? f.teams.home.name
          : f.goals.away! > f.goals.home!
          ? f.teams.away.name
          : 'Draw',
    }))

    await prisma.headToHead.upsert({
      where: {
        teamAId_teamBId: { teamAId, teamBId },
      },
      create: {
        teamAId,
        teamBId,
        sportType: 'FOOTBALL',
        matchesJson,
      },
      update: {
        matchesJson,
      },
    })
  }
}

function getMatchResult(
  fixture: { teams: { home: { id: number } }; goals: { home: number | null; away: number | null } },
  teamId: number
): 'W' | 'D' | 'L' {
  const isHome = fixture.teams.home.id === teamId
  const homeGoals = fixture.goals.home ?? 0
  const awayGoals = fixture.goals.away ?? 0

  if (homeGoals === awayGoals) return 'D'
  if (isHome) return homeGoals > awayGoals ? 'W' : 'L'
  return awayGoals > homeGoals ? 'W' : 'L'
}

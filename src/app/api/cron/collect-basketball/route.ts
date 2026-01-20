import { NextResponse } from 'next/server'
import { format, addDays, subDays } from 'date-fns'
import slugify from 'slugify'
import type { PrismaClient, MatchStatus } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import {
  ballDontLieApi,
  calculateStandings,
  type BDLGame,
  type BDLTeam,
} from '@/lib/api/balldontlie'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// NBA 리그 정보
const NBA_LEAGUE = {
  name: 'NBA',
  country: 'USA',
  slug: 'nba',
  code: 'NBA',
  logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
}

/**
 * GET /api/cron/collect-basketball
 * 크론: NBA 경기 데이터 수집
 *
 * BallDontLie Free Tier 제한:
 * - 분당 5회 요청
 * - 요청 사이 13초 딜레이 적용됨
 *
 * 수집 범위:
 * - 어제~7일 후 경기
 * - 팀 정보 (최초 1회)
 */
export async function GET(request: Request) {
  // 인증 체크
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results = {
    sport: 'basketball' as const,
    teamsAdded: 0,
    teamsUpdated: 0,
    matchesAdded: 0,
    matchesUpdated: 0,
    standingsUpdated: 0,
    errors: [] as string[],
  }
  let totalApiCalls = 0

  try {
    // 1. NBA 리그 확인/생성
    let nbaLeague = await prisma.league.findFirst({
      where: { code: NBA_LEAGUE.code, sportType: 'BASKETBALL' },
    })

    if (!nbaLeague) {
      nbaLeague = await prisma.league.create({
        data: {
          name: NBA_LEAGUE.name,
          country: NBA_LEAGUE.country,
          sportType: 'BASKETBALL',
          code: NBA_LEAGUE.code,
          logoUrl: NBA_LEAGUE.logoUrl,
          isActive: true,
        },
      })
      console.log('[Basketball Cron] Created NBA league')
    } else if (!nbaLeague.logoUrl) {
      // 기존 리그에 로고 URL 업데이트
      nbaLeague = await prisma.league.update({
        where: { id: nbaLeague.id },
        data: { logoUrl: NBA_LEAGUE.logoUrl },
      })
    }

    // 2. NBA 팀 정보 수집 (팀이 없거나 30개 미만이면 수집)
    const existingTeamCount = await prisma.team.count({
      where: { sportType: 'BASKETBALL', leagueId: nbaLeague.id },
    })

    if (existingTeamCount < 30) {
      console.log('[Basketball Cron] Fetching NBA teams...')
      const teams = await ballDontLieApi.getTeams()
      totalApiCalls++

      for (const team of teams) {
        try {
          const existingTeam = await prisma.team.findFirst({
            where: { externalId: String(team.id), sportType: 'BASKETBALL' },
          })

          const logoUrl = getNBATeamLogoUrl(team.abbreviation)

          if (existingTeam) {
            await prisma.team.update({
              where: { id: existingTeam.id },
              data: {
                name: team.full_name,
                shortName: team.name,
                tla: team.abbreviation,
                logoUrl,
              },
            })
            results.teamsUpdated++
          } else {
            await prisma.team.create({
              data: {
                leagueId: nbaLeague.id,
                name: team.full_name,
                shortName: team.name,
                tla: team.abbreviation,
                logoUrl,
                externalId: String(team.id),
                sportType: 'BASKETBALL',
              },
            })
            results.teamsAdded++
          }
        } catch (error) {
          results.errors.push(`Team ${team.id}: ${String(error)}`)
        }
      }
    }

    // 3. 경기 데이터 수집 (어제 ~ 7일 후)
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')

    console.log(`[Basketball Cron] Fetching games from ${yesterday} to ${nextWeek}...`)
    const games = await ballDontLieApi.getGamesByDateRange(yesterday, nextWeek)
    totalApiCalls++ // getGamesByDateRange 내부에서 페이지네이션 시 추가 호출 가능

    // 팀 매핑 캐시
    const teamCache = new Map<number, string>()
    const dbTeams = await prisma.team.findMany({
      where: { sportType: 'BASKETBALL', leagueId: nbaLeague.id },
      select: { id: true, externalId: true },
    })
    dbTeams.forEach((t) => {
      if (t.externalId) teamCache.set(Number(t.externalId), t.id)
    })

    // 기존 경기 조회 (N+1 방지: 한 번에 조회)
    const existingMatches = await prisma.match.findMany({
      where: {
        sportType: 'BASKETBALL',
        externalId: { in: games.map((g) => String(g.id)) },
      },
      select: { id: true, externalId: true, status: true },
    })
    const existingMatchMap = new Map(
      existingMatches.map((m) => [m.externalId, { id: m.id, status: m.status }])
    )

    for (const game of games) {
      try {
        const homeTeamDbId = teamCache.get(game.home_team.id)
        const awayTeamDbId = teamCache.get(game.visitor_team.id)

        if (!homeTeamDbId || !awayTeamDbId) {
          results.errors.push(`Game ${game.id}: Team not found in DB`)
          continue
        }

        const existingMatch = existingMatchMap.get(String(game.id))
        const matchStatus = mapBDLStatus(game.status)

        // 이미 종료된 경기는 스킵 (점수 변경 없음)
        if (existingMatch && existingMatch.status === 'FINISHED') {
          continue
        }

        const matchSlug = createMatchSlug(
          NBA_LEAGUE.slug,
          game.home_team.abbreviation,
          game.visitor_team.abbreviation,
          game.date
        )

        const kickoffAt = parseGameTime(game.date, game.status)

        if (existingMatch) {
          // 진행 중이거나 예정된 경기만 업데이트
          await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              kickoffAt,
              status: matchStatus,
              homeScore: game.home_team_score || null,
              awayScore: game.visitor_team_score || null,
            },
          })
          results.matchesUpdated++
        } else {
          await prisma.match.create({
            data: {
              leagueId: nbaLeague.id,
              homeTeamId: homeTeamDbId,
              awayTeamId: awayTeamDbId,
              sportType: 'BASKETBALL',
              kickoffAt,
              status: matchStatus,
              homeScore: game.home_team_score || null,
              awayScore: game.visitor_team_score || null,
              slug: matchSlug,
              externalId: String(game.id),
              round: game.postseason ? 'Playoffs' : 'Regular Season',
            },
          })
          results.matchesAdded++
        }
      } catch (error) {
        results.errors.push(`Game ${game.id}: ${String(error)}`)
      }
    }

    // 4. 순위 계산 및 저장 (시즌 전체 경기 기반)
    console.log('[Basketball Cron] Calculating standings from season games...')
    const currentSeason = ballDontLieApi.getCurrentNBASeason()

    // 시즌 시작일 (10월 1일)부터 현재까지 완료된 경기 조회
    const seasonStart = `${currentSeason}-10-01`
    const today = format(new Date(), 'yyyy-MM-dd')

    const seasonGames = await ballDontLieApi.getGamesByDateRange(seasonStart, today)
    totalApiCalls++

    const standings = calculateStandings(seasonGames)
    console.log(`[Basketball Cron] Calculated standings for ${standings.length} teams`)

    // 리그 시즌 업데이트
    await prisma.league.update({
      where: { id: nbaLeague.id },
      data: { season: currentSeason },
    })

    // DB 팀 정보 캐시 (N+1 쿼리 방지)
    const dbTeamsByExternalId = new Map<string, { id: string }>()
    dbTeams.forEach((t) => {
      if (t.externalId) dbTeamsByExternalId.set(t.externalId, { id: t.id })
    })

    // TeamSeasonStats 저장
    for (const standing of standings) {
      try {
        const team = dbTeamsByExternalId.get(String(standing.teamId))

        if (!team) {
          results.errors.push(`Standing: Team ${standing.teamId} not found`)
          continue
        }

        await prisma.teamSeasonStats.upsert({
          where: { teamId: team.id },
          create: {
            teamId: team.id,
            sportType: 'BASKETBALL',
            season: currentSeason,
            gamesPlayed: standing.gamesPlayed,
            wins: standing.wins,
            losses: standing.losses,
            rank: standing.rank,
            form: standing.form,
            homeGames: standing.homeWins + standing.homeLosses,
            homeWins: standing.homeWins,
            homeLosses: standing.homeLosses,
            awayGames: standing.awayWins + standing.awayLosses,
            awayWins: standing.awayWins,
            awayLosses: standing.awayLosses,
            additionalStats: {
              conference: standing.conference,
              division: standing.division,
            },
          },
          update: {
            season: currentSeason,
            gamesPlayed: standing.gamesPlayed,
            wins: standing.wins,
            losses: standing.losses,
            rank: standing.rank,
            form: standing.form,
            homeGames: standing.homeWins + standing.homeLosses,
            homeWins: standing.homeWins,
            homeLosses: standing.homeLosses,
            awayGames: standing.awayWins + standing.awayLosses,
            awayWins: standing.awayWins,
            awayLosses: standing.awayLosses,
            additionalStats: {
              conference: standing.conference,
              division: standing.division,
            },
          },
        })
        results.standingsUpdated++
      } catch (error) {
        results.errors.push(`Standing ${standing.teamId}: ${String(error)}`)
      }
    }

    // 5. 각 팀의 최근 경기 수집 및 저장 (최적화: 일괄 조회)
    console.log('[Basketball Cron] Collecting recent matches for all teams (batch)...')
    let recentMatchesUpdated = 0

    // 한 번의 API 호출로 모든 팀의 최근 경기 조회 (기존: 30회 → 최적화: 1-2회)
    const allTeamsRecentGames = await ballDontLieApi.getAllTeamsRecentGames(currentSeason, 30)
    totalApiCalls++ // 페이지네이션 포함해도 1-2회 정도

    for (const standing of standings) {
      try {
        const team = dbTeamsByExternalId.get(String(standing.teamId))
        if (!team) continue

        // 이미 조회된 데이터에서 해당 팀 경기 추출
        const recentGames = allTeamsRecentGames.get(standing.teamId) || []

        if (recentGames.length === 0) continue

        // RecentMatches 형식으로 변환
        const matchesJson = recentGames.map((game) => {
          const isHome = game.home_team.id === standing.teamId
          const teamScore = isHome ? game.home_team_score : game.visitor_team_score
          const opponentScore = isHome ? game.visitor_team_score : game.home_team_score
          const opponent = isHome ? game.visitor_team.full_name : game.home_team.full_name
          const result = teamScore > opponentScore ? 'W' : 'L'

          return {
            date: game.date,
            opponent,
            result,
            score: `${teamScore}-${opponentScore}`,
            isHome,
          }
        })

        // 최근 5경기 폼 계산 (WWLWL 형식)
        const recentForm = matchesJson
          .slice(0, 5)
          .map((m) => m.result)
          .join('')

        // DB에 저장
        await prisma.teamRecentMatches.upsert({
          where: { teamId: team.id },
          create: {
            teamId: team.id,
            sportType: 'BASKETBALL',
            matchesJson,
            recentForm,
          },
          update: {
            matchesJson,
            recentForm,
            updatedAt: new Date(),
          },
        })

        recentMatchesUpdated++
      } catch (error) {
        results.errors.push(`Recent matches ${standing.teamId}: ${String(error)}`)
      }
    }

    console.log(`[Basketball Cron] Updated recent matches for ${recentMatchesUpdated} teams`)

    // 캐시 무효화
    if (results.matchesAdded > 0 || results.matchesUpdated > 0 || results.standingsUpdated > 0 || recentMatchesUpdated > 0) {
      console.log('[Basketball Cron] Revalidating cache tags...')
      revalidateTag('matches')
      revalidateTag('match-detail')
    }

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-basketball',
        result: results.errors.length === 0 ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: totalApiCalls,
      },
    })

    // chain=true면 후속 작업 호출
    const url = new URL(request.url)
    const shouldChain = url.searchParams.get('chain') === 'true'
    const chainResults: { job: string; success: boolean; error?: string }[] = []

    if (shouldChain && CRON_SECRET) {
      const baseUrl = url.origin
      const cronJobs = [
        '/api/cron/generate-analysis?sport=basketball',
      ]

      for (const job of cronJobs) {
        try {
          const response = await fetch(`${baseUrl}${job}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${CRON_SECRET}`,
            },
          })
          const data = await response.json()
          chainResults.push({ job, success: data.success !== false })
        } catch (error) {
          chainResults.push({ job, success: false, error: String(error) })
        }
      }
    }

    return NextResponse.json({
      success: true,
      duration,
      apiCalls: totalApiCalls,
      results,
      chainResults: shouldChain ? chainResults : undefined,
    })
  } catch (error) {
    console.error('Cron collect-basketball error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-basketball',
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

/**
 * NBA 팀 로고 URL 생성 (ESPN CDN 사용)
 * BallDontLie abbreviation을 ESPN abbreviation으로 매핑
 */
function getNBATeamLogoUrl(abbreviation: string): string {
  // BallDontLie와 ESPN abbreviation 차이 매핑
  const abbrevMap: Record<string, string> = {
    'PHX': 'phx',  // Phoenix Suns
    'NOP': 'no',   // New Orleans Pelicans
    'NYK': 'ny',   // New York Knicks
    'SAS': 'sa',   // San Antonio Spurs
    'GSW': 'gs',   // Golden State Warriors
    'UTA': 'utah', // Utah Jazz
    'WAS': 'wsh',  // Washington Wizards
    'BKN': 'bkn',  // Brooklyn Nets
  }

  const espnAbbrev = abbrevMap[abbreviation] || abbreviation.toLowerCase()
  return `https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbrev}.png`
}

/**
 * BallDontLie 상태를 Prisma MatchStatus로 매핑
 */
function mapBDLStatus(bdlStatus: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    'Final': 'FINISHED',
    '1st Qtr': 'LIVE',
    '2nd Qtr': 'LIVE',
    '3rd Qtr': 'LIVE',
    '4th Qtr': 'LIVE',
    'Halftime': 'LIVE',
    'OT': 'LIVE',
    'In Progress': 'LIVE',
    '': 'SCHEDULED',
  }

  // ISO 형식인 경우 (예: "2026-01-21T00:00:00Z") → 시간 확정
  if (bdlStatus.includes('T') && bdlStatus.includes('Z')) {
    return 'TIMED'
  }

  return statusMap[bdlStatus] || 'SCHEDULED'
}

/**
 * BallDontLie status에서 경기 시간 파싱
 * status가 ISO 형식 (2026-01-21T00:00:00Z)이면 그대로 사용
 * 그 외 (Final, 1st Qtr 등)면 date만 사용
 */
function parseGameTime(dateStr: string, status: string): Date {
  // status가 ISO 날짜 형식인 경우 (예: "2026-01-21T00:00:00Z")
  if (status.includes('T') && status.includes('Z')) {
    return new Date(status)
  }

  // 그 외 경우 (Final, 1st Qtr 등) date만 사용
  return new Date(dateStr)
}

/**
 * 경기 slug 생성
 */
function createMatchSlug(
  leagueSlug: string,
  homeTeam: string,
  awayTeam: string,
  date: string
): string {
  const dateStr = format(new Date(date), 'yyyyMMdd')
  const slug = slugify(`${leagueSlug}-${homeTeam}-vs-${awayTeam}-${dateStr}`, {
    lower: true,
    strict: true,
  })
  return slug
}

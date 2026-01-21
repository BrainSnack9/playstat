import { NextResponse } from 'next/server'
import { format, addDays, subDays } from 'date-fns'
import slugify from 'slugify'
import type { PrismaClient, MatchStatus } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import {
  ballDontLieApi,
  calculateBaseballStandings,
  type BDLBaseballGame,
  type BDLBaseballTeam,
} from '@/lib/api/balldontlie'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// MLB 리그 정보
const MLB_LEAGUE = {
  name: 'MLB',
  country: 'USA',
  slug: 'mlb',
  code: 'MLB',
  logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
}

/**
 * GET /api/cron/collect-baseball
 * 크론: MLB 경기 데이터 수집
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
    sport: 'baseball' as const,
    teamsAdded: 0,
    teamsUpdated: 0,
    matchesAdded: 0,
    matchesUpdated: 0,
    standingsUpdated: 0,
    errors: [] as string[],
  }
  let totalApiCalls = 0

  try {
    // 1. MLB 리그 확인/생성
    let mlbLeague = await prisma.league.findFirst({
      where: { code: MLB_LEAGUE.code, sportType: 'BASEBALL' },
    })

    if (!mlbLeague) {
      mlbLeague = await prisma.league.create({
        data: {
          name: MLB_LEAGUE.name,
          country: MLB_LEAGUE.country,
          sportType: 'BASEBALL',
          code: MLB_LEAGUE.code,
          logoUrl: MLB_LEAGUE.logoUrl,
          isActive: true,
        },
      })
      console.log('[Baseball Cron] Created MLB league')
    } else if (!mlbLeague.logoUrl) {
      // 기존 리그에 로고 URL 업데이트
      mlbLeague = await prisma.league.update({
        where: { id: mlbLeague.id },
        data: { logoUrl: MLB_LEAGUE.logoUrl },
      })
    }

    // 2. MLB 팀 정보 수집 (팀이 없거나 30개 미만이면 수집)
    const existingTeamCount = await prisma.team.count({
      where: { sportType: 'BASEBALL', leagueId: mlbLeague.id },
    })

    if (existingTeamCount < 30) {
      console.log('[Baseball Cron] Fetching MLB teams...')
      const teams = await ballDontLieApi.getBaseballTeams()
      totalApiCalls++

      for (const team of teams) {
        try {
          const existingTeam = await prisma.team.findFirst({
            where: { externalId: String(team.id), sportType: 'BASEBALL' },
          })

          const logoUrl = getMLBTeamLogoUrl(team.abbreviation)

          if (existingTeam) {
            await prisma.team.update({
              where: { id: existingTeam.id },
              data: {
                name: team.name,
                shortName: team.abbreviation,
                tla: team.abbreviation,
                logoUrl,
              },
            })
            results.teamsUpdated++
          } else {
            await prisma.team.create({
              data: {
                leagueId: mlbLeague.id,
                name: team.name,
                shortName: team.abbreviation,
                tla: team.abbreviation,
                logoUrl,
                externalId: String(team.id),
                sportType: 'BASEBALL',
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
    const currentSeason = ballDontLieApi.getCurrentMLBSeason()

    // 오프시즌 체크 (MLB: 4월~10월만 시즌)
    const currentMonth = new Date().getMonth() + 1
    const isOffSeason = currentMonth < 4 || currentMonth > 10

    if (isOffSeason) {
      console.log('[Baseball Cron] MLB is in off-season (Nov-Mar). Skipping data collection.')

      const duration = Date.now() - startTime
      await prisma.schedulerLog.create({
        data: {
          jobName: 'collect-baseball',
          result: 'success',
          details: {
            message: 'Off-season - no games to collect',
            season: currentSeason,
            ...results
          },
          duration,
          apiCalls: totalApiCalls,
        },
      })

      return NextResponse.json({
        success: true,
        offSeason: true,
        message: 'MLB is in off-season (Nov-Mar). No games to collect.',
        duration,
        apiCalls: totalApiCalls,
        results,
      })
    }

    console.log(`[Baseball Cron] Fetching games from ${yesterday} to ${nextWeek}...`)
    const games = await ballDontLieApi.getBaseballGames({
      season: currentSeason,
      start_date: yesterday,
      end_date: nextWeek,
    })
    totalApiCalls++

    // 팀 매핑 캐시
    const teamCache = new Map<number, string>()
    const dbTeams = await prisma.team.findMany({
      where: { sportType: 'BASEBALL', leagueId: mlbLeague.id },
      select: { id: true, externalId: true },
    })
    dbTeams.forEach((t) => {
      if (t.externalId) teamCache.set(Number(t.externalId), t.id)
    })

    // 기존 경기 조회 (N+1 방지: 한 번에 조회)
    const existingMatches = await prisma.match.findMany({
      where: {
        sportType: 'BASEBALL',
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
        const awayTeamDbId = teamCache.get(game.away_team.id)

        if (!homeTeamDbId || !awayTeamDbId) {
          results.errors.push(`Game ${game.id}: Team not found in DB`)
          continue
        }

        const existingMatch = existingMatchMap.get(String(game.id))
        const matchStatus = mapBaseballStatus(game.status)

        // 이미 종료된 경기는 스킵 (점수 변경 없음)
        if (existingMatch && existingMatch.status === 'FINISHED') {
          continue
        }

        const matchSlug = createMatchSlug(
          MLB_LEAGUE.slug,
          game.home_team.abbreviation,
          game.away_team.abbreviation,
          game.date
        )

        const kickoffAt = new Date(game.date)

        if (existingMatch) {
          // 진행 중이거나 예정된 경기만 업데이트
          await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              kickoffAt,
              status: matchStatus,
              homeScore: game.home_team_score || null,
              awayScore: game.away_team_score || null,
            },
          })
          results.matchesUpdated++
        } else {
          await prisma.match.create({
            data: {
              leagueId: mlbLeague.id,
              homeTeamId: homeTeamDbId,
              awayTeamId: awayTeamDbId,
              sportType: 'BASEBALL',
              kickoffAt,
              status: matchStatus,
              homeScore: game.home_team_score || null,
              awayScore: game.away_team_score || null,
              slug: matchSlug,
              externalId: String(game.id),
              venue: game.venue,
              round: 'Regular Season',
            },
          })
          results.matchesAdded++
        }
      } catch (error) {
        results.errors.push(`Game ${game.id}: ${String(error)}`)
      }
    }

    // 4. 순위 계산 및 저장 (시즌 전체 경기 기반)
    // BallDontLie Free Tier에서 /standings API 미지원으로 직접 계산
    console.log('[Baseball Cron] Calculating standings from season games...')

    // 시즌 시작일 (4월 1일)부터 현재까지 완료된 경기 조회
    const seasonStart = `${currentSeason}-04-01`
    const today = format(new Date(), 'yyyy-MM-dd')

    const seasonGames = await ballDontLieApi.getBaseballGames({
      season: currentSeason,
      start_date: seasonStart,
      end_date: today,
    })
    totalApiCalls++

    const standings = calculateBaseballStandings(seasonGames)
    console.log(`[Baseball Cron] Calculated standings for ${standings.length} teams`)

    // 리그 시즌 업데이트
    await prisma.league.update({
      where: { id: mlbLeague.id },
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
            sportType: 'BASEBALL',
            season: currentSeason,
            gamesPlayed: standing.gamesPlayed,
            wins: standing.wins,
            losses: standing.losses,
            rank: standing.rank,
            form: standing.form,
            additionalStats: {
              league: standing.league,
              division: standing.division,
              win_percentage: standing.winPct,
            },
          },
          update: {
            season: currentSeason,
            gamesPlayed: standing.gamesPlayed,
            wins: standing.wins,
            losses: standing.losses,
            rank: standing.rank,
            form: standing.form,
            additionalStats: {
              league: standing.league,
              division: standing.division,
              win_percentage: standing.winPct,
            },
          },
        })
        results.standingsUpdated++
      } catch (error) {
        results.errors.push(`Standing ${standing.teamId}: ${String(error)}`)
      }
    }

    // 5. 각 팀의 최근 경기 수집 및 저장 (최적화: 일괄 조회)
    console.log('[Baseball Cron] Collecting recent matches for all teams (batch)...')
    let recentMatchesUpdated = 0

    // 한 번의 API 호출로 모든 팀의 최근 경기 조회 (기존: 30회 → 최적화: 1-2회)
    const allTeamsRecentGames = await ballDontLieApi.getBaseballAllTeamsRecentGames(currentSeason, 30)
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
          const teamScore = isHome ? game.home_team_score : game.away_team_score
          const opponentScore = isHome ? game.away_team_score : game.home_team_score
          const opponent = isHome ? game.away_team.name : game.home_team.name
          const result = (teamScore || 0) > (opponentScore || 0) ? 'W' : 'L'

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
            sportType: 'BASEBALL',
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

    console.log(`[Baseball Cron] Updated recent matches for ${recentMatchesUpdated} teams`)

    // 캐시 무효화
    if (results.matchesAdded > 0 || results.matchesUpdated > 0 || results.standingsUpdated > 0 || recentMatchesUpdated > 0) {
      console.log('[Baseball Cron] Revalidating cache tags...')
      revalidateTag('matches')
      revalidateTag('match-detail')
    }

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-baseball',
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
        '/api/cron/generate-analysis?sport=baseball',
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
    console.error('Cron collect-baseball error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-baseball',
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
 * MLB 팀 로고 URL 생성 (ESPN CDN 사용)
 */
function getMLBTeamLogoUrl(abbreviation: string): string {
  // ESPN abbreviation 매핑
  const abbrevMap: Record<string, string> = {
    'ARI': 'ari',  // Arizona Diamondbacks
    'ATL': 'atl',  // Atlanta Braves
    'BAL': 'bal',  // Baltimore Orioles
    'BOS': 'bos',  // Boston Red Sox
    'CHC': 'chc',  // Chicago Cubs
    'CWS': 'chw',  // Chicago White Sox
    'CIN': 'cin',  // Cincinnati Reds
    'CLE': 'cle',  // Cleveland Guardians
    'COL': 'col',  // Colorado Rockies
    'DET': 'det',  // Detroit Tigers
    'HOU': 'hou',  // Houston Astros
    'KC': 'kc',    // Kansas City Royals
    'LAA': 'laa',  // Los Angeles Angels
    'LAD': 'lad',  // Los Angeles Dodgers
    'MIA': 'mia',  // Miami Marlins
    'MIL': 'mil',  // Milwaukee Brewers
    'MIN': 'min',  // Minnesota Twins
    'NYM': 'nym',  // New York Mets
    'NYY': 'nyy',  // New York Yankees
    'OAK': 'oak',  // Oakland Athletics
    'PHI': 'phi',  // Philadelphia Phillies
    'PIT': 'pit',  // Pittsburgh Pirates
    'SD': 'sd',    // San Diego Padres
    'SF': 'sf',    // San Francisco Giants
    'SEA': 'sea',  // Seattle Mariners
    'STL': 'stl',  // St. Louis Cardinals
    'TB': 'tb',    // Tampa Bay Rays
    'TEX': 'tex',  // Texas Rangers
    'TOR': 'tor',  // Toronto Blue Jays
    'WSH': 'wsh',  // Washington Nationals
  }

  const espnAbbrev = abbrevMap[abbreviation] || abbreviation.toLowerCase()
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${espnAbbrev}.png`
}

/**
 * BallDontLie 야구 상태를 Prisma MatchStatus로 매핑
 */
function mapBaseballStatus(status: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    'Final': 'FINISHED',
    'In Progress': 'LIVE',
    'Scheduled': 'SCHEDULED',
    'Postponed': 'POSTPONED',
    'Cancelled': 'CANCELLED',
  }

  return statusMap[status] || 'SCHEDULED'
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

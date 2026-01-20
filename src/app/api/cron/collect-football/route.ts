import { NextResponse } from 'next/server'
import { format, addDays, subDays } from 'date-fns'
import slugify from 'slugify'
import type { PrismaClient, MatchStatus } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import {
  ballDontLieApi,
  calculateSoccerStandings,
  type BDLSoccerGame,
  type BDLSoccerTeam,
  type SoccerLeague,
} from '@/lib/api/balldontlie'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// 지원 리그 정보
const SUPPORTED_LEAGUES: Array<{
  league: SoccerLeague
  name: string
  country: string
  slug: string
  code: string
  logoUrl: string
}> = [
  {
    league: 'epl',
    name: 'Premier League',
    country: 'England',
    slug: 'epl',
    code: 'EPL',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/23.png',
  },
  {
    league: 'laliga',
    name: 'La Liga',
    country: 'Spain',
    slug: 'laliga',
    code: 'LALIGA',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/15.png',
  },
  {
    league: 'seriea',
    name: 'Serie A',
    country: 'Italy',
    slug: 'seriea',
    code: 'SERIEA',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/12.png',
  },
  {
    league: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    slug: 'bundesliga',
    code: 'BUNDESLIGA',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/10.png',
  },
  {
    league: 'ligue1',
    name: 'Ligue 1',
    country: 'France',
    slug: 'ligue1',
    code: 'LIGUE1',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/9.png',
  },
]

/**
 * GET /api/cron/collect-football
 * 크론: 축구 경기 데이터 수집 (BallDontLie API)
 *
 * BallDontLie Free Tier 제한:
 * - 분당 5회 요청
 * - 요청 사이 13초 딜레이 적용됨
 *
 * 수집 범위:
 * - 어제~7일 후 경기
 * - 팀 정보 (최초 1회)
 * - 순위표
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
    sport: 'football' as const,
    leaguesProcessed: [] as string[],
    teamsAdded: 0,
    teamsUpdated: 0,
    matchesAdded: 0,
    matchesUpdated: 0,
    standingsUpdated: 0,
    errors: [] as string[],
  }
  let totalApiCalls = 0

  try {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    const currentSeason = ballDontLieApi.getCurrentSoccerSeason()

    // 특정 리그만 처리 (쿼리 파라미터로 지정 가능)
    const url = new URL(request.url)
    const leagueParam = url.searchParams.get('league')

    // 처리할 리그 목록 결정
    const leaguesToProcess = leagueParam
      ? SUPPORTED_LEAGUES.filter(l => l.league === leagueParam)
      : SUPPORTED_LEAGUES

    if (leagueParam && leaguesToProcess.length === 0) {
      return NextResponse.json({
        error: `Invalid league: ${leagueParam}. Valid leagues: ${SUPPORTED_LEAGUES.map(l => l.league).join(', ')}`
      }, { status: 400 })
    }

    // 각 리그별로 데이터 수집
    for (const leagueInfo of leaguesToProcess) {
      try {
        console.log(`[Football Cron] Processing ${leagueInfo.name}...`)

        // 1. 리그 확인/생성
        let dbLeague = await prisma.league.findFirst({
          where: { code: leagueInfo.code, sportType: 'FOOTBALL' },
        })

        if (!dbLeague) {
          dbLeague = await prisma.league.create({
            data: {
              name: leagueInfo.name,
              country: leagueInfo.country,
              sportType: 'FOOTBALL',
              code: leagueInfo.code,
              logoUrl: leagueInfo.logoUrl,
              isActive: true,
              season: currentSeason,
            },
          })
          console.log(`[Football Cron] Created ${leagueInfo.name} league`)
        } else if (!dbLeague.logoUrl) {
          dbLeague = await prisma.league.update({
            where: { id: dbLeague.id },
            data: { logoUrl: leagueInfo.logoUrl, season: currentSeason },
          })
        }

        // 2. 팀 정보 수집 (항상 API에서 가져와서 동기화)
        console.log(`[Football Cron] Fetching ${leagueInfo.name} teams...`)
        const apiTeams = await ballDontLieApi.getSoccerTeams(leagueInfo.league, currentSeason)
        totalApiCalls++

        // 팀 ID → 팀 정보 맵 생성 (순위 계산용)
        const apiTeamMap = new Map<number, typeof apiTeams[0]>()
        apiTeams.forEach((t) => apiTeamMap.set(t.id, t))

        // 모든 API 팀을 DB에 upsert
        for (const team of apiTeams) {
          try {
            const existingTeam = await prisma.team.findFirst({
              where: { externalId: String(team.id), sportType: 'FOOTBALL' },
            })

            if (existingTeam) {
              // 기존 팀 업데이트 (리그 ID도 업데이트해서 올바른 리그에 연결)
              await prisma.team.update({
                where: { id: existingTeam.id },
                data: {
                  leagueId: dbLeague.id,
                  name: team.name,
                  shortName: team.abbr,
                  tla: team.abbr,
                },
              })
              results.teamsUpdated++
            } else {
              // 새 팀 생성
              await prisma.team.create({
                data: {
                  leagueId: dbLeague.id,
                  name: team.name,
                  shortName: team.abbr,
                  tla: team.abbr,
                  externalId: String(team.id),
                  sportType: 'FOOTBALL',
                },
              })
              results.teamsAdded++
            }
          } catch (error) {
            results.errors.push(`${leagueInfo.name} Team ${team.id}: ${String(error)}`)
          }
        }

        // 3. 경기 데이터 수집 (어제 ~ 7일 후)
        console.log(`[Football Cron] Fetching ${leagueInfo.name} games from ${yesterday} to ${nextWeek}...`)
        const games = await ballDontLieApi.getSoccerGames(leagueInfo.league, {
          season: currentSeason,
          start_date: yesterday,
          end_date: nextWeek,
        })
        totalApiCalls++

        // 팀 매핑 캐시
        const teamCache = new Map<number, string>()
        const dbTeams = await prisma.team.findMany({
          where: { sportType: 'FOOTBALL', leagueId: dbLeague.id },
          select: { id: true, externalId: true },
        })
        dbTeams.forEach((t) => {
          if (t.externalId) teamCache.set(Number(t.externalId), t.id)
        })

        // 기존 경기 조회 (N+1 방지: 한 번에 조회)
        const existingMatches = await prisma.match.findMany({
          where: {
            sportType: 'FOOTBALL',
            externalId: { in: games.map((g) => String(g.id)) },
          },
          select: { id: true, externalId: true, status: true },
        })
        const existingMatchMap = new Map(
          existingMatches.map((m) => [m.externalId, { id: m.id, status: m.status }])
        )

        for (const game of games) {
          try {
            const homeTeamDbId = teamCache.get(game.home_team_id)
            const awayTeamDbId = teamCache.get(game.away_team_id)

            if (!homeTeamDbId || !awayTeamDbId) {
              results.errors.push(`${leagueInfo.name} Game ${game.id}: Team not found in DB (home: ${game.home_team_id}, away: ${game.away_team_id})`)
              continue
            }

            const existingMatch = existingMatchMap.get(String(game.id))
            const matchStatus = mapSoccerStatus(game.status)

            // 이미 종료된 경기는 스킵 (점수 변경 없음)
            if (existingMatch && existingMatch.status === 'FINISHED') {
              continue
            }

            // 팀 약어 조회
            const homeTeam = apiTeamMap.get(game.home_team_id)
            const awayTeam = apiTeamMap.get(game.away_team_id)
            const homeAbbr = homeTeam?.abbr || `T${game.home_team_id}`
            const awayAbbr = awayTeam?.abbr || `T${game.away_team_id}`

            const matchSlug = createMatchSlug(
              leagueInfo.slug,
              homeAbbr,
              awayAbbr,
              game.kickoff
            )

            const kickoffAt = new Date(game.kickoff)

            if (existingMatch) {
              // 진행 중이거나 예정된 경기만 업데이트
              await prisma.match.update({
                where: { id: existingMatch.id },
                data: {
                  kickoffAt,
                  status: matchStatus,
                  homeScore: game.home_score,
                  awayScore: game.away_score,
                },
              })
              results.matchesUpdated++
            } else {
              await prisma.match.create({
                data: {
                  leagueId: dbLeague.id,
                  homeTeamId: homeTeamDbId,
                  awayTeamId: awayTeamDbId,
                  sportType: 'FOOTBALL',
                  kickoffAt,
                  status: matchStatus,
                  homeScore: game.home_score,
                  awayScore: game.away_score,
                  slug: matchSlug,
                  externalId: String(game.id),
                  venue: game.ground,
                  matchday: game.week,
                  round: `Week ${game.week}`,
                },
              })
              results.matchesAdded++
            }
          } catch (error) {
            results.errors.push(`${leagueInfo.name} Game ${game.id}: ${String(error)}`)
          }
        }

        // DB 팀 정보 캐시 (N+1 쿼리 방지)
        const dbTeamsByExternalId = new Map<string, { id: string }>()
        dbTeams.forEach((t) => {
          if (t.externalId) dbTeamsByExternalId.set(t.externalId, { id: t.id })
        })

        // 4. 순위 계산 및 저장 (시즌 전체 경기에서 직접 계산)
        console.log(`[Football Cron] Calculating ${leagueInfo.name} standings from games...`)
        const allSeasonGames = await ballDontLieApi.getSoccerGames(leagueInfo.league, {
          season: currentSeason,
        })
        totalApiCalls++

        const standings = calculateSoccerStandings(allSeasonGames, apiTeamMap)
        console.log(`[Football Cron] Calculated standings for ${standings.length} ${leagueInfo.name} teams`)

        // TeamSeasonStats 저장
        for (const standing of standings) {
          try {
            const team = dbTeamsByExternalId.get(String(standing.teamId))

            if (!team) {
              results.errors.push(`${leagueInfo.name} Standing: Team ${standing.teamId} not found`)
              continue
            }

            await prisma.teamSeasonStats.upsert({
              where: { teamId: team.id },
              create: {
                teamId: team.id,
                sportType: 'FOOTBALL',
                season: currentSeason,
                gamesPlayed: standing.gamesPlayed,
                wins: standing.wins,
                draws: standing.draws,
                losses: standing.losses,
                goalsFor: standing.goalsFor,
                goalsAgainst: standing.goalsAgainst,
                goalDifference: standing.goalDifference,
                points: standing.points,
                rank: standing.rank,
                form: standing.form,
              },
              update: {
                season: currentSeason,
                gamesPlayed: standing.gamesPlayed,
                wins: standing.wins,
                draws: standing.draws,
                losses: standing.losses,
                goalsFor: standing.goalsFor,
                goalsAgainst: standing.goalsAgainst,
                goalDifference: standing.goalDifference,
                points: standing.points,
                rank: standing.rank,
                form: standing.form,
              },
            })
            results.standingsUpdated++
          } catch (error) {
            results.errors.push(`${leagueInfo.name} Standing ${standing.teamId}: ${String(error)}`)
          }
        }

        // 5. 각 팀의 최근 경기 수집 및 저장
        console.log(`[Football Cron] Collecting recent matches for ${leagueInfo.name} teams...`)
        let recentMatchesUpdated = 0

        // 최근 30일 경기에서 팀별로 그룹핑
        const allTeamsRecentGames = await ballDontLieApi.getSoccerAllTeamsRecentGames(
          leagueInfo.league,
          currentSeason,
          30
        )
        totalApiCalls++

        for (const standing of standings) {
          try {
            const team = dbTeamsByExternalId.get(String(standing.teamId))
            if (!team) continue

            // 이미 조회된 데이터에서 해당 팀 경기 추출
            const recentGames = allTeamsRecentGames.get(standing.teamId) || []

            if (recentGames.length === 0) continue

            // RecentMatches 형식으로 변환
            const matchesJson = recentGames.map((game) => {
              const isHome = game.home_team_id === standing.teamId
              const teamScore = isHome ? game.home_score : game.away_score
              const opponentScore = isHome ? game.away_score : game.home_score
              const opponentId = isHome ? game.away_team_id : game.home_team_id
              const opponentTeam = apiTeamMap.get(opponentId)
              const opponent = opponentTeam?.name || `Team ${opponentId}`

              let result = 'D' // Draw
              if ((teamScore || 0) > (opponentScore || 0)) result = 'W'
              else if ((teamScore || 0) < (opponentScore || 0)) result = 'L'

              return {
                date: game.kickoff,
                opponent,
                result,
                score: `${teamScore}-${opponentScore}`,
                isHome,
              }
            })

            // 최근 5경기 폼 계산 (WWDLW 형식)
            const recentForm = matchesJson
              .slice(0, 5)
              .map((m) => m.result)
              .join('')

            // DB에 저장
            await prisma.teamRecentMatches.upsert({
              where: { teamId: team.id },
              create: {
                teamId: team.id,
                sportType: 'FOOTBALL',
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
            results.errors.push(`${leagueInfo.name} Recent matches ${standing.teamId}: ${String(error)}`)
          }
        }

        console.log(`[Football Cron] Updated recent matches for ${recentMatchesUpdated} ${leagueInfo.name} teams`)
        results.leaguesProcessed.push(leagueInfo.name)
      } catch (error) {
        results.errors.push(`${leagueInfo.name} League processing: ${String(error)}`)
      }
    }

    // 캐시 무효화
    if (results.matchesAdded > 0 || results.matchesUpdated > 0 || results.standingsUpdated > 0) {
      console.log('[Football Cron] Revalidating cache tags...')
      revalidateTag('matches')
      revalidateTag('match-detail')
    }

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-football',
        result: results.errors.length === 0 ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: totalApiCalls,
      },
    })

    // chain=true면 후속 작업 호출
    const shouldChain = url.searchParams.get('chain') === 'true'
    const chainResults: { job: string; success: boolean; error?: string }[] = []

    if (shouldChain && CRON_SECRET) {
      const baseUrl = url.origin
      const cronJobs = [
        '/api/cron/generate-analysis?sport=football',
        '/api/cron/generate-daily-report?sport=football',
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
    console.error('Cron collect-football error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-football',
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
 * BallDontLie 축구 상태를 Prisma MatchStatus로 매핑
 */
function mapSoccerStatus(status: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    'FT': 'FINISHED',        // Full Time
    'AET': 'FINISHED',       // After Extra Time
    'PEN': 'FINISHED',       // Penalties
    '1H': 'LIVE',            // First Half
    'HT': 'LIVE',            // Half Time
    '2H': 'LIVE',            // Second Half
    'ET': 'LIVE',            // Extra Time
    'P': 'LIVE',             // Penalty Shootout
    'SUSP': 'SUSPENDED',     // Suspended
    'INT': 'SUSPENDED',      // Interrupted
    'PST': 'POSTPONED',      // Postponed
    'CANC': 'CANCELLED',     // Cancelled
    'ABD': 'CANCELLED',      // Abandoned
    'AWD': 'FINISHED',       // Awarded
    'WO': 'FINISHED',        // Walkover
    'LIVE': 'LIVE',          // Live
    'NS': 'SCHEDULED',       // Not Started
    'TBD': 'SCHEDULED',      // To Be Defined
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

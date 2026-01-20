import { NextResponse } from 'next/server'
import { format, addDays, subDays } from 'date-fns'
import slugify from 'slugify'
import type { PrismaClient, MatchStatus } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import {
  footballDataApi,
  FREE_COMPETITIONS,
  getCurrentSeason,
  type Match as FDMatch,
  type StandingTableEntry,
} from '@/lib/api/football-data'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// Football-Data.org 지원 리그 정보
const SUPPORTED_LEAGUES = [
  {
    code: FREE_COMPETITIONS.PREMIER_LEAGUE,
    name: 'Premier League',
    country: 'England',
    slug: 'epl',
    dbCode: 'PL',
    logoUrl: 'https://crests.football-data.org/PL.png',
  },
  {
    code: FREE_COMPETITIONS.LA_LIGA,
    name: 'La Liga',
    country: 'Spain',
    slug: 'laliga',
    dbCode: 'PD',
    logoUrl: 'https://crests.football-data.org/PD.png',
  },
  {
    code: FREE_COMPETITIONS.SERIE_A,
    name: 'Serie A',
    country: 'Italy',
    slug: 'seriea',
    dbCode: 'SA',
    logoUrl: 'https://crests.football-data.org/SA.png',
  },
  {
    code: FREE_COMPETITIONS.BUNDESLIGA,
    name: 'Bundesliga',
    country: 'Germany',
    slug: 'bundesliga',
    dbCode: 'BL1',
    logoUrl: 'https://crests.football-data.org/BL1.png',
  },
  {
    code: FREE_COMPETITIONS.LIGUE_1,
    name: 'Ligue 1',
    country: 'France',
    slug: 'ligue1',
    dbCode: 'FL1',
    logoUrl: 'https://crests.football-data.org/FL1.png',
  },
] as const

type LeagueCode = (typeof SUPPORTED_LEAGUES)[number]['code']

/**
 * GET /api/cron/collect-football
 * 크론: 축구 경기 데이터 수집 (Football-Data.org API)
 *
 * Football-Data.org Free Tier:
 * - 분당 10회 요청
 * - 5대 리그 + Champions League 무료
 *
 * 수집 범위:
 * - 어제~7일 후 경기
 * - 팀 정보
 * - 순위표
 * - 최근 경기 폼
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
    recentMatchesUpdated: 0,
    errors: [] as string[],
  }
  let totalApiCalls = 0

  try {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    const currentSeason = getCurrentSeason()

    // 쿼리 파라미터
    const url = new URL(request.url)
    const leagueParam = url.searchParams.get('league')
    const skipStandings = url.searchParams.get('skipStandings') === 'true'

    // 처리할 리그 목록 결정
    const leaguesToProcess = leagueParam
      ? SUPPORTED_LEAGUES.filter((l) => l.code === leagueParam || l.slug === leagueParam)
      : SUPPORTED_LEAGUES

    if (leagueParam && leaguesToProcess.length === 0) {
      return NextResponse.json(
        {
          error: `Invalid league: ${leagueParam}. Valid leagues: ${SUPPORTED_LEAGUES.map((l) => l.code).join(', ')}`,
        },
        { status: 400 }
      )
    }

    console.log(
      `[Football Cron] Processing ${leaguesToProcess.length} leagues, skipStandings=${skipStandings}`
    )

    // 각 리그별로 데이터 수집
    for (const leagueInfo of leaguesToProcess) {
      try {
        console.log(`[Football Cron] Processing ${leagueInfo.name}...`)

        // 1. 리그 확인/생성
        let dbLeague = await prisma.league.findFirst({
          where: { code: leagueInfo.dbCode, sportType: 'FOOTBALL' },
        })

        if (!dbLeague) {
          dbLeague = await prisma.league.create({
            data: {
              name: leagueInfo.name,
              country: leagueInfo.country,
              sportType: 'FOOTBALL',
              code: leagueInfo.dbCode,
              logoUrl: leagueInfo.logoUrl,
              isActive: true,
              season: currentSeason,
            },
          })
          console.log(`[Football Cron] Created ${leagueInfo.name} league`)
        } else {
          // 기존 리그 업데이트 (logoUrl 등)
          dbLeague = await prisma.league.update({
            where: { id: dbLeague.id },
            data: {
              logoUrl: leagueInfo.logoUrl,
              season: currentSeason,
            },
          })
        }

        // 2. 순위표에서 팀 정보 수집 (팀 목록 + 순위 동시에)
        console.log(`[Football Cron] Fetching ${leagueInfo.name} standings...`)
        const standingsResponse = await footballDataApi.getStandings(leagueInfo.code)
        totalApiCalls++

        // TOTAL 타입의 순위표 찾기
        const totalStandings = standingsResponse.standings.find((s) => s.type === 'TOTAL')
        if (!totalStandings) {
          results.errors.push(`${leagueInfo.name}: No TOTAL standings found`)
          continue
        }

        // 팀 정보 맵 생성 (API ID -> 팀 정보)
        const apiTeamMap = new Map<number, StandingTableEntry['team']>()
        totalStandings.table.forEach((entry) => {
          apiTeamMap.set(entry.team.id, entry.team)
        })

        // 모든 팀을 DB에 upsert
        for (const entry of totalStandings.table) {
          const team = entry.team
          try {
            const existingTeam = await prisma.team.findFirst({
              where: { externalId: String(team.id), sportType: 'FOOTBALL' },
            })

            if (existingTeam) {
              await prisma.team.update({
                where: { id: existingTeam.id },
                data: {
                  leagueId: dbLeague.id,
                  name: team.name,
                  shortName: team.shortName,
                  tla: team.tla,
                  logoUrl: team.crest,
                },
              })
              results.teamsUpdated++
            } else {
              await prisma.team.create({
                data: {
                  leagueId: dbLeague.id,
                  name: team.name,
                  shortName: team.shortName,
                  tla: team.tla,
                  logoUrl: team.crest,
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

        // 팀 매핑 캐시 (API ID -> DB ID)
        const teamCache = new Map<number, string>()
        const dbTeams = await prisma.team.findMany({
          where: { sportType: 'FOOTBALL', leagueId: dbLeague.id },
          select: { id: true, externalId: true },
        })
        dbTeams.forEach((t) => {
          if (t.externalId) teamCache.set(Number(t.externalId), t.id)
        })

        // 3. 경기 데이터 수집 (어제 ~ 7일 후)
        console.log(`[Football Cron] Fetching ${leagueInfo.name} matches from ${yesterday} to ${nextWeek}...`)
        const matchesResponse = await footballDataApi.getCompetitionMatches(leagueInfo.code, {
          dateFrom: yesterday,
          dateTo: nextWeek,
        })
        totalApiCalls++

        // 기존 경기 조회 (N+1 방지)
        const matchExternalIds = matchesResponse.matches.map((m) => String(m.id))
        const existingMatches = await prisma.match.findMany({
          where: {
            sportType: 'FOOTBALL',
            externalId: { in: matchExternalIds },
          },
          select: { id: true, externalId: true, status: true },
        })
        const existingMatchMap = new Map(
          existingMatches.map((m) => [m.externalId, { id: m.id, status: m.status }])
        )

        for (const match of matchesResponse.matches) {
          try {
            const homeTeamDbId = teamCache.get(match.homeTeam.id)
            const awayTeamDbId = teamCache.get(match.awayTeam.id)

            if (!homeTeamDbId || !awayTeamDbId) {
              results.errors.push(
                `${leagueInfo.name} Match ${match.id}: Team not found (home: ${match.homeTeam.id}, away: ${match.awayTeam.id})`
              )
              continue
            }

            const existingMatch = existingMatchMap.get(String(match.id))
            const matchStatus = mapFDStatus(match.status)

            // 이미 종료된 경기는 스킵
            if (existingMatch && existingMatch.status === 'FINISHED') {
              continue
            }

            const matchSlug = createMatchSlug(
              leagueInfo.slug,
              match.homeTeam.tla,
              match.awayTeam.tla,
              match.utcDate
            )

            const kickoffAt = new Date(match.utcDate)

            if (existingMatch) {
              await prisma.match.update({
                where: { id: existingMatch.id },
                data: {
                  kickoffAt,
                  status: matchStatus,
                  homeScore: match.score.fullTime.home,
                  awayScore: match.score.fullTime.away,
                  halfTimeHome: match.score.halfTime.home,
                  halfTimeAway: match.score.halfTime.away,
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
                  homeScore: match.score.fullTime.home,
                  awayScore: match.score.fullTime.away,
                  halfTimeHome: match.score.halfTime.home,
                  halfTimeAway: match.score.halfTime.away,
                  slug: matchSlug,
                  externalId: String(match.id),
                  venue: match.venue || null,
                  matchday: match.matchday,
                  round: `Matchday ${match.matchday}`,
                },
              })
              results.matchesAdded++
            }
          } catch (error) {
            results.errors.push(`${leagueInfo.name} Match ${match.id}: ${String(error)}`)
          }
        }

        // 4. 순위 저장 (skipStandings=true면 스킵)
        if (!skipStandings) {
          console.log(`[Football Cron] Saving ${leagueInfo.name} standings...`)

          for (const entry of totalStandings.table) {
            try {
              const teamDbId = teamCache.get(entry.team.id)
              if (!teamDbId) continue

              await prisma.teamSeasonStats.upsert({
                where: { teamId: teamDbId },
                create: {
                  teamId: teamDbId,
                  sportType: 'FOOTBALL',
                  season: currentSeason,
                  gamesPlayed: entry.playedGames,
                  wins: entry.won,
                  draws: entry.draw,
                  losses: entry.lost,
                  goalsFor: entry.goalsFor,
                  goalsAgainst: entry.goalsAgainst,
                  goalDifference: entry.goalDifference,
                  points: entry.points,
                  rank: entry.position,
                  form: entry.form?.replace(/,/g, '') || null,
                },
                update: {
                  season: currentSeason,
                  gamesPlayed: entry.playedGames,
                  wins: entry.won,
                  draws: entry.draw,
                  losses: entry.lost,
                  goalsFor: entry.goalsFor,
                  goalsAgainst: entry.goalsAgainst,
                  goalDifference: entry.goalDifference,
                  points: entry.points,
                  rank: entry.position,
                  form: entry.form?.replace(/,/g, '') || null,
                },
              })
              results.standingsUpdated++
            } catch (error) {
              results.errors.push(`${leagueInfo.name} Standing ${entry.team.id}: ${String(error)}`)
            }
          }

          // 5. 각 팀의 최근 경기 수집 (팀별로 API 호출)
          console.log(`[Football Cron] Collecting recent matches for ${leagueInfo.name} teams...`)

          for (const entry of totalStandings.table) {
            try {
              const teamDbId = teamCache.get(entry.team.id)
              if (!teamDbId) continue

              // 팀의 최근 경기 조회 (완료된 경기만)
              const teamMatchesResponse = await footballDataApi.getTeamMatches(entry.team.id, {
                status: 'FINISHED',
                limit: 10,
              })
              totalApiCalls++

              const recentMatches = teamMatchesResponse.matches
                .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
                .slice(0, 10)

              if (recentMatches.length === 0) continue

              // RecentMatches 형식으로 변환
              const matchesJson = recentMatches.map((m) => {
                const isHome = m.homeTeam.id === entry.team.id
                const teamScore = isHome ? m.score.fullTime.home : m.score.fullTime.away
                const opponentScore = isHome ? m.score.fullTime.away : m.score.fullTime.home
                const opponent = isHome ? m.awayTeam.name : m.homeTeam.name

                let result = 'D'
                if ((teamScore || 0) > (opponentScore || 0)) result = 'W'
                else if ((teamScore || 0) < (opponentScore || 0)) result = 'L'

                return {
                  date: m.utcDate,
                  opponent,
                  result,
                  score: `${teamScore}-${opponentScore}`,
                  isHome,
                }
              })

              // 최근 5경기 폼 계산
              const recentForm = matchesJson
                .slice(0, 5)
                .map((m) => m.result)
                .join('')

              await prisma.teamRecentMatches.upsert({
                where: { teamId: teamDbId },
                create: {
                  teamId: teamDbId,
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

              results.recentMatchesUpdated++
            } catch (error) {
              results.errors.push(`${leagueInfo.name} Recent matches ${entry.team.id}: ${String(error)}`)
            }
          }
        }

        console.log(`[Football Cron] Completed ${leagueInfo.name}`)
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

    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * Football-Data.org 상태를 Prisma MatchStatus로 매핑
 */
function mapFDStatus(status: FDMatch['status']): MatchStatus {
  const statusMap: Record<FDMatch['status'], MatchStatus> = {
    SCHEDULED: 'SCHEDULED',
    TIMED: 'SCHEDULED',
    IN_PLAY: 'LIVE',
    PAUSED: 'LIVE',
    FINISHED: 'FINISHED',
    SUSPENDED: 'SUSPENDED',
    POSTPONED: 'POSTPONED',
    CANCELLED: 'CANCELLED',
    AWARDED: 'FINISHED',
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
  return slugify(`${leagueSlug}-${homeTeam}-vs-${awayTeam}-${dateStr}`, {
    lower: true,
    strict: true,
  })
}

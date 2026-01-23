import { NextResponse } from 'next/server'
import { ballDontLieApi } from '@/lib/api/balldontlie'
import { footballDataApi, FREE_COMPETITIONS, type Match as FDMatch } from '@/lib/api/football-data'
import { format, subDays, addDays } from 'date-fns'
import type { PrismaClient, MatchStatus, SportType } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'

// Vercel Function 설정 - App Router
export const maxDuration = 60 // 1분 (실시간 업데이트는 빨라야 함)
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// Football-Data.org에서 지원하는 무료 리그 목록
const FOOTBALL_COMPETITIONS = [
  FREE_COMPETITIONS.PREMIER_LEAGUE,
  FREE_COMPETITIONS.LA_LIGA,
  FREE_COMPETITIONS.SERIE_A,
  FREE_COMPETITIONS.BUNDESLIGA,
  FREE_COMPETITIONS.LIGUE_1,
]

/**
 * GET /api/cron/update-live-matches
 * 크론: 현재 진행 중이거나 오늘/어제 경기의 상태 및 스코어 업데이트 + 데일리 DB 정리(Cleanup)
 * - Football: Football-Data.org API 사용
 * - Basketball/Baseball: BallDontLie API 사용
 * 실행: 매 10-15분 권장
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
  const now = new Date()

  // sport 파라미터로 스포츠 타입 필터
  const sportType = getSportFromRequest(request)
  const sportTypeEnum = sportIdToEnum(sportType) as SportType

  try {
    // --- 1. 실시간 경기 업데이트 로직 ---
    const dateFrom = format(subDays(now, 1), 'yyyy-MM-dd')
    const dateTo = format(addDays(now, 1), 'yyyy-MM-dd')

    console.log(`[Cron] Fetching ${sportType} matches from ${dateFrom} to ${dateTo}`)

    let updatedCount = 0
    const errors: string[] = []
    const updatedMatchesLog: string[] = []
    let apiCalls = 0

    if (sportType === 'football') {
      // Football: Football-Data.org API 사용
      const allFootballMatches: FDMatch[] = []

      for (const competitionCode of FOOTBALL_COMPETITIONS) {
        try {
          const response = await footballDataApi.getCompetitionMatches(competitionCode, {
            dateFrom,
            dateTo,
          })
          allFootballMatches.push(...response.matches)
          apiCalls++
        } catch (error) {
          console.error(`Failed to fetch ${competitionCode} matches:`, error)
          errors.push(`Competition ${competitionCode}: ${String(error)}`)
        }
      }

      // DB에 있는 해당 범위의 경기들을 한 번에 가져와서 메모리에서 비교
      const externalIds = allFootballMatches.map(m => String(m.id))
      const existingMatches = await prisma.match.findMany({
        where: {
          externalId: { in: externalIds },
          sportType: sportTypeEnum,
        },
        select: {
          id: true,
          externalId: true,
          status: true,
          homeScore: true,
          awayScore: true,
          halfTimeHome: true,
          halfTimeAway: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } }
        }
      })

      const existingMatchMap = new Map(existingMatches.map(m => [m.externalId, m]))

      for (const match of allFootballMatches) {
        try {
          const existingMatch = existingMatchMap.get(String(match.id))

          if (existingMatch) {
            const newStatus = mapFDStatus(match.status)
            const newHomeScore = match.score.fullTime.home
            const newAwayScore = match.score.fullTime.away
            const newHalfTimeHome = match.score.halfTime.home
            const newHalfTimeAway = match.score.halfTime.away

            const isChanged =
              existingMatch.status !== newStatus ||
              existingMatch.homeScore !== newHomeScore ||
              existingMatch.awayScore !== newAwayScore ||
              existingMatch.halfTimeHome !== newHalfTimeHome ||
              existingMatch.halfTimeAway !== newHalfTimeAway

            if (isChanged) {
              await prisma.match.update({
                where: { id: existingMatch.id },
                data: {
                  status: newStatus,
                  homeScore: newHomeScore,
                  awayScore: newAwayScore,
                  halfTimeHome: newHalfTimeHome,
                  halfTimeAway: newHalfTimeAway,
                },
              })
              updatedCount++
              updatedMatchesLog.push(`${existingMatch.homeTeam.name} vs ${existingMatch.awayTeam.name} (${newStatus} ${newHomeScore}:${newAwayScore})`)
            }
          }
        } catch (error) {
          errors.push(`Match ${match.id}: ${String(error)}`)
        }
      }
    } else {
      // Basketball/Baseball: BallDontLie API 사용
      let matchesResponse: { data?: unknown[] } = { data: [] }

      try {
        if (sportType === 'basketball') {
          matchesResponse = await ballDontLieApi.getGamesByDateRange(dateFrom, dateTo)
          apiCalls = 1
        } else if (sportType === 'baseball') {
          matchesResponse = await ballDontLieApi.getBaseballGames({
            start_date: dateFrom,
            end_date: dateTo,
          })
          apiCalls = 1
        }
      } catch (error) {
        console.error(`Failed to fetch ${sportType} matches:`, error)
        throw error
      }

      const apiMatches = (matchesResponse.data || []) as Array<{ id: number; [key: string]: unknown }>

      // DB에 있는 해당 범위의 경기들을 한 번에 가져와서 메모리에서 비교
      const externalIds = apiMatches.map((m) => String(m.id))
      const existingMatches = await prisma.match.findMany({
        where: {
          externalId: { in: externalIds },
          sportType: sportTypeEnum,
        },
        select: {
          id: true,
          externalId: true,
          status: true,
          homeScore: true,
          awayScore: true,
          halfTimeHome: true,
          halfTimeAway: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } }
        }
      })

      const existingMatchMap = new Map(existingMatches.map(m => [m.externalId, m]))

      for (const match of apiMatches as Array<{
        id: number
        status: string
        home_team_score?: number
        visitor_team_score?: number
        period?: number
        time?: string
      }>) {
        try {
          const existingMatch = existingMatchMap.get(String(match.id))

          if (existingMatch) {
            const newStatus = mapBDLStatus(match.status)
            const newHomeScore = match.home_team_score ?? null
            const newAwayScore = match.visitor_team_score ?? null

            const isChanged =
              existingMatch.status !== newStatus ||
              existingMatch.homeScore !== newHomeScore ||
              existingMatch.awayScore !== newAwayScore

            if (isChanged) {
              await prisma.match.update({
                where: { id: existingMatch.id },
                data: {
                  status: newStatus,
                  homeScore: newHomeScore,
                  awayScore: newAwayScore,
                },
              })
              updatedCount++
              updatedMatchesLog.push(`${existingMatch.homeTeam.name} vs ${existingMatch.awayTeam.name} (${newStatus} ${newHomeScore}:${newAwayScore})`)
            }
          }
        } catch (error) {
          errors.push(`Match ${match.id}: ${String(error)}`)
        }
      }
    }

    // --- 2. DB 정리 로직 (Cleanup) ---
    // 매일 새벽 3시(KST, UTC 18시)경에 한 번만 실행되도록 설정
    const isCleanupTime = now.getUTCHours() === 18 && now.getUTCMinutes() < 15
    let cleanupResults = null

    if (isCleanupTime) {
      console.log('[Cron] Starting scheduled cleanup...')
      const days30Ago = subDays(now, 30)
      const days60Ago = subDays(now, 60)
      const days90Ago = subDays(now, 90)

      const deletedMatches = await prisma.match.deleteMany({
        where: {
          kickoffAt: { lt: days30Ago },
          status: 'FINISHED',
          sportType: sportTypeEnum,
        },
      })
      const deletedH2H = await prisma.headToHead.deleteMany({
        where: {
          updatedAt: { lt: days90Ago },
          sportType: sportTypeEnum,
        },
      })
      const deletedLogs = await prisma.schedulerLog.deleteMany({
        where: { executedAt: { lt: days60Ago } },
      })

      cleanupResults = {
        deletedMatches: deletedMatches.count,
        deletedH2H: deletedH2H.count,
        deletedLogs: deletedLogs.count,
      }
    }

    const duration = Date.now() - startTime

    // --- 3. 캐시 무효화 (Revalidation) ---
    // 데이터가 업데이트되었다면 관련 캐시를 즉시 삭제하여 사용자가 최신 스코어를 보게 함
    if (updatedCount > 0) {
      console.log('[Cron] Revalidating match tags...')
      revalidateTag('matches')
      revalidateTag('match-detail')
      revalidateTag('daily-report')
    }

    await prisma.schedulerLog.create({
      data: {
        jobName: `update-live-matches-${sportType}`,
        result: errors.length === 0 ? 'success' : 'partial',
        details: { sportType, updatedCount, updatedMatchesLog, cleanupResults, errors },
        duration,
        apiCalls,
      },
    })

    return NextResponse.json({
      success: true,
      sportType,
      updatedCount,
      cleanupExecuted: !!cleanupResults,
      cleanupResults,
      duration,
    })
  } catch (error: unknown) {
    console.error(`Cron update-live-matches-${sportType} error:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * Football-Data.org 상태 매핑
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
 * BallDontLie (Basketball/Baseball) 상태 매핑
 */
function mapBDLStatus(apiStatus: string): MatchStatus {
  // BallDontLie NBA API는 대문자로 반환 (Final, 1st Qtr 등)
  const statusMap: Record<string, MatchStatus> = {
    'Final': 'FINISHED',
    'final': 'FINISHED',
    'finished': 'FINISHED',
    '1st Qtr': 'LIVE',
    '2nd Qtr': 'LIVE',
    '3rd Qtr': 'LIVE',
    '4th Qtr': 'LIVE',
    'Halftime': 'LIVE',
    'OT': 'LIVE',
    'In Progress': 'LIVE',
    'in progress': 'LIVE',
    'in_progress': 'LIVE',
    'scheduled': 'SCHEDULED',
    'postponed': 'POSTPONED',
    'cancelled': 'CANCELLED',
    'suspended': 'SUSPENDED',
  }

  // ISO 형식인 경우 (예: "2026-01-21T00:00:00Z") → TIMED
  if (apiStatus.includes('T') && apiStatus.includes('Z')) {
    return 'TIMED'
  }

  return statusMap[apiStatus] || statusMap[apiStatus.toLowerCase()] || 'SCHEDULED'
}


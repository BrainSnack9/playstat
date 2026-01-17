import { NextResponse } from 'next/server'
import {
  footballDataApi,
} from '@/lib/api/football-data'
import { format, subDays, addDays } from 'date-fns'
import type { PrismaClient, MatchStatus } from '@prisma/client'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/update-live-matches
 * 크론: 현재 진행 중이거나 오늘/어제 경기의 상태 및 스코어 업데이트 + 데일리 DB 정리(Cleanup)
 * 실행: 매 10-15분 권장
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const now = new Date()
  
  try {
    // --- 1. 실시간 경기 업데이트 로직 ---
    const dateFrom = format(subDays(now, 1), 'yyyy-MM-dd')
    const dateTo = format(addDays(now, 1), 'yyyy-MM-dd')

    console.log(`[Cron] Fetching all matches from ${dateFrom} to ${dateTo}`)
    const matchesResponse = await footballDataApi.getMatchesByDateRange(dateFrom, dateTo)
    
    // DB에 있는 해당 범위의 경기들을 한 번에 가져와서 메모리에서 비교 (성능 최적화)
    const externalIds = matchesResponse.matches.map(m => String(m.id))
    const existingMatches = await prisma.match.findMany({
      where: { externalId: { in: externalIds } },
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
    
    let updatedCount = 0
    const errors: string[] = []
    const updatedMatchesLog: string[] = []

    for (const match of matchesResponse.matches) {
      try {
        const LEAGUE_CODES = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'DED', 'PPL']
        if (!LEAGUE_CODES.includes(match.competition.code)) continue

        const existingMatch = existingMatchMap.get(String(match.id))

        if (existingMatch) {
          const newStatus = mapStatus(match.status)
          const newHomeScore = match.score.fullTime.home
          const newAwayScore = match.score.fullTime.away
          const newHTHome = match.score.halfTime.home
          const newHTAway = match.score.halfTime.away

          const isChanged = 
            existingMatch.status !== newStatus ||
            existingMatch.homeScore !== newHomeScore ||
            existingMatch.awayScore !== newAwayScore ||
            existingMatch.halfTimeHome !== newHTHome ||
            existingMatch.halfTimeAway !== newHTAway

          if (isChanged) {
            await prisma.match.update({
              where: { id: existingMatch.id },
              data: {
                status: newStatus,
                homeScore: newHomeScore,
                awayScore: newAwayScore,
                halfTimeHome: newHTHome,
                halfTimeAway: newHTAway,
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
        where: { kickoffAt: { lt: days30Ago }, status: 'FINISHED' },
      })
      const deletedH2H = await prisma.headToHead.deleteMany({
        where: { updatedAt: { lt: days90Ago } },
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
        jobName: 'update-live-matches-with-cleanup',
        result: errors.length === 0 ? 'success' : 'partial',
        details: { updatedCount, updatedMatchesLog, cleanupResults, errors },
        duration,
        apiCalls: 1,
      },
    })

    return NextResponse.json({
      success: true,
      updatedCount,
      cleanupExecuted: !!cleanupResults,
      cleanupResults,
      duration,
    })
  } catch (error: any) {
    console.error('Cron update-live-matches error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 })
  }
}

function mapStatus(apiStatus: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    SCHEDULED: 'SCHEDULED',
    TIMED: 'TIMED',
    IN_PLAY: 'LIVE',
    PAUSED: 'LIVE',
    FINISHED: 'FINISHED',
    SUSPENDED: 'SUSPENDED',
    POSTPONED: 'POSTPONED',
    CANCELLED: 'CANCELLED',
    AWARDED: 'FINISHED',
  }
  return statusMap[apiStatus] || 'SCHEDULED'
}

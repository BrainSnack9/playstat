import { NextResponse } from 'next/server'
import {
  footballDataApi,
} from '@/lib/api/football-data'
import { format, subDays, addDays } from 'date-fns'
import type { PrismaClient, MatchStatus } from '@prisma/client'

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

    const matchesResponse = await footballDataApi.getMatchesByDateRange(dateFrom, dateTo)
    
    let updatedCount = 0
    const errors: string[] = []

    for (const match of matchesResponse.matches) {
      try {
        const existingMatch = await prisma.match.findFirst({
          where: { externalId: String(match.id) },
          select: { id: true, status: true }
        })

        if (existingMatch) {
          const newStatus = mapStatus(match.status)
          await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              status: newStatus,
              homeScore: match.score.fullTime.home,
              awayScore: match.score.fullTime.away,
              halfTimeHome: match.score.halfTime.home,
              halfTimeAway: match.score.halfTime.away,
            },
          })
          updatedCount++
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
    await prisma.schedulerLog.create({
      data: {
        jobName: 'update-live-matches-with-cleanup',
        result: errors.length === 0 ? 'success' : 'partial',
        details: { updatedCount, cleanupResults, errors },
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
  } catch (error) {
    console.error('Cron update-live-matches error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
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

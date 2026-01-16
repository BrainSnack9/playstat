import { NextResponse } from 'next/server'
import { subDays } from 'date-fns'
import type { PrismaClient } from '@prisma/client'

const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/cleanup
 * 크론: 오래된 데이터 정리
 *
 * 정리 항목:
 * - 30일 지난 종료 경기 삭제
 * - 60일 지난 스케줄러 로그 삭제
 * - 90일 지난 API 호출 로그 삭제
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { type: string; deleted: number }[] = []

  try {
    const now = new Date()
    const days30Ago = subDays(now, 30)
    const days60Ago = subDays(now, 60)
    const days90Ago = subDays(now, 90)

    // 30일 지난 종료 경기 삭제 (관련 데이터도 cascade 삭제됨)
    const deletedMatches = await prisma.match.deleteMany({
      where: {
        kickoffAt: { lt: days30Ago },
        status: 'FINISHED',
      },
    })
    results.push({ type: 'old_matches', deleted: deletedMatches.count })

    // 경기가 없는 팀의 데이터 정리 (선택적)
    // 주의: 이 부분은 팀 자체를 삭제하지 않고 관련 캐시 데이터만 정리

    // 오래된 H2H 데이터 정리 (90일 이상)
    const deletedH2H = await prisma.headToHead.deleteMany({
      where: {
        updatedAt: { lt: days90Ago },
      },
    })
    results.push({ type: 'old_h2h', deleted: deletedH2H.count })

    // 오래된 최근 경기 데이터 갱신 필요 표시 (60일 이상 업데이트 안된 것)
    // 삭제 대신 다음 크론에서 갱신하도록 함
    const staleRecentMatches = await prisma.teamRecentMatches.deleteMany({
      where: {
        updatedAt: { lt: days60Ago },
      },
    })
    results.push({ type: 'stale_recent_matches', deleted: staleRecentMatches.count })

    // 60일 지난 스케줄러 로그 삭제
    const deletedSchedulerLogs = await prisma.schedulerLog.deleteMany({
      where: {
        executedAt: { lt: days60Ago },
      },
    })
    results.push({ type: 'scheduler_logs', deleted: deletedSchedulerLogs.count })

    // 90일 지난 API 호출 로그 삭제
    const deletedApiLogs = await prisma.apiCallLog.deleteMany({
      where: {
        calledAt: { lt: days90Ago },
      },
    })
    results.push({ type: 'api_logs', deleted: deletedApiLogs.count })

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'cleanup',
        result: 'success',
        details: results,
        duration,
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      results,
      totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
    })
  } catch (error) {
    console.error('Cron cleanup error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'cleanup',
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

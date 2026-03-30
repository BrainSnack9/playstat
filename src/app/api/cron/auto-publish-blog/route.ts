import { NextResponse, type NextRequest } from 'next/server'
import { type PrismaClient } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { subHours } from 'date-fns'

const CRON_SECRET = process.env.CRON_SECRET

// KST = UTC + 9
const KST_OFFSET = 9

// 발행 허용 시간대 (KST 기준)
const PUBLISH_HOUR_START = 9  // 오전 9시
const PUBLISH_HOUR_END = 18   // 오후 6시

// 하루 최대 발행 수
const MAX_DAILY_PUBLISHES = 3

// 생성 후 최소 대기 시간 (시간)
const MIN_AGE_HOURS = 6

// 마지막 발행 후 최소 간격 (시간)
const MIN_INTERVAL_HOURS = 2

// 발행 확률 (70%) - 불규칙성을 위해
const PUBLISH_PROBABILITY = 0.7

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 현재 KST 시간 반환
 */
function getKSTHour(): number {
  const now = new Date()
  const utcHour = now.getUTCHours()
  return (utcHour + KST_OFFSET) % 24
}

/**
 * 오늘 KST 기준 자정 (UTC) 반환
 */
function getTodayStartKST(): Date {
  const now = new Date()
  const kstDate = new Date(now.getTime() + KST_OFFSET * 60 * 60 * 1000)
  const year = kstDate.getUTCFullYear()
  const month = kstDate.getUTCMonth()
  const day = kstDate.getUTCDate()
  // KST 자정 = UTC 전날 15:00
  return new Date(Date.UTC(year, month, day) - KST_OFFSET * 60 * 60 * 1000)
}

export async function GET(request: NextRequest) {
  try {
    // 1. 인증
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const kstHour = getKSTHour()

    // 2. KST 업무 시간 외이면 스킵
    if (kstHour < PUBLISH_HOUR_START || kstHour >= PUBLISH_HOUR_END) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: `Outside publishing hours (KST ${kstHour}h, allowed ${PUBLISH_HOUR_START}-${PUBLISH_HOUR_END})`,
      })
    }

    // 3. 랜덤 확률 게이트
    const roll = Math.random()
    if (roll > PUBLISH_PROBABILITY) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: `Random gate: ${(roll * 100).toFixed(1)}% > ${PUBLISH_PROBABILITY * 100}% threshold`,
      })
    }

    const prisma = await getPrisma()
    const todayStart = getTodayStartKST()

    // 4. 오늘 이미 발행된 수 확인
    const todayPublished = await prisma.blogPost.count({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: todayStart,
        },
      },
    })

    if (todayPublished >= MAX_DAILY_PUBLISHES) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: `Daily limit reached (${todayPublished}/${MAX_DAILY_PUBLISHES} published today)`,
      })
    }

    // 5. 마지막 발행 시간 확인
    const lastPublished = await prisma.blogPost.findFirst({
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    })

    if (lastPublished?.publishedAt) {
      const minIntervalTime = subHours(new Date(), MIN_INTERVAL_HOURS)
      if (lastPublished.publishedAt > minIntervalTime) {
        const minutesAgo = Math.round(
          (Date.now() - lastPublished.publishedAt.getTime()) / 1000 / 60
        )
        return NextResponse.json({
          success: true,
          action: 'skipped',
          reason: `Too soon since last publish (${minutesAgo}min ago, min ${MIN_INTERVAL_HOURS * 60}min)`,
        })
      }
    }

    // 6. 발행 대상 포스트 조회 (생성 후 6시간 이상)
    const minAgeThreshold = subHours(new Date(), MIN_AGE_HOURS)
    const candidates = await prisma.blogPost.findMany({
      where: {
        status: 'DRAFT',
        createdAt: {
          lte: minAgeThreshold,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        slug: true,
        translations: true,
        createdAt: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: 'No eligible draft posts (must be 6+ hours old)',
      })
    }

    // 7. 랜덤하게 1개 선택 (가장 오래된 것 중에서)
    const maxIndex = Math.min(candidates.length, 3)
    const selectedIndex = Math.floor(Math.random() * maxIndex)
    const selected = candidates[selectedIndex]

    // 8. PUBLISHED로 변경
    const now = new Date()
    await prisma.blogPost.update({
      where: { id: selected.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
      },
    })

    // 9. 캐시 무효화
    revalidateTag('blog')

    // 포스트 제목 추출 (로그용)
    let title = selected.slug
    try {
      const translations = selected.translations as Record<string, { title?: string }> | null
      if (translations?.ko?.title) {
        title = translations.ko.title
      } else if (translations?.en?.title) {
        title = translations.en.title
      }
    } catch {
      // translations 파싱 실패 시 slug 사용
    }

    return NextResponse.json({
      success: true,
      action: 'published',
      post: {
        id: selected.id,
        slug: selected.slug,
        title,
        createdAt: selected.createdAt,
        publishedAt: now,
      },
      stats: {
        todayPublished: todayPublished + 1,
        remainingCandidates: candidates.length - 1,
      },
    })
  } catch (error) {
    console.error('[auto-publish-blog] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

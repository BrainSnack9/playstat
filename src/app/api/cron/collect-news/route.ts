import { NextResponse } from 'next/server'
import { collectAndProcessNews, filterMajorLeagueNews } from '@/lib/api/news-api'
import type { PrismaClient } from '@prisma/client'

const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/collect-news
 * 크론: 축구 뉴스 수집 및 저장
 * 실행: 매 6시간마다
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  let newsAdded = 0
  let newsSkipped = 0
  const errors: string[] = []

  try {
    // 뉴스 수집 (최대 20개)
    const allNews = await collectAndProcessNews(20)

    // 주요 리그 뉴스만 필터링
    const majorNews = filterMajorLeagueNews(allNews)

    // 뉴스가 없으면 전체 뉴스 사용
    const newsToSave = majorNews.length > 0 ? majorNews : allNews.slice(0, 10)

    for (const news of newsToSave) {
      try {
        // 이미 존재하는 뉴스인지 확인
        const existing = await prisma.news.findUnique({
          where: { link: news.link },
        })

        if (existing) {
          newsSkipped++
          continue
        }

        // 새 뉴스 저장
        const newNews = await prisma.news.create({
          data: {
            title: news.title,
            titleEn: news.title,
            link: news.link,
            summary: news.summaryKo || news.summary,
            summaryEn: news.summary,
            source: news.source,
            imageUrl: news.imageUrl,
            sportType: 'FOOTBALL',
            relatedTeams: news.relatedTeams,
            publishedAt: news.publishedAt,
          },
        })

        // 뉴스 제목/요약 영문 번역 (만약 news.summary가 한글이라면)
        // (기존 API에서 이미 summaryEn이 오고 있다면 생략 가능하지만,
        // 확실히 하기 위해 필요한 경우 번역 로직 추가 가능)

        newsAdded++
      } catch (error) {
        errors.push(`News save error: ${String(error)}`)
      }
    }

    // 오래된 뉴스 삭제 (7일 이상)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const deleted = await prisma.news.deleteMany({
      where: {
        publishedAt: { lt: weekAgo },
      },
    })

    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-news',
        result: errors.length === 0 ? 'success' : 'partial',
        details: {
          newsAdded,
          newsSkipped,
          newsDeleted: deleted.count,
          errors,
        },
        duration,
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      newsAdded,
      newsSkipped,
      newsDeleted: deleted.count,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Cron collect-news error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-news',
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

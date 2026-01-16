import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.space'

// 빌드 시 동적으로 생성
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/matches/today`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/leagues`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // DB 연결이 없을 때는 정적 페이지만 반환
  try {
    // 동적 페이지: 리그
    const leagues = await prisma.league.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    })

    const leaguePages: MetadataRoute.Sitemap = leagues.map((league) => ({
      url: `${SITE_URL}/league/${league.id}`,
      lastModified: league.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    // 동적 페이지: 팀
    const teams = await prisma.team.findMany({
      select: { id: true, updatedAt: true },
      take: 500, // 상위 500개 팀
    })

    const teamPages: MetadataRoute.Sitemap = teams.map((team) => ({
      url: `${SITE_URL}/team/${team.id}`,
      lastModified: team.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    // 동적 페이지: 경기 (분석이 있는 것만)
    const matches = await prisma.match.findMany({
      where: {
        slug: { not: null },
        matchAnalysis: { isNot: null },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { kickoffAt: 'desc' },
      take: 1000, // 최근 1000개 경기
    })

    const matchPages: MetadataRoute.Sitemap = matches
      .filter((m) => m.slug)
      .map((match) => ({
        url: `${SITE_URL}/match/${match.slug}`,
        lastModified: match.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))

    // 동적 페이지: 데일리 리포트 (최근 30일)
    const dailyReports = await prisma.dailyReport.findMany({
      select: { date: true, updatedAt: true },
      orderBy: { date: 'desc' },
      take: 30,
    })

    const dailyPages: MetadataRoute.Sitemap = dailyReports.map((report) => {
      const dateStr = report.date.toISOString().split('T')[0]
      return {
        url: `${SITE_URL}/daily/${dateStr}`,
        lastModified: report.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.9, // 높은 우선순위 (SEO 중요)
      }
    })

    // 오늘 날짜 데일리 페이지 추가 (리포트가 없어도)
    const today = new Date().toISOString().split('T')[0]
    const hasTodayReport = dailyReports.some(
      (r) => r.date.toISOString().split('T')[0] === today
    )
    if (!hasTodayReport) {
      dailyPages.unshift({
        url: `${SITE_URL}/daily/${today}`,
        lastModified: new Date(),
        changeFrequency: 'hourly' as const,
        priority: 1, // 오늘 경기는 최고 우선순위
      })
    }

    return [...staticPages, ...dailyPages, ...leaguePages, ...teamPages, ...matchPages]
  } catch {
    console.warn('Sitemap: DB connection failed, returning static pages only')
    return staticPages
  }
}

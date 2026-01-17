import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { locales } from '@/i18n/config'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.space'

// 빌드 시 동적으로 생성
export const dynamic = 'force-dynamic'

/**
 * 모든 언어에 대한 URL을 생성하는 헬퍼 함수
 */
function getLocalizedUrls(path: string, priority: number, changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never', lastModified?: Date) {
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${path === '/' ? '' : path}`,
    lastModified: lastModified || new Date(),
    changeFrequency,
    priority,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    { path: '/', priority: 1, changeFrequency: 'daily' as const },
    { path: '/matches/today', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/leagues', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/news', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/about', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'monthly' as const },
  ]

  const staticPages: MetadataRoute.Sitemap = staticPaths.flatMap((p) => 
    getLocalizedUrls(p.path, p.priority, p.changeFrequency)
  )

  // DB 연결이 없을 때는 정적 페이지만 반환
  try {
    // 동적 페이지: 리그
    const leagues = await prisma.league.findMany({
      where: { isActive: true },
      select: { code: true, updatedAt: true },
    })

    const leaguePages: MetadataRoute.Sitemap = leagues.flatMap((league) => 
      getLocalizedUrls(`/league/${league.code?.toLowerCase() || 'epl'}`, 0.7, 'weekly' as const, league.updatedAt)
    )

    // 동적 페이지: 팀
    const teams = await prisma.team.findMany({
      select: { id: true, updatedAt: true },
      take: 250, // 언어별로 생성되므로 개수 조절 (500 -> 250 * 2 locales)
    })

    const teamPages: MetadataRoute.Sitemap = teams.flatMap((team) => 
      getLocalizedUrls(`/team/${team.id}`, 0.6, 'weekly' as const, team.updatedAt)
    )

    // 동적 페이지: 경기 (분석이 있는 것만)
    const matches = await prisma.match.findMany({
      where: {
        slug: { not: null },
        matchAnalysis: { isNot: null },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { kickoffAt: 'desc' },
      take: 500, // 언어별로 생성되므로 개수 조절
    })

    const matchPages: MetadataRoute.Sitemap = matches
      .filter((m) => m.slug)
      .flatMap((match) => 
        getLocalizedUrls(`/match/${match.slug}`, 0.8, 'daily' as const, match.updatedAt)
      )

    // 동적 페이지: 데일리 리포트 (최근 30일)
    const dailyReports = await prisma.dailyReport.findMany({
      select: { date: true, updatedAt: true },
      orderBy: { date: 'desc' },
      take: 30,
    })

    const dailyPages: MetadataRoute.Sitemap = dailyReports.flatMap((report) => {
      const dateStr = new Date(report.date).toISOString().split('T')[0]
      return getLocalizedUrls(`/daily/${dateStr}`, 0.9, 'daily' as const, report.updatedAt)
    })

    // 오늘 날짜 데일리 페이지 추가
    const today = new Date().toISOString().split('T')[0]
    const hasTodayReport = dailyReports.some(
      (r) => new Date(r.date).toISOString().split('T')[0] === today
    )
    if (!hasTodayReport) {
      const todayPages = getLocalizedUrls(`/daily/${today}`, 1, 'hourly' as const)
      dailyPages.unshift(...todayPages)
    }

    return [...staticPages, ...dailyPages, ...leaguePages, ...teamPages, ...matchPages]
  } catch (error) {
    console.warn('Sitemap: DB connection failed, returning static pages only', error)
    return staticPages
  }
}

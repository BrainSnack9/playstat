import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { locales } from '@/i18n/config'
import { resolveBaseUrl } from '@/lib/seo'
import { isApexHost } from '@/lib/sport'

// 빌드 시 동적으로 생성
export const dynamic = 'force-dynamic'

/**
 * 모든 언어에 대한 URL을 생성하는 헬퍼 함수
 */
function getLocalizedUrls(baseUrl: string, path: string, priority: number, changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never', lastModified?: Date) {
  return locales.map((locale) => ({
    url: `${baseUrl}/${locale}${path === '/' ? '' : path}`,
    lastModified: lastModified || new Date(),
    changeFrequency,
    priority,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)
  const isApex = isApexHost(host)

  const staticPaths = isApex
    ? [
        { path: '/', priority: 1, changeFrequency: 'daily' as const },
        { path: '/about', priority: 0.5, changeFrequency: 'monthly' as const },
        { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' as const },
        { path: '/terms', priority: 0.3, changeFrequency: 'monthly' as const },
      ]
    : [
        // Home
        { path: '/', priority: 1, changeFrequency: 'daily' as const },
        // Football
        { path: '/football/matches', priority: 0.9, changeFrequency: 'hourly' as const },
        { path: '/football/leagues', priority: 0.8, changeFrequency: 'weekly' as const },
        { path: '/football/teams', priority: 0.7, changeFrequency: 'weekly' as const },
        // Basketball
        { path: '/basketball/matches', priority: 0.9, changeFrequency: 'hourly' as const },
        { path: '/basketball/leagues', priority: 0.8, changeFrequency: 'weekly' as const },
        { path: '/basketball/teams', priority: 0.7, changeFrequency: 'weekly' as const },
        // Baseball
        { path: '/baseball/matches', priority: 0.9, changeFrequency: 'hourly' as const },
        { path: '/baseball/leagues', priority: 0.8, changeFrequency: 'weekly' as const },
        { path: '/baseball/teams', priority: 0.7, changeFrequency: 'weekly' as const },
        // Other
        { path: '/news', priority: 0.8, changeFrequency: 'hourly' as const },
        { path: '/blog', priority: 0.8, changeFrequency: 'daily' as const },
        { path: '/blog/analysis', priority: 0.7, changeFrequency: 'daily' as const },
        { path: '/blog/preview', priority: 0.7, changeFrequency: 'daily' as const },
        { path: '/blog/review', priority: 0.7, changeFrequency: 'daily' as const },
        { path: '/about', priority: 0.5, changeFrequency: 'monthly' as const },
        { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' as const },
        { path: '/terms', priority: 0.3, changeFrequency: 'monthly' as const },
      ]

  const staticPages: MetadataRoute.Sitemap = staticPaths.flatMap((p) => 
    getLocalizedUrls(baseUrl, p.path, p.priority, p.changeFrequency)
  )

  if (isApex) {
    return staticPages
  }

  // 스포츠 타입 매핑
  const sportTypeToPath: Record<string, string> = {
    FOOTBALL: 'football',
    BASKETBALL: 'basketball',
    BASEBALL: 'baseball',
  }

  // DB 연결이 없을 때는 정적 페이지만 반환
  try {
    // 동적 페이지: 리그 (스포츠별)
    const leagues = await prisma.league.findMany({
      where: { isActive: true },
      select: { code: true, updatedAt: true, sportType: true },
    })

    const leaguePages: MetadataRoute.Sitemap = leagues.flatMap((league) => {
      const sportPath = sportTypeToPath[league.sportType] || 'football'
      return getLocalizedUrls(baseUrl, `/${sportPath}/league/${league.code?.toLowerCase() || 'epl'}`, 0.7, 'weekly' as const, league.updatedAt)
    })

    // 동적 페이지: 팀 (스포츠별)
    const teams = await prisma.team.findMany({
      select: { id: true, updatedAt: true, sportType: true },
      take: 250,
    })

    const teamPages: MetadataRoute.Sitemap = teams.flatMap((team) => {
      const sportPath = sportTypeToPath[team.sportType] || 'football'
      return getLocalizedUrls(baseUrl, `/${sportPath}/team/${team.id}`, 0.6, 'weekly' as const, team.updatedAt)
    })

    // 동적 페이지: 경기 (분석이 있는 것만, 스포츠별)
    const matches = await prisma.match.findMany({
      where: {
        slug: { not: null },
        matchAnalysis: { isNot: null },
      },
      select: { slug: true, updatedAt: true, sportType: true },
      orderBy: { kickoffAt: 'desc' },
      take: 500,
    })

    const matchPages: MetadataRoute.Sitemap = matches
      .filter((m) => m.slug)
      .flatMap((match) => {
        const sportPath = sportTypeToPath[match.sportType] || 'football'
        return getLocalizedUrls(baseUrl, `/${sportPath}/match/${match.slug}`, 0.8, 'daily' as const, match.updatedAt)
      })

    // 동적 페이지: 데일리 리포트 (최근 30일, 스포츠별)
    const dailyReports = await prisma.dailyReport.findMany({
      select: { date: true, updatedAt: true, sportType: true },
      orderBy: { date: 'desc' },
      take: 90, // 30일 x 3 스포츠
    })

    const dailyPages: MetadataRoute.Sitemap = dailyReports.flatMap((report) => {
      const dateStr = new Date(report.date).toISOString().split('T')[0]
      const sportPath = sportTypeToPath[report.sportType] || 'football'
      return getLocalizedUrls(baseUrl, `/${sportPath}/daily/${dateStr}`, 0.9, 'daily' as const, report.updatedAt)
    })

    // 오늘 날짜 데일리 페이지 추가 (모든 스포츠)
    const today = new Date().toISOString().split('T')[0]
    const sports = ['football', 'basketball', 'baseball']
    for (const sport of sports) {
      const hasTodayReport = dailyReports.some(
        (r) => new Date(r.date).toISOString().split('T')[0] === today &&
               sportTypeToPath[r.sportType] === sport
      )
      if (!hasTodayReport) {
        const todayPages = getLocalizedUrls(baseUrl, `/${sport}/daily/${today}`, 1, 'hourly' as const)
        dailyPages.unshift(...todayPages)
      }
    }

    // 동적 페이지: 블로그 포스트
    const blogPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    })

    const blogPages: MetadataRoute.Sitemap = blogPosts.flatMap((post) =>
      getLocalizedUrls(baseUrl, `/blog/post/${post.slug}`, 0.7, 'weekly' as const, post.updatedAt)
    )

    return [...staticPages, ...dailyPages, ...leaguePages, ...teamPages, ...matchPages, ...blogPages]
  } catch (error) {
    console.warn('Sitemap: DB connection failed, returning static pages only', error)
    return staticPages
  }
}

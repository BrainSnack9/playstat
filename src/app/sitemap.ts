import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.com'

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
      url: `${SITE_URL}/daily-report`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
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

    return [...staticPages, ...leaguePages, ...teamPages, ...matchPages]
  } catch {
    console.warn('Sitemap: DB connection failed, returning static pages only')
    return staticPages
  }
}

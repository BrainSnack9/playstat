import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TodayMatches } from '@/components/matches/today-matches'
import { HotTrends } from '@/components/matches/hot-trends'
import { LatestNews, LatestNewsSkeleton } from '@/components/news/latest-news'
import { ArrowRight, Trophy, Calendar, ChartBar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'

// 빌드 시 외부 API fetch 방지 (뉴스 RSS, DB 쿼리 등)
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const seo = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: seo('site_name'),
    },
  }
}

// 주요 리그 코드 (football-data.org 기준)
const FEATURED_LEAGUE_CODES = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL']

interface FeaturedLeague {
  id: string
  name: string
  code: string | null
  country: string
  logoUrl: string | null
}

async function getFeaturedLeagues(): Promise<FeaturedLeague[]> {
  try {
    const leagues = await prisma.league.findMany({
      where: {
        code: { in: FEATURED_LEAGUE_CODES },
      },
      select: {
        id: true,
        name: true,
        code: true,
        country: true,
        logoUrl: true,
      },
      orderBy: { name: 'asc' },
    })

    // 정렬 순서 맞추기
    return FEATURED_LEAGUE_CODES.map((code) =>
      leagues.find((l: FeaturedLeague) => l.code === code)
    ).filter((league): league is FeaturedLeague => league !== undefined)
  } catch (error) {
    console.error('Failed to fetch featured leagues:', error)
    return []
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const featuredLeagues = await getFeaturedLeagues()

  return (
    <div className="container px-4 py-6 md:px-6 md:py-12">
      {/* Hero Section */}
      <section className="relative mb-10 overflow-hidden rounded-[2rem] bg-slate-50/50 py-10 dark:bg-slate-900/50 md:mb-16 md:py-20">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-4 top-0 h-72 w-72 animate-blob rounded-full bg-primary/10 mix-blend-multiply blur-3xl filter dark:mix-blend-soft-light md:h-96 md:w-96" />
          <div className="animation-delay-2000 absolute -right-4 top-0 h-72 w-72 animate-blob rounded-full bg-blue-400/10 mix-blend-multiply blur-3xl filter dark:mix-blend-soft-light md:h-96 md:w-96" />
          <div className="animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-blob rounded-full bg-purple-400/10 mix-blend-multiply blur-3xl filter dark:mix-blend-soft-light md:h-96 md:w-96" />
        </div>

        <div className="relative z-10 px-6 text-center md:px-12">
          <h1 className="mb-6 break-keep text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              {t('hero_title')}
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl break-keep text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t('hero_description')}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="h-12 w-full px-8 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 sm:h-14 sm:w-auto sm:text-lg">
              <Link href="/matches/today">
                <Calendar className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {t('today_matches')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 w-full px-8 text-base font-bold transition-all hover:bg-accent hover:scale-105 sm:h-14 sm:w-auto sm:text-lg">
              <Link href="/daily/today">
                <ChartBar className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {common('daily_report')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <HotTrends locale={locale} />
      </Suspense>

      <Separator className="mb-12" />

      {/* Featured Leagues */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">{t('featured_leagues')}</h2>
          <Button asChild variant="ghost">
            <Link href="/leagues">
              {common('view_all')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {featuredLeagues.map((league) => (
            <Link key={league.id} href={`/league/${league.code?.toLowerCase()}`}>
              <Card className="transition-shadow hover:shadow-md h-full">
                <CardContent className="flex flex-col items-center justify-center p-4 text-center h-full">
                  {league.logoUrl ? (
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-white p-1">
                      <Image
                        src={league.logoUrl}
                        alt={league.name}
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <Trophy className="mb-2 h-12 w-12 text-primary" />
                  )}
                  <h3 className="font-semibold text-sm">{league.name}</h3>
                  <p className="text-xs text-muted-foreground">{league.country}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's Matches */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">{t('today_matches')}</h2>
          <Button asChild variant="ghost">
            <Link href="/matches/today">
              {common('view_all')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={<div className="text-center py-8">{common('loading')}</div>}>
          <TodayMatches locale={locale} />
        </Suspense>
      </section>

      {/* Latest News */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">{t('latest_news')}</h2>
          <Button asChild variant="ghost">
            <Link href="/news">
              {common('view_all')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={<LatestNewsSkeleton />}>
          <LatestNews />
        </Suspense>
      </section>

    </div>
  )
}

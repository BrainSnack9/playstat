import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TodayMatches } from '@/components/matches/today-matches'
import { HotTrends } from '@/components/matches/hot-trends'
import { LatestNews, LatestNewsSkeleton } from '@/components/news/latest-news'
import { ArrowRight, Calendar } from 'lucide-react'

// Sport ID for football
const SPORT_ID = 'football'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const seo = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: `Football ${t('title')} - PlayStat`,
    description: `Football ${t('description')}`,
    openGraph: {
      title: `Football ${t('title')} - PlayStat`,
      description: `Football ${t('description')}`,
      siteName: seo('site_name'),
    },
  }
}

export default async function FootballHomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })

  // 서버에서 날짜 계산 (hydration 에러 방지)
  const todayDate = new Date().toISOString().split('T')[0]

  return (
    <div className="container space-y-12 py-8">
      {/* Hero Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-2xl">⚽</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Football {t('hero_title')}
            </h1>
            <p className="text-muted-foreground">
              {t('hero_subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Today's Matches */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t('todays_matches')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('todays_matches_desc')}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/football/daily/${todayDate}`}>
              <Calendar className="mr-2 h-4 w-4" />
              {common('view_daily_report')}
            </Link>
          </Button>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-48 animate-pulse bg-muted" />
              ))}
            </div>
          }
        >
          <TodayMatches sport={SPORT_ID} locale={locale} />
        </Suspense>
      </section>

      {/* Hot Trends */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t('hot_trends')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('hot_trends_desc')}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/football/matches">
              {common('view_all')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted" />
              ))}
            </div>
          }
        >
          <HotTrends sport={SPORT_ID} locale={locale} />
        </Suspense>
      </section>

      {/* Latest News */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t('latest_news')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('latest_news_desc')}
          </p>
        </div>

        <Suspense fallback={<LatestNewsSkeleton />}>
          <LatestNews />
        </Suspense>
      </section>

      {/* Quick Links */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="mb-2 font-semibold">{t('quick_links_matches')}</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('quick_links_matches_desc')}
          </p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/football/matches">{common('view_matches')}</Link>
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="mb-2 font-semibold">{t('quick_links_teams')}</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('quick_links_teams_desc')}
          </p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/football/teams">{common('view_teams')}</Link>
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="mb-2 font-semibold">{t('quick_links_leagues')}</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('quick_links_leagues_desc')}
          </p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/football/leagues">{common('view_leagues')}</Link>
          </Button>
        </Card>
      </section>
    </div>
  )
}

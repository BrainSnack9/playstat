import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TodayMatches } from '@/components/matches/today-matches'
import { LatestNews, LatestNewsSkeleton } from '@/components/news/latest-news'
import { LatestBlogPosts, LatestBlogPostsSkeleton } from '@/components/blog/latest-blog-posts'
import { ArrowRight, Calendar, ChartBar, Target } from 'lucide-react'
import { headers } from 'next/headers'
import { type Locale } from '@/i18n/config'
import { generateMetadata as buildMetadata, resolveBaseUrl } from '@/lib/seo'

// 빌드 시 외부 API fetch 방지 (뉴스 RSS, DB 쿼리 등)
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

// 스포츠 ID 목록
const SPORT_IDS = ['football', 'basketball', 'baseball'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const host = headers().get('host')
  const t = await getTranslations({ locale, namespace: 'home' })
  const seo = await getTranslations({ locale, namespace: 'seo' })
  const baseUrl = resolveBaseUrl(host)

  return buildMetadata(
    {
      title: t('title'),
      description: t('description'),
      keywords: [seo('site_name'), 'sports', 'analysis', 'football', 'basketball', 'baseball'],
    },
    { path: '/', locale: locale as Locale, baseUrl }
  )
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const sports = await getTranslations({ locale, namespace: 'sports' })

  // 오늘 날짜 (UTC 기준) - SEO를 위해 실제 날짜 URL 사용
  const todayDate = new Date().toISOString().slice(0, 10)

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
              <Link href="/football/matches">
                <Calendar className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {t('today_matches')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 w-full px-8 text-base font-bold transition-all hover:bg-accent hover:scale-105 sm:h-14 sm:w-auto sm:text-lg">
              <Link href={`/football/daily/${todayDate}`}>
                <ChartBar className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {common('daily_report')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 w-full px-8 text-base font-bold transition-all hover:bg-accent hover:scale-105 sm:h-14 sm:w-auto sm:text-lg">
              <Link href="/games/score-challenge">
                <Target className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                {common('score_prediction')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Separator className="mb-12" />

      {/* 3개 스포츠 오늘의 경기 섹션 */}
      {SPORT_IDS.map((sportId) => (
        <section key={sportId} className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="section-title">{sports(sportId)}</h2>
            <Button asChild variant="ghost">
              <Link href={`/${sportId}/matches`}>
                {common('view_all')} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Suspense fallback={<div className="text-center py-8">{common('loading')}</div>}>
            <TodayMatches locale={locale} sport={sportId} />
          </Suspense>
        </section>
      ))}

      <Separator className="mb-12" />

      {/* Latest Blog Posts - 최신 분석 */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">{t('latest_analysis')}</h2>
          <Button asChild variant="ghost">
            <Link href="/blog">
              {common('view_all')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={<LatestBlogPostsSkeleton />}>
          <LatestBlogPosts locale={locale} />
        </Suspense>
      </section>

      {/* Latest News - 전체 스포츠 */}
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
          <LatestNews locale={locale} />
        </Suspense>
      </section>
    </div>
  )
}

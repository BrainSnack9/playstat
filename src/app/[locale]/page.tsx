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
import { headers } from 'next/headers'
import { defaultLocale } from '@/i18n/config'
import { isApexHost } from '@/lib/sport'
import { orbitron, spaceGrotesk } from '@/lib/fonts'
import { LanguageSwitcher } from '@/components/layout/language-switcher'

// 빌드 시 외부 API fetch 방지 (뉴스 RSS, DB 쿼리 등)
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const host = headers().get('host')
  const isApex = isApexHost(host)
  const namespace = isApex ? 'landing' : 'home'
  const t = await getTranslations({ locale, namespace })
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

  const host = headers().get('host')
  const isApex = isApexHost(host)
  const t = await getTranslations({ locale, namespace: isApex ? 'landing' : 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })

  if (isApex) {
    const localePrefix = locale === defaultLocale ? '' : `/${locale}`
    const isLocal = host?.includes('localhost')
    const footballUrl = isLocal
      ? `http://football.localhost:3030${localePrefix}`
      : `https://football.playstat.space${localePrefix}`
    const basketballUrl = isLocal
      ? `http://basketball.localhost:3030${localePrefix}`
      : `https://basketball.playstat.space${localePrefix}`
    const baseballUrl = isLocal
      ? `http://baseball.localhost:3030${localePrefix}`
      : `https://baseball.playstat.space${localePrefix}`

    return (
      <div className={`min-h-screen bg-[#0b0f14] text-white ${spaceGrotesk.className}`}>
        <div className="container px-4 py-6 md:px-6 md:py-12">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/app-icon-512.png"
                alt="PlayStat"
                width={36}
                height={36}
                className="rounded"
              />
              <span className={`text-lg font-semibold ${orbitron.className}`}>PlayStat</span>
            </div>
            <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.2em] text-white/70 md:flex">
              <a href="#about" className="transition-colors hover:text-white">{t('nav_about')}</a>
              <a href="#services" className="transition-colors hover:text-white">{t('nav_services')}</a>
            </nav>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Button asChild size="sm" className="bg-lime-400 text-black hover:bg-lime-300">
                <a href="#contact">{t('cta_contact')}</a>
              </Button>
            </div>
          </header>

        </div>

        <div className="container px-4 pb-10 md:px-6 md:pb-16">
          <section id="about" className="relative mb-40 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/10 p-8 md:p-12">
            <div className="absolute inset-0 -z-10">
              <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
              <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
            </div>
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
                {t('eyebrow')}
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <img
                  src="/img_main_banner.jpg"
                  alt={t('hero_image_alt')}
                  className="h-72 w-full object-cover object-center md:h-[360px]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="pointer-events-none absolute inset-0 shadow-[0_0_60px_rgba(163,255,18,0.12)]" />
              </div>
              <div>
                <h1 className={`mb-4 text-4xl font-extrabold leading-tight md:text-5xl ${orbitron.className}`}>
                  {t('title')}
                </h1>
                <p className="mb-5 text-lg text-white/90 md:text-xl">{t('subtitle')}</p>
              <p className="mb-8 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
                {t('description')}
              </p>
              <div className="mb-6 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{t('pill_one')}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{t('pill_two')}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{t('pill_three')}</span>
              </div>
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {['about_point1', 'about_point2', 'about_point3'].map((key) => (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/50">{t(`${key}_label`)}</p>
                    <p className="font-semibold text-white">{t(`${key}_title`)}</p>
                    <p className="mt-2 text-sm text-white/70">{t(`${key}_desc`)}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button asChild size="lg" className="h-14 w-full bg-gradient-to-r from-lime-300 to-lime-400 text-black shadow-[0_0_24px_rgba(163,255,18,0.25)] hover:from-lime-200 hover:to-lime-300">
                  <a href={footballUrl} className="flex items-center justify-center gap-2">
                    <span className="text-sm uppercase tracking-[0.2em]">Football</span>
                  </a>
                </Button>
                <Button asChild size="lg" className="h-14 w-full bg-gradient-to-r from-orange-400 to-orange-500 text-black shadow-[0_0_24px_rgba(249,115,22,0.25)] hover:from-orange-300 hover:to-orange-400">
                  <a href={basketballUrl} className="flex items-center justify-center gap-2">
                    <span className="text-sm uppercase tracking-[0.2em]">Basketball</span>
                  </a>
                </Button>
                <Button asChild size="lg" className="h-14 w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.25)] hover:from-emerald-300 hover:to-emerald-400">
                  <a href={baseballUrl} className="flex items-center justify-center gap-2">
                    <span className="text-sm uppercase tracking-[0.2em]">Baseball</span>
                  </a>
                </Button>
              </div>
              </div>
            </div>
          </section>

          <section id="services" className="mb-40">
            <div className="mb-10 text-center">
              <h2 className={`text-2xl font-semibold md:text-3xl ${orbitron.className}`}>{t('features_title')}</h2>
              <p className="mt-2 text-sm text-white/60">{t('features_subtitle')}</p>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-white/70">{t('features_lead')}</p>
            </div>
            <div className="relative mx-auto max-w-3xl">
              <div className="absolute left-3 top-6 bottom-6 w-px bg-white/10" />
              {['insight_step1', 'insight_step2', 'insight_step3', 'insight_step4'].map((key, index, arr) => (
                <div key={key} className={`relative ${index < arr.length - 1 ? 'pb-10' : 'pb-0'}`}>
                  <div className="absolute left-0 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-lime-300/40 bg-black text-xs font-semibold text-lime-300">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="ml-10 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">{t(`${key}_label`)}</p>
                    <h3 className="mt-2 text-xl font-semibold">{t(`${key}_title`)}</h3>
                    <p className="mt-3 text-sm text-white/70">{t(`${key}_desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-20 grid gap-4 md:grid-cols-3">
              {['service_stat1', 'service_stat2', 'service_stat3'].map((key) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">{t(`${key}_label`)}</p>
                  <p className="mt-2 text-2xl font-semibold text-lime-300">{t(`${key}_value`)}</p>
                  <p className="mt-2 text-sm text-white/70">{t(`${key}_desc`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="sports" className="mb-40">
            <div className="mb-8 text-center">
              <h2 className={`text-2xl font-semibold md:text-3xl ${orbitron.className}`}>Sports Coverage</h2>
              <p className="mt-2 text-sm text-white/60">축구 · 농구 · 야구 종목별 리그 범위</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl border border-lime-300/20 bg-white/5 p-6 shadow-[0_0_24px_rgba(163,255,18,0.12)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-lime-300/60 via-white/10 to-transparent" />
                <p className="text-xs uppercase tracking-[0.2em] text-lime-300">FOOTBALL</p>
                <h3 className="mt-2 text-lg font-semibold">지원 리그</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  <li>프리미어리그 (PL)</li>
                  <li>라리가 (PD)</li>
                  <li>세리에 A (SA)</li>
                  <li>분데스리가 (BL1)</li>
                  <li>리그 1 (FL1)</li>
                  <li>챔피언스리그 (CL)</li>
                </ul>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/5 p-6 shadow-[0_0_24px_rgba(60,242,255,0.12)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-300/60 via-white/10 to-transparent" />
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">BASKETBALL</p>
                <h3 className="mt-2 text-lg font-semibold">더미 리그</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  <li>NBA (예정)</li>
                  <li>유로리그 (예정)</li>
                  <li>KBL (예정)</li>
                </ul>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-white/5 p-6 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-300/60 via-white/10 to-transparent" />
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">BASEBALL</p>
                <h3 className="mt-2 text-lg font-semibold">더미 리그</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  <li>MLB (예정)</li>
                  <li>KBO (예정)</li>
                  <li>NPB (예정)</li>
                </ul>
              </div>
            </div>
          </section>


          <section id="contact" className="mb-40">
            <div className="mb-6 text-center">
              <h2 className={`text-2xl font-semibold md:text-3xl ${orbitron.className}`}>{t('contact_title')}</h2>
              <p className="mt-2 text-sm text-white/60">{t('contact_subtitle')}</p>
            </div>
            <Card className="border-white/10 bg-white/5 text-white">
              <CardContent className="p-6">
                <form
                  action="mailto:contact@playstat.space"
                  method="post"
                  encType="text/plain"
                  className="grid gap-4 md:grid-cols-2"
                >
                  <input
                    name="name"
                    placeholder={t('contact_name')}
                    className="h-12 rounded-lg border border-white/10 bg-black/40 px-4 text-sm text-white placeholder:text-white/40"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder={t('contact_email')}
                    className="h-12 rounded-lg border border-white/10 bg-black/40 px-4 text-sm text-white placeholder:text-white/40"
                  />
                  <textarea
                    name="message"
                    placeholder={t('contact_message')}
                    className="min-h-[140px] rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 md:col-span-2"
                  />
                  <div className="flex items-center justify-between md:col-span-2">
                    <p className="text-xs text-white/50">{t('contact_note')}</p>
                    <Button type="submit" className="bg-lime-400 text-black hover:bg-lime-300">
                      {t('contact_send')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    )
  }

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
          <LatestNews locale={locale} />
        </Suspense>
      </section>

    </div>
  )
}

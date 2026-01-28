import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { MatchCard } from '@/components/match-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SportTabs } from '@/components/sport-tabs'
import { format, addDays, subDays } from 'date-fns'

const SPORT_ID = 'football'

export const revalidate = CACHE_REVALIDATE

interface Props {
  params: Promise<{ locale: string }>
}

const getCachedMatches = (dateRange: 'past' | 'upcoming' | 'live') =>
  unstable_cache(
    async () => {
      const now = new Date()

      const whereClause =
        dateRange === 'live'
          ? { sportType: 'FOOTBALL' as const, status: 'LIVE' as const }
          : dateRange === 'past'
            ? {
                sportType: 'FOOTBALL' as const,
                kickoffAt: { gte: subDays(now, 7), lte: now },
              }
            : {
                sportType: 'FOOTBALL' as const,
                kickoffAt: { gte: now, lte: addDays(now, 14) },
              }

      return await prisma.match.findMany({
        where: whereClause,
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          matchAnalysis: {
            select: { id: true },
          },
        },
        orderBy: {
          kickoffAt: dateRange === 'past' ? 'desc' : 'asc',
        },
        take: dateRange === 'live' ? undefined : 50,
      })
    },
    [`football-matches-${dateRange}`],
    { revalidate: dateRange === 'live' ? 60 : CACHE_REVALIDATE, tags: ['matches'] }
  )()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'matches' })

  return {
    title: `${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function FootballMatchesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'matches' })
  const sports = await getTranslations({ locale, namespace: 'sports' })

  return (
    <div className="container space-y-8 py-8">
      {/* 스포츠 선택 탭 */}
      <SportTabs currentSport={SPORT_ID} basePath="/matches" />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{sports('football')} {t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="live" className="space-y-6">
        <TabsList>
          <TabsTrigger value="live" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            {t('live_matches')}
          </TabsTrigger>
          <TabsTrigger value="upcoming">{t('upcoming_matches')}</TabsTrigger>
          <TabsTrigger value="past">{t('past_matches')}</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4">
          <Suspense
            fallback={
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            }
          >
            <LiveMatches locale={locale} />
          </Suspense>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Suspense
            fallback={
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            }
          >
            <UpcomingMatches locale={locale} />
          </Suspense>
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <Suspense
            fallback={
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            }
          >
            <PastMatches locale={locale} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

async function LiveMatches({ locale }: { locale: string }) {
  const matches = await getCachedMatches('live')
  const t = await getTranslations({ locale, namespace: 'matches' })

  if (matches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">{t('no_live_matches')}</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={{ ...match, slug: match.slug || match.id }} sport={SPORT_ID} locale={locale} />
      ))}
    </div>
  )
}

async function UpcomingMatches({ locale }: { locale: string }) {
  const matches = await getCachedMatches('upcoming')
  const t = await getTranslations({ locale, namespace: 'matches' })

  if (matches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">{t('no_upcoming_matches')}</p>
      </Card>
    )
  }

  // Group by date
  const groupedByDate = matches.reduce(
    (acc, match) => {
      const dateKey = format(new Date(match.kickoffAt), 'yyyy-MM-dd')
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(match)
      return acc
    },
    {} as Record<string, typeof matches>
  )

  return (
    <div className="space-y-8">
      {Object.entries(groupedByDate).map(([date, dateMatches]) => (
        <div key={date} className="space-y-4">
          <h3 className="text-lg font-semibold">
            {format(new Date(date), 'yyyy/MM/dd')}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dateMatches.map((match) => (
              <MatchCard key={match.id} match={{ ...match, slug: match.slug || match.id }} sport={SPORT_ID} locale={locale} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

async function PastMatches({ locale }: { locale: string }) {
  const matches = await getCachedMatches('past')
  const t = await getTranslations({ locale, namespace: 'matches' })

  if (matches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">{t('no_past_matches')}</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={{ ...match, slug: match.slug || match.id }} sport={SPORT_ID} locale={locale} />
      ))}
    </div>
  )
}

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { MatchCard } from '@/components/match-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, addDays, subDays } from 'date-fns'

const SPORT_ID = 'football'

export const revalidate = CACHE_REVALIDATE

interface Props {
  params: Promise<{ locale: string }>
}

const getCachedMatches = (dateRange: 'past' | 'upcoming') =>
  unstable_cache(
    async () => {
      const now = new Date()
      const dateFilter =
        dateRange === 'past'
          ? {
              kickoffAt: {
                gte: subDays(now, 7),
                lte: now,
              },
            }
          : {
              kickoffAt: {
                gte: now,
                lte: addDays(now, 14),
              },
            }

      return await prisma.match.findMany({
        where: {
          sportType: 'FOOTBALL',
          ...dateFilter,
        },
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: {
          kickoffAt: dateRange === 'past' ? 'desc' : 'asc',
        },
        take: 50,
      })
    },
    [`football-matches-${dateRange}`],
    { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
  )()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'matches' })

  return {
    title: `Football ${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function BaseballMatchesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'matches' })
  const common = await getTranslations({ locale, namespace: 'common' })

  return (
    <div className="container space-y-8 py-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-2xl">⚽</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Football {t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">{t('upcoming_matches')}</TabsTrigger>
          <TabsTrigger value="past">{t('past_matches')}</TabsTrigger>
        </TabsList>

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
            <UpcomingMatches />
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
            <PastMatches />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

async function UpcomingMatches() {
  const matches = await getCachedMatches('upcoming')

  if (matches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No upcoming matches</p>
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
            {format(new Date(date), 'MMMM d, yyyy')}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dateMatches.map((match) => (
              <MatchCard key={match.id} match={match} sport={SPORT_ID} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

async function PastMatches() {
  const matches = await getCachedMatches('past')

  if (matches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No past matches</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} sport={SPORT_ID} />
      ))}
    </div>
  )
}

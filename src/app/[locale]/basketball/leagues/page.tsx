import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { Link } from '@/i18n/routing'
import { Users, Calendar } from 'lucide-react'
import { LeagueLogo } from '@/components/ui/league-logo'
import { SportTabs } from '@/components/sport-tabs'

const SPORT_ID = 'basketball'

export const revalidate = CACHE_REVALIDATE

interface Props {
  params: Promise<{ locale: string }>
}

const getCachedLeagues = unstable_cache(
  async () => {
    return await prisma.league.findMany({
      where: {
        sportType: 'BASKETBALL',
        isActive: true,
      },
      include: {
        _count: {
          select: {
            teams: true,
            matches: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
  },
  ['basketball-leagues'],
  { revalidate: CACHE_REVALIDATE, tags: ['leagues'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'leagues' })

  return {
    title: `NBA ${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function BasketballLeaguesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'leagues' })
  const sports = await getTranslations({ locale, namespace: 'sports' })

  const leagues = await getCachedLeagues()

  return (
    <div className="container space-y-8 py-8">
      {/* 스포츠 선택 탭 */}
      <SportTabs currentSport={SPORT_ID} basePath="/leagues" />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{sports('basketball')} {t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => (
          <Link key={league.id} href={`/${SPORT_ID}/league/${league.code?.toLowerCase()}`}>
            <Card className="group h-full transition-all hover:shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <LeagueLogo logoUrl={league.logoUrl} name={league.name} size="xl" className="rounded-lg" />
                    <div>
                      <CardTitle className="group-hover:text-primary">
                        {league.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {league.country}
                      </p>
                    </div>
                  </div>
                  {league.season && (
                    <span className="text-sm text-muted-foreground">
                      {league.season}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{league._count.teams} Teams</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{league._count.matches} Matches</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {leagues.length === 0 && (
          <Card className="col-span-full p-12 text-center">
            <p className="text-muted-foreground">No leagues available</p>
          </Card>
        )}
      </div>
    </div>
  )
}

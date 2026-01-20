import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { Link } from '@/i18n/routing'
import { Trophy, Users, Calendar } from 'lucide-react'
import { LeagueLogo } from '@/components/ui/league-logo'

const SPORT_ID = 'baseball'

export const revalidate = CACHE_REVALIDATE

interface Props {
  params: Promise<{ locale: string }>
}

const getCachedLeagues = unstable_cache(
  async () => {
    return await prisma.league.findMany({
      where: {
        sportType: 'BASEBALL',
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
  ['baseball-leagues'],
  { revalidate: CACHE_REVALIDATE, tags: ['leagues'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'leagues' })

  return {
    title: `MLB ${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function BaseballLeaguesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'leagues' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const leagues = await getCachedLeagues()

  return (
    <div className="container space-y-8 py-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-2xl">⚾</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MLB {t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => (
          <Link key={league.id} href={`/league/${league.id}`}>
            <Card className="group h-full transition-all hover:shadow-lg">
              <CardHeader>
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
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">{league._count.teams}</p>
                      <p className="text-muted-foreground">Teams</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">{league._count.matches}</p>
                      <p className="text-muted-foreground">Matches</p>
                    </div>
                  </div>
                </div>

                {league.season && (
                  <div>
                    <Badge variant="secondary">Season {league.season}</Badge>
                  </div>
                )}
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

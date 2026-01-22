import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { Trophy } from 'lucide-react'
import { SportTabs } from '@/components/sport-tabs'

const SPORT_ID = 'football'

export const revalidate = CACHE_REVALIDATE

interface Props {
  params: Promise<{ locale: string }>
}

const getCachedTeams = unstable_cache(
  async () => {
    return await prisma.team.findMany({
      where: {
        sportType: 'FOOTBALL',
      },
      include: {
        league: true,
        seasonStats: true,
      },
      orderBy: [
        { seasonStats: { rank: 'asc' } },
        { name: 'asc' },
      ],
    })
  },
  ['football-teams'],
  { revalidate: CACHE_REVALIDATE, tags: ['teams'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'teams' })

  return {
    title: `Football ${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function FootballTeamsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'teams' })
  const sports = await getTranslations({ locale, namespace: 'sports' })

  const teams = await getCachedTeams()

  // 리그별로 그룹화
  const teamsByLeague = teams.reduce((acc, team) => {
    const leagueName = team.league?.name || 'Other'
    if (!acc[leagueName]) {
      acc[leagueName] = {
        league: team.league,
        teams: [],
      }
    }
    acc[leagueName].teams.push(team)
    return acc
  }, {} as Record<string, { league: typeof teams[0]['league']; teams: typeof teams }>)

  // 리그 순서 정렬 (팀 수가 많은 순)
  const sortedLeagues = Object.entries(teamsByLeague).sort(
    (a, b) => b[1].teams.length - a[1].teams.length
  )

  return (
    <div className="container space-y-8 py-8">
      {/* 스포츠 선택 탭 */}
      <SportTabs currentSport={SPORT_ID} basePath="/teams" />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{sports('football')} {t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-10">
        {sortedLeagues.map(([leagueName, { league, teams: leagueTeams }]) => (
          <div key={leagueName} className="space-y-4">
            <div className="flex items-center gap-3">
              {league?.logoUrl && (
                <Image
                  src={league.logoUrl}
                  alt={leagueName}
                  width={32}
                  height={32}
                  className="rounded bg-white p-0.5"
                />
              )}
              <h2 className="text-xl font-bold">{leagueName}</h2>
              <span className="text-sm text-muted-foreground">
                ({leagueTeams.length} teams)
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {leagueTeams
                .sort((a, b) => (a.seasonStats?.rank || 999) - (b.seasonStats?.rank || 999))
                .map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamCard({
  team,
}: {
  team: Awaited<ReturnType<typeof getCachedTeams>>[0]
}) {
  const stats = team.seasonStats

  return (
    <Link href={`/${SPORT_ID}/team/${team.id}`}>
      <Card className="group transition-all hover:shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {team.logoUrl && (
                <Image
                  src={team.logoUrl}
                  alt={team.name}
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              )}
              <div>
                <h3 className="font-semibold group-hover:text-primary">
                  {team.shortName || team.name}
                </h3>
                {team.tla && (
                  <p className="text-xs text-muted-foreground">{team.tla}</p>
                )}
              </div>
            </div>
            {stats?.rank && stats.rank <= 3 && (
              <Trophy className="h-5 w-5 text-yellow-500" />
            )}
          </div>

          {stats && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Record</span>
                <span className="font-semibold">
                  {stats.wins}W - {stats.losses}L
                </span>
              </div>
              {stats.rank && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rank</span>
                  <Badge variant="secondary">#{stats.rank}</Badge>
                </div>
              )}
              {stats.form && (
                <div className="flex items-center gap-1">
                  {stats.form.split('').map((result, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        result === 'W' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

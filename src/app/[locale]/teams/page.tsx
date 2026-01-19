import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TeamCard } from '@/components/team-card'
import Image from 'next/image'
import { SPORT_COOKIE, getSportFromCookie, sportIdToEnum } from '@/lib/sport'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ league?: string; search?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'team' })
  return {
    title: t('page_title'),
    description: t('page_description'),
  }
}

async function getTeams(sportType: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL') {
  try {
    const teams = await prisma.team.findMany({
      where: {
        sportType,
      },
      include: {
        league: true,
        seasonStats: {
          select: {
            rank: true,
            points: true,
          },
        },
      },
      orderBy: [
        { league: { name: 'asc' } },
        { name: 'asc' },
      ],
    })
    return teams
  } catch {
    return []
  }
}

async function getLeagues(sportType: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL') {
  try {
    // code가 있는 리그만 가져옴 (API에서 수집된 실제 리그)
    const leagues = await prisma.league.findMany({
      where: {
        sportType,
        code: { not: null },
      },
      orderBy: { name: 'asc' },
    })
    return leagues
  } catch {
    return []
  }
}

type TeamWithRelations = Awaited<ReturnType<typeof getTeams>>[number]

function groupTeamsByLeague(teams: TeamWithRelations[]) {
  return teams.reduce(
    (acc, team) => {
      const leagueName = team.league.name
      if (!acc[leagueName]) {
        acc[leagueName] = {
          league: team.league,
          teams: [],
        }
      }
      acc[leagueName].teams.push(team)
      return acc
    },
    {} as Record<string, { league: TeamWithRelations['league']; teams: TeamWithRelations[] }>
  )
}

export default async function TeamsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { league: leagueFilter, search } = await searchParams
  setRequestLocale(locale)

  // 쿠키에서 스포츠 타입 가져오기
  const cookieStore = await cookies()
  const sportType = sportIdToEnum(getSportFromCookie(cookieStore.get(SPORT_COOKIE)?.value))

  const t = await getTranslations({ locale, namespace: 'team' })

  let teams = await getTeams(sportType)
  const leagues = await getLeagues(sportType)

  // Filter by league if specified
  if (leagueFilter) {
    teams = teams.filter((team) => team.league.code === leagueFilter)
  }

  // Filter by search if specified
  if (search) {
    const searchLower = search.toLowerCase()
    teams = teams.filter(
      (team) =>
        team.name.toLowerCase().includes(searchLower) ||
        team.shortName?.toLowerCase().includes(searchLower) ||
        team.tla?.toLowerCase().includes(searchLower)
    )
  }

  const teamsByLeague = groupTeamsByLeague(teams)
  const hasTeams = teams.length > 0

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Users className="mr-3 h-8 w-8" />
          {t('page_title')}
        </h1>
        <p className="text-muted-foreground">
          {t('page_description')}
        </p>
      </div>

      {/* League Filter */}
      {leagues.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <a
            href="/teams"
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              !leagueFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {t('all')}
          </a>
          {leagues.map((league) => (
            <a
              key={league.id}
              href={`/teams?league=${league.code}`}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                leagueFilter === league.code
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {league.name}
            </a>
          ))}
        </div>
      )}

      {hasTeams ? (
        <div className="space-y-8">
          {Object.entries(teamsByLeague).map(([leagueName, { league, teams: leagueTeams }]) => (
            <section key={leagueName}>
              <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
                {league.logoUrl && (
                  <Image
                    src={league.logoUrl}
                    alt={leagueName}
                    width={24}
                    height={24}
                    className="rounded"
                  />
                )}
                {leagueName}
                <span className="text-sm font-normal text-muted-foreground">
                  ({t('teams_count', { count: leagueTeams.length })})
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {leagueTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={{
                      id: team.id,
                      name: team.name,
                      shortName: team.shortName,
                      tla: team.tla,
                      logoUrl: team.logoUrl,
                      league: {
                        name: team.league.name,
                        country: team.league.country,
                      },
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t('no_teams')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('run_cron_message')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

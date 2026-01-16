import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Calendar } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// Demo league data
const leagueData: Record<string, {
  name: string
  country: string
  season: string
  teams: Array<{ id: string; name: string; shortName: string; position: number; points: number; played: number; won: number; drawn: number; lost: number; gf: number; ga: number }>
  fixtures: Array<{ id: string; homeTeam: string; awayTeam: string; kickoffAt: string; status: string; homeScore?: number; awayScore?: number; slug: string }>
}> = {
  epl: {
    name: 'Premier League',
    country: 'England',
    season: '2024-25',
    teams: [
      { id: '1', name: 'Arsenal', shortName: 'ARS', position: 1, points: 45, played: 18, won: 14, drawn: 3, lost: 1, gf: 42, ga: 15 },
      { id: '2', name: 'Liverpool', shortName: 'LIV', position: 2, points: 44, played: 18, won: 14, drawn: 2, lost: 2, gf: 45, ga: 18 },
      { id: '3', name: 'Manchester City', shortName: 'MCI', position: 3, points: 40, played: 18, won: 12, drawn: 4, lost: 2, gf: 38, ga: 16 },
      { id: '4', name: 'Chelsea', shortName: 'CHE', position: 4, points: 35, played: 18, won: 10, drawn: 5, lost: 3, gf: 35, ga: 22 },
      { id: '5', name: 'Tottenham', shortName: 'TOT', position: 5, points: 32, played: 18, won: 9, drawn: 5, lost: 4, gf: 38, ga: 25 },
    ],
    fixtures: [
      { id: '1', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoffAt: new Date().toISOString(), status: 'SCHEDULED', slug: 'arsenal-vs-chelsea' },
      { id: '2', homeTeam: 'Liverpool', awayTeam: 'Manchester City', kickoffAt: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, slug: 'liverpool-vs-manchester-city' },
    ],
  },
  laliga: {
    name: 'La Liga',
    country: 'Spain',
    season: '2024-25',
    teams: [
      { id: '1', name: 'Real Madrid', shortName: 'RMA', position: 1, points: 43, played: 18, won: 13, drawn: 4, lost: 1, gf: 40, ga: 12 },
      { id: '2', name: 'Barcelona', shortName: 'BAR', position: 2, points: 41, played: 18, won: 13, drawn: 2, lost: 3, gf: 45, ga: 20 },
      { id: '3', name: 'Atletico Madrid', shortName: 'ATM', position: 3, points: 38, played: 18, won: 11, drawn: 5, lost: 2, gf: 32, ga: 15 },
    ],
    fixtures: [
      { id: '1', homeTeam: 'Barcelona', awayTeam: 'Real Madrid', kickoffAt: new Date().toISOString(), status: 'SCHEDULED', slug: 'barcelona-vs-real-madrid' },
    ],
  },
  ucl: {
    name: 'UEFA Champions League',
    country: 'Europe',
    season: '2024-25',
    teams: [
      { id: '1', name: 'Real Madrid', shortName: 'RMA', position: 1, points: 15, played: 6, won: 5, drawn: 0, lost: 1, gf: 15, ga: 5 },
      { id: '2', name: 'Bayern Munich', shortName: 'BAY', position: 2, points: 14, played: 6, won: 4, drawn: 2, lost: 0, gf: 18, ga: 6 },
      { id: '3', name: 'Manchester City', shortName: 'MCI', position: 3, points: 13, played: 6, won: 4, drawn: 1, lost: 1, gf: 14, ga: 7 },
    ],
    fixtures: [],
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const league = leagueData[slug]

  if (!league) {
    return { title: 'League Not Found' }
  }

  return {
    title: `${league.name} - ${league.season}`,
    description: `${league.name} standings, fixtures, and AI analysis for ${league.season} season`,
  }
}

export async function generateStaticParams() {
  return Object.keys(leagueData).map((slug) => ({ slug }))
}

export default async function LeaguePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const league = leagueData[slug]

  if (!league) {
    notFound()
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{league.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{league.country}</span>
              <span>•</span>
              <span>{league.season} 시즌</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="standings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="standings">순위표</TabsTrigger>
          <TabsTrigger value="fixtures">경기 일정</TabsTrigger>
          <TabsTrigger value="teams">팀 목록</TabsTrigger>
        </TabsList>

        {/* Standings */}
        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle>리그 순위</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">팀</th>
                      <th className="pb-3 pr-4 text-center">경기</th>
                      <th className="pb-3 pr-4 text-center">승</th>
                      <th className="pb-3 pr-4 text-center">무</th>
                      <th className="pb-3 pr-4 text-center">패</th>
                      <th className="pb-3 pr-4 text-center">득실</th>
                      <th className="pb-3 text-center">승점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.teams.map((team) => (
                      <tr key={team.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{team.position}</td>
                        <td className="py-3 pr-4">
                          <Link href={`/team/${team.id}`} className="flex items-center gap-2 hover:text-primary">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <span className="text-xs font-bold">{team.shortName}</span>
                            </div>
                            <span className="font-medium">{team.name}</span>
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-center">{team.played}</td>
                        <td className="py-3 pr-4 text-center">{team.won}</td>
                        <td className="py-3 pr-4 text-center">{team.drawn}</td>
                        <td className="py-3 pr-4 text-center">{team.lost}</td>
                        <td className="py-3 pr-4 text-center">{team.gf - team.ga > 0 ? '+' : ''}{team.gf - team.ga}</td>
                        <td className="py-3 text-center font-bold">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <div className="space-y-4">
            {league.fixtures.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">예정된 경기가 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              league.fixtures.map((fixture) => (
                <Link key={fixture.id} href={`/match/${slug}/${fixture.slug}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-1 items-center justify-end gap-2">
                          <span className="font-medium">{fixture.homeTeam}</span>
                        </div>
                        <div className="mx-4 flex items-center gap-2">
                          {fixture.status === 'SCHEDULED' ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(fixture.kickoffAt), 'HH:mm')}
                            </span>
                          ) : (
                            <span className="text-xl font-bold">
                              {fixture.homeScore} - {fixture.awayScore}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 items-center gap-2">
                          <span className="font-medium">{fixture.awayTeam}</span>
                        </div>
                        <Badge className={fixture.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}>
                          {fixture.status === 'LIVE' ? '진행중' : '예정'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        {/* Teams */}
        <TabsContent value="teams">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {league.teams.map((team) => (
              <Link key={team.id} href={`/team/${team.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center p-4">
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <span className="font-bold">{team.shortName}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {team.position}위 • {team.points}점
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

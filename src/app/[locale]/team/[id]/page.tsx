import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Trophy,
  Calendar,
  MapPin,
  TrendingUp,
  Building,
  Clock,
  Target,
  Shield,
  Users,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { unstable_cache } from 'next/cache'
import { generateMetadata as buildMetadata, generateTeamSEO, generateTeamJsonLd } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'
import { getDateLocale } from '@/lib/utils'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export const revalidate = CACHE_REVALIDATE

// 서버 공유 캐시 적용: 팀 데이터 조회
const getCachedTeamData = (id: string) => unstable_cache(
  async () => {
    try {
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          league: true,
          seasonStats: true,
          recentMatches: true,
          players: {
            orderBy: [
              { position: 'asc' },
              { shirtNumber: 'asc' },
            ],
          },
          homeMatches: {
            where: {
              kickoffAt: { gte: new Date() },
            },
            include: {
              awayTeam: true,
              league: true,
              matchAnalysis: true,
            },
            orderBy: { kickoffAt: 'asc' },
            take: 5,
          },
          awayMatches: {
            where: {
              kickoffAt: { gte: new Date() },
            },
            include: {
              homeTeam: true,
              league: true,
              matchAnalysis: true,
            },
            orderBy: { kickoffAt: 'asc' },
            take: 5,
          },
        },
      })

      return team
    } catch {
      return null
    }
  },
  [`team-page-data-${id}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const team = await getCachedTeamData(id)

  if (!team) {
    return { title: 'Team Not Found' }
  }

  const t = await getTranslations({ locale, namespace: 'team' })
  const recentForm = (team.seasonStats?.form || team.recentMatches?.recentForm) || undefined

  return buildMetadata(
    generateTeamSEO({
      name: team.name,
      league: team.league.name,
      translations: {
        description: t('seo_description', { name: team.name, recentForm: recentForm ? ` (${recentForm})` : '' }),
        keywords: [team.name, team.league.name, t('analysis'), t('squad'), t('tactics')],
      },
    })
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-primary',
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg bg-primary/10 p-2 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function TeamPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'team' })
  const tMatch = await getTranslations({ locale, namespace: 'match' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  const team = await getCachedTeamData(id)

  if (!team) {
    notFound()
  }

  const stats = team.seasonStats
  const recentMatches = team.recentMatches?.matchesJson as
    | Array<{
        date: string
        opponent: string
        opponentCrest?: string
        result: string
        score: string
        isHome: boolean
        competition?: string
      }>
    | undefined

  // 홈/원정 경기 합치기
  const upcomingMatches = [
    ...team.homeMatches.map((m) => ({
      ...m,
      isHome: true,
      opponent: m.awayTeam,
    })),
    ...team.awayMatches.map((m) => ({
      ...m,
      isHome: false,
      opponent: m.homeTeam,
    })),
  ].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())

  // JSON-LD structured data
  const jsonLd = generateTeamJsonLd({
    name: team.name,
    logoUrl: team.logoUrl || undefined,
    venue: team.venue || undefined,
    city: team.city || undefined,
    founded: team.founded || undefined,
  })

  return (
    <div className="container py-8">
      {/* Add JSON-LD to the page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Team Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            {team.logoUrl ? (
              <Image
                src={team.logoUrl}
                alt={team.name}
                width={96}
                height={96}
                className="rounded-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <span className="text-3xl font-bold">{team.tla || team.shortName}</span>
              </div>
            )}

            <div className="flex-1 text-center md:text-left">
              <Link
                href={`/league/${team.league.code?.toLowerCase() || 'epl'}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                <Trophy className="mr-1 inline h-4 w-4" />
                {team.league.name}
              </Link>
              <h1 className="text-3xl font-bold">{team.name}</h1>

              <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                {team.founded && (
                  <div className="flex items-center">
                    <Building className="mr-1 h-4 w-4" />
                    {t('founded_value', { year: team.founded })}
                  </div>
                )}
                {team.venue && (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {team.venue}
                  </div>
                )}
                {team.city && (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {team.city}
                  </div>
                )}
              </div>
            </div>

            {stats && (
              <div className="text-center">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {tMatch('rank_value', { rank: stats.rank || 0 })}
                  </Badge>
                  <Badge className="text-lg px-3 py-1">{tMatch('points_value', { points: stats.points || 0 })}</Badge>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">{tMatch('recent_form')}</p>
                <FormBadge form={stats.form || team.recentMatches?.recentForm || null} size="lg" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stats">{t('statistics')}</TabsTrigger>
          <TabsTrigger value="squad">{t('squad')}</TabsTrigger>
          <TabsTrigger value="recent">{t('results')}</TabsTrigger>
          <TabsTrigger value="fixtures">{t('fixtures')}</TabsTrigger>
        </TabsList>

        {/* Stats */}
        <TabsContent value="stats">
          {stats ? (
            <div className="space-y-6">
              {/* 기본 통계 */}
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard label={tMatch('games')} value={stats.gamesPlayed} icon={Calendar} />
                <StatCard label={tMatch('win')} value={stats.wins} icon={TrendingUp} color="text-green-500" />
                <StatCard label={tMatch('draw')} value={stats.draws || 0} icon={Target} color="text-gray-500" />
                <StatCard label={tMatch('loss')} value={stats.losses} icon={Shield} color="text-red-500" />
              </div>

              {/* 승률 & 득실점 */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* 승률 분석 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('win_rate_analysis')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 승/무/패 바 */}
                      <div className="flex h-4 overflow-hidden rounded-full">
                        <div
                          className="bg-green-500"
                          style={{ width: `${(stats.wins / stats.gamesPlayed) * 100}%` }}
                        />
                        <div
                          className="bg-gray-400"
                          style={{ width: `${((stats.draws || 0) / stats.gamesPlayed) * 100}%` }}
                        />
                        <div
                          className="bg-red-500"
                          style={{ width: `${(stats.losses / stats.gamesPlayed) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-500">
                          {tMatch('win')} {((stats.wins / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                        <span className="text-gray-500">
                          {tMatch('draw')} {(((stats.draws || 0) / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                        <span className="text-red-500">
                          {tMatch('loss')} {((stats.losses / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                      </div>
                      {/* 세부 지표 */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('avg_goals_scored')}</p>
                          <p className="text-2xl font-bold">
                            {((stats.goalsFor || 0) / stats.gamesPlayed).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('avg_goals_conceded')}</p>
                          <p className="text-2xl font-bold">
                            {((stats.goalsAgainst || 0) / stats.gamesPlayed).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 득실점 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{tMatch('goals_for_short')} / {tMatch('goals_against_short')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 득점 바 */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">{tMatch('goals_for')}</span>
                          <span className="font-bold text-green-600">{stats.goalsFor || 0}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${Math.min(((stats.goalsFor || 0) / Math.max(stats.goalsFor || 0, stats.goalsAgainst || 0, 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {/* 실점 바 */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">{tMatch('goals_against')}</span>
                          <span className="font-bold text-red-600">{stats.goalsAgainst || 0}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{
                              width: `${Math.min(((stats.goalsAgainst || 0) / Math.max(stats.goalsFor || 0, stats.goalsAgainst || 0, 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {/* 골득실 */}
                      <div className="pt-4 border-t text-center">
                        <p className="text-sm text-muted-foreground">{tMatch('goal_difference')}</p>
                        <p className={`text-3xl font-bold ${(stats.goalDifference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(stats.goalDifference || 0) > 0 ? '+' : ''}
                          {stats.goalDifference || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">{t('no_stats_data')}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('run_cron_message')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Squad */}
        <TabsContent value="squad">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('squad')}
                {team.players.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({t('players_count', { count: team.players.length })})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {team.players.length > 0 ? (
                <div className="space-y-6">
                  {/* 포지션별 그룹화 */}
                  {(['Goalkeeper', 'Defence', 'Midfield', 'Offence'] as const).map((positionGroup) => {
                    // 세부 포지션을 그룹으로 매핑
                    const positionMapping: Record<string, string[]> = {
                      Goalkeeper: ['Goalkeeper'],
                      Defence: ['Defence', 'Centre-Back', 'Left-Back', 'Right-Back'],
                      Midfield: ['Midfield', 'Central Midfield', 'Attacking Midfield', 'Defensive Midfield', 'Left Midfield', 'Right Midfield'],
                      Offence: ['Offence', 'Centre-Forward', 'Left Winger', 'Right Winger', 'Second Striker', 'Striker'],
                    }

                    const positionPlayers = team.players.filter((p) =>
                      positionMapping[positionGroup]?.includes(p.position || '')
                    )
                    if (positionPlayers.length === 0) return null

                    const positionLabels: Record<string, string> = {
                      Goalkeeper: tMatch('goalkeeper'),
                      Defence: tMatch('defender'),
                      Midfield: tMatch('midfielder'),
                      Offence: tMatch('forward'),
                    }

                    return (
                      <div key={positionGroup}>
                        <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${
                              positionGroup === 'Goalkeeper'
                                ? 'bg-yellow-500'
                                : positionGroup === 'Defence'
                                ? 'bg-blue-500'
                                : positionGroup === 'Midfield'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          {positionLabels[positionGroup]}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({positionPlayers.length})
                          </span>
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {positionPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {player.shirtNumber && (
                                    <span className="text-muted-foreground mr-2">#{player.shirtNumber}</span>
                                  )}
                                  {player.name}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {player.nationality}
                                  {player.birthDate && (
                                    <> · {t('age_value', { age: new Date().getFullYear() - new Date(player.birthDate).getFullYear() })}</>
                                  )}
                                </p>
                              </div>
                              {player.marketValue && (
                                <Badge variant="outline" className="shrink-0">
                                  €{(player.marketValue / 1000000).toFixed(1)}M
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t('no_squad_data')}
                  <br />
                  <span className="text-sm">{t('run_cron_message')}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Matches */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>{t('recent_match_results')}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMatches && recentMatches.length > 0 ? (
                <div className="space-y-3">
                  {recentMatches.slice(0, 10).map((match, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={match.isHome ? 'default' : 'outline'}
                          className="w-12 justify-center"
                        >
                          {match.isHome ? tMatch('home') : tMatch('away')}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {match.opponentCrest && (
                            <Image
                              src={match.opponentCrest}
                              alt={match.opponent}
                              width={24}
                              height={24}
                              className="rounded"
                            />
                          )}
                          <span className="font-medium">{match.opponent}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{match.score}</span>
                        <span
                          className={`w-8 h-8 flex items-center justify-center rounded text-white font-bold ${
                            match.result === 'W'
                              ? 'bg-green-500'
                              : match.result === 'D'
                              ? 'bg-gray-400'
                              : 'bg-red-500'
                          }`}
                        >
                          {match.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t('no_recent_matches')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                {t('fixtures')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMatches.length > 0 ? (
                <div className="space-y-4">
                  {upcomingMatches.map((match) => (
                    <Link key={match.id} href={`/match/${match.slug || match.id}`}>
                      <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted">
                        <div className="flex items-center gap-4">
                          <Badge variant={match.isHome ? 'default' : 'outline'}>
                            {match.isHome ? tMatch('home') : tMatch('away')}
                          </Badge>
                          <div className="flex items-center gap-2">
                            {match.opponent.logoUrl && (
                              <Image
                                src={match.opponent.logoUrl}
                                alt={match.opponent.name}
                                width={28}
                                height={28}
                                className="rounded"
                              />
                            )}
                            <span className="font-medium">vs {match.opponent.name}</span>
                          </div>
                          {match.matchAnalysis && (
                            <Badge variant="outline" className="text-xs">
                              {t('ai_analysis')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Clock className="mr-1 h-4 w-4" />
                            {(() => {
                              try {
                                const mediumFormat = tCommon('date_medium_format')
                                if (mediumFormat && mediumFormat !== 'date_medium_format') {
                                  return format(new Date(match.kickoffAt), mediumFormat, { locale: getDateLocale(locale) })
                                }
                                return format(new Date(match.kickoffAt), 'MMM d')
                              } catch {
                                return format(new Date(match.kickoffAt), 'MM-dd')
                              }
                            })()}
                          </div>
                          <Badge className="bg-blue-500">{tMatch('upcoming')}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t('no_fixtures')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

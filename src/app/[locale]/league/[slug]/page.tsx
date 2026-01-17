import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Calendar, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { unstable_cache } from 'next/cache'
import { generateMetadata as buildMetadata, generateLeagueSEO } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { getTranslations } from 'next-intl/server'
import { MATCH_STATUS_KEYS } from '@/lib/constants'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export const revalidate = CACHE_REVALIDATE

// Slug to competition code mapping
const SLUG_TO_CODE: Record<string, string> = {
  // 코드 기반 slug (소문자)
  pl: 'PL',
  pd: 'PD',
  sa: 'SA',
  bl1: 'BL1',
  fl1: 'FL1',
  cl: 'CL',
  ded: 'DED',
  ppl: 'PPL',
  // 기존 slug 호환
  epl: 'PL',
  laliga: 'PD',
  'serie-a': 'SA',
  bundesliga: 'BL1',
  ligue1: 'FL1',
  ucl: 'CL',
  eredivisie: 'DED',
  'primeira-liga': 'PPL',
}

// 챔피언스리그 로고 URL (DB에 없을 경우 대체)
const LEAGUE_LOGOS: Record<string, string> = {
  CL: 'https://crests.football-data.org/CL.png',
}

// 서버 공유 캐시 적용: 리그 데이터 조회
const getCachedLeagueData = unstable_cache(
  async (slug: string) => {
    const code = SLUG_TO_CODE[slug]
    if (!code) return null

    try {
      const league = await prisma.league.findFirst({
        where: { code },
        include: {
          teams: {
            include: {
              seasonStats: true,
            },
            orderBy: {
              seasonStats: {
                rank: 'asc',
              },
            },
          },
          matches: {
            where: {
              kickoffAt: {
                gte: new Date(),
              },
            },
            include: {
              homeTeam: true,
              awayTeam: true,
              matchAnalysis: true,
            },
            orderBy: {
              kickoffAt: 'asc',
            },
            take: 20,
          },
        },
      })

      return league
    } catch {
      return null
    }
  },
  ['league-page-data'],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)

// Types
type LeagueWithRelations = NonNullable<Awaited<ReturnType<typeof getCachedLeagueData>>>
type TeamWithStats = LeagueWithRelations['teams'][number]
type MatchWithRelations = LeagueWithRelations['matches'][number]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const league = await getCachedLeagueData(slug)

  if (!league) {
    return { title: 'League Not Found' }
  }

  const t = await getTranslations({ locale, namespace: 'league' })
  const seasonLabel = league.season ? String(league.season) : 'current'

  return buildMetadata(
    generateLeagueSEO({
      name: league.name,
      country: league.country || '',
      season: seasonLabel,
      translations: {
        title: t('seo_title', { name: league.name, season: seasonLabel }),
        description: t('seo_description', { name: league.name, season: seasonLabel }),
        keywords: [league.name, league.country || '', seasonLabel, t('standings'), t('fixtures')],
      },
    })
  )
}

export async function generateStaticParams() {
  return Object.keys(SLUG_TO_CODE).map((slug) => ({ slug }))
}

export default async function LeaguePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'match' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const league = await getCachedLeagueData(slug)

  if (!league) {
    notFound()
  }

  // 순위표 데이터 정리
  const standings = league.teams
    .filter((t): t is TeamWithStats & { seasonStats: NonNullable<TeamWithStats['seasonStats']> } => !!t.seasonStats)
    .sort((a, b) => (a.seasonStats.rank || 999) - (b.seasonStats.rank || 999))

  const logoUrl = league.logoUrl || LEAGUE_LOGOS[league.code || '']

  return (
    <div className="container py-8">
      {/* Back Navigation */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('back_to_leagues')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white overflow-hidden p-2">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={league.name}
                width={48}
                height={48}
                className="object-contain"
              />
            ) : (
              <Trophy className="h-8 w-8 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{league.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{league.country}</span>
              {league.currentMatchday && (
                <>
                  <span>•</span>
                  <span>{t('round')} {league.currentMatchday}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="standings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="standings">{t('standings')}</TabsTrigger>
          <TabsTrigger value="fixtures">{t('fixtures')}</TabsTrigger>
          <TabsTrigger value="teams">{t('teams')}</TabsTrigger>
        </TabsList>

        {/* Standings */}
        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('league_standings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('no_standings_data')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 pr-4">#</th>
                        <th className="pb-3 pr-4">{t('team')}</th>
                        <th className="pb-3 pr-4 text-center">{t('games')}</th>
                        <th className="pb-3 pr-4 text-center">{t('win')}</th>
                        <th className="pb-3 pr-4 text-center">{t('draw')}</th>
                        <th className="pb-3 pr-4 text-center">{t('loss')}</th>
                        <th className="pb-3 pr-4 text-center">{t('goals_for_short')}</th>
                        <th className="pb-3 pr-4 text-center">{t('goals_against_short')}</th>
                        <th className="pb-3 pr-4 text-center">{t('goal_difference_short')}</th>
                        <th className="pb-3 pr-4 text-center">{t('recent_form')}</th>
                        <th className="pb-3 text-center">{t('points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((team) => {
                        const stats = team.seasonStats
                        const gd = (stats.goalsFor || 0) - (stats.goalsAgainst || 0)

                        return (
                          <tr key={team.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 pr-4 font-medium">{stats.rank}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                {team.logoUrl ? (
                                  <Image
                                    src={team.logoUrl}
                                    alt={team.name}
                                    width={28}
                                    height={28}
                                    className="rounded"
                                  />
                                ) : (
                                  <div className="flex h-7 w-7 items-center justify-center rounded bg-muted">
                                    <span className="text-xs font-bold">{team.tla || team.shortName}</span>
                                  </div>
                                )}
                                <span className="font-medium">{team.name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-center">{stats.gamesPlayed}</td>
                            <td className="py-3 pr-4 text-center text-green-600">{stats.wins}</td>
                            <td className="py-3 pr-4 text-center text-gray-500">{stats.draws}</td>
                            <td className="py-3 pr-4 text-center text-red-600">{stats.losses}</td>
                            <td className="py-3 pr-4 text-center">{stats.goalsFor}</td>
                            <td className="py-3 pr-4 text-center">{stats.goalsAgainst}</td>
                            <td className="py-3 pr-4 text-center">
                              <span className={gd > 0 ? 'text-green-600' : gd < 0 ? 'text-red-600' : ''}>
                                {gd > 0 ? '+' : ''}
                                {gd}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <FormBadge form={stats.form} />
                            </td>
                            <td className="py-3 text-center font-bold text-lg">{stats.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <div className="space-y-4">
            {league.matches.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('no_matches_scheduled')}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('run_cron_message')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              league.matches.map((match: MatchWithRelations) => {
                const isFinished = match.status === 'FINISHED'
                const homeWins = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)
                const awayWins = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)

                return (
                  <Card key={match.id} className="transition-all hover:shadow-md hover:border-primary/50">
                    <CardContent className="p-4">
                      <Link href={`/match/${match.slug}`} className="block">
                        <div className="flex items-center justify-between">
                          {/* 홈팀 */}
                          <div className="flex flex-1 items-center justify-end gap-3">
                            <span className={`font-medium text-right ${homeWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.homeTeam.name}
                            </span>
                            {homeWins && <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            {match.homeTeam.logoUrl ? (
                              <Image
                                src={match.homeTeam.logoUrl}
                                alt={match.homeTeam.name}
                                width={32}
                                height={32}
                                className={`rounded ${isFinished && !homeWins ? 'grayscale opacity-70' : ''}`}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                                <span className="text-xs font-bold">{match.homeTeam.tla}</span>
                              </div>
                            )}
                          </div>

                          {/* 스코어/시간 */}
                          <div className="mx-6 flex flex-col items-center min-w-[100px]">
                            {match.status === 'FINISHED' ? (
                              <span className="text-2xl font-bold">
                                <span className={homeWins ? 'text-foreground' : 'text-muted-foreground'}>{match.homeScore}</span>
                                <span className="mx-1 text-muted-foreground">-</span>
                                <span className={awayWins ? 'text-foreground' : 'text-muted-foreground'}>{match.awayScore}</span>
                              </span>
                            ) : match.status === 'LIVE' ? (
                              <span className="text-2xl font-bold text-red-500">
                                {match.homeScore ?? 0} - {match.awayScore ?? 0}
                              </span>
                            ) : (
                              <span className="text-lg font-medium">
                                {format(new Date(match.kickoffAt), 'HH:mm')}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground mt-1">
                              {format(new Date(match.kickoffAt), tCommon('date_medium_format'), { locale: locale === 'ko' ? ko : undefined })}
                            </span>
                            {match.matchAnalysis && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {t('ai_analysis')}
                              </Badge>
                            )}
                          </div>

                          {/* 원정팀 */}
                          <div className="flex flex-1 items-center gap-3">
                            {match.awayTeam.logoUrl ? (
                              <Image
                                src={match.awayTeam.logoUrl}
                                alt={match.awayTeam.name}
                                width={32}
                                height={32}
                                className={`rounded ${isFinished && !awayWins ? 'grayscale opacity-70' : ''}`}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                                <span className="text-xs font-bold">{match.awayTeam.tla}</span>
                              </div>
                            )}
                            {awayWins && <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            <span className={`font-medium ${awayWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.awayTeam.name}
                            </span>
                          </div>

                          <MatchStatusBadge 
                            status={match.status} 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            label={t(MATCH_STATUS_KEYS[match.status] as any)} 
                          />
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Teams */}
        <TabsContent value="teams">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {league.teams.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <TrendingDown className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('no_teams_data')}</p>
                </CardContent>
              </Card>
            ) : (
              league.teams.map((team: TeamWithStats) => (
                <Card key={team.id} className="transition-all hover:shadow-md hover:border-primary/50">
                  <CardContent className="flex items-center p-4">
                    {team.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        width={48}
                        height={48}
                        className="mr-4 rounded"
                      />
                    ) : (
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <span className="font-bold">{team.tla || team.shortName}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{team.name}</h3>
                      {team.seasonStats && (
                        <p className="text-sm text-muted-foreground">
                          {team.seasonStats.rank}{t('rank')} • {team.seasonStats.points}{t('points')}
                        </p>
                      )}
                    </div>
                    {team.seasonStats?.form && (
                      <FormBadge form={team.seasonStats.form} />
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

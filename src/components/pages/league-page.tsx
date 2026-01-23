import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Calendar, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getTimezoneFromCookies } from '@/lib/timezone'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { unstable_cache } from 'next/cache'
import { generateMetadata as buildMetadata, generateLeagueSEO, resolveBaseUrl } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { getTranslations } from 'next-intl/server'
import { MATCH_STATUS_KEYS } from '@/lib/constants'
import { getDateLocale } from '@/lib/utils'
import { headers } from 'next/headers'
import { sportIdToEnum, type SportId } from '@/lib/sport'
import type { SportType } from '@prisma/client'
import { type Locale } from '@/i18n/config'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// Football Slug to competition code mapping
const FOOTBALL_SLUG_TO_CODE: Record<string, string> = {
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

// Basketball Slug to code mapping
const BASKETBALL_SLUG_TO_CODE: Record<string, string> = {
  nba: 'NBA',
}

// Baseball Slug to code mapping
const BASEBALL_SLUG_TO_CODE: Record<string, string> = {
  mlb: 'MLB',
}

// 챔피언스리그 로고 URL (DB에 없을 경우 대체)
const LEAGUE_LOGOS: Record<string, string> = {
  CL: 'https://crests.football-data.org/CL.png',
  NBA: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  MLB: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
}

// Get code from slug based on sport
function getCodeFromSlug(slug: string, sport: SportId): string | null {
  if (sport === 'basketball') {
    return BASKETBALL_SLUG_TO_CODE[slug] || slug.toUpperCase()
  }
  if (sport === 'baseball') {
    return BASEBALL_SLUG_TO_CODE[slug] || slug.toUpperCase()
  }
  return FOOTBALL_SLUG_TO_CODE[slug] || null
}

// 서버 공유 캐시 적용: 리그 데이터 조회
export const getCachedLeagueData = (slug: string, sportType: SportType) => unstable_cache(
  async () => {
    const sportId = sportType.toLowerCase() as SportId
    const code = getCodeFromSlug(slug, sportId)
    if (!code) return null

    try {
      const league = await prisma.league.findFirst({
        where: { code, sportType },
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
  [`league-page-data-${sportType}-${slug}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

// Types
type LeagueWithRelations = NonNullable<Awaited<ReturnType<typeof getCachedLeagueData>>>
type TeamWithStats = LeagueWithRelations['teams'][number]
type MatchWithRelations = LeagueWithRelations['matches'][number]

export async function generateLeagueMetadata({ params, sport }: { params: Props['params']; sport: SportId }): Promise<Metadata> {
  const { slug, locale } = await params
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)
  const sportType = sportIdToEnum(sport)

  const league = await getCachedLeagueData(slug, sportType)

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
    }),
    { path: `/${sport}/league/${slug}`, locale: locale as Locale, baseUrl }
  )
}

export default async function LeaguePageContent({ params, sport }: { params: Props['params']; sport: SportId }) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  // 타임존 가져오기
  const cookieStore = await cookies()
  const timezone = getTimezoneFromCookies(cookieStore.get('timezone')?.value || null)

  const sportType = sportIdToEnum(sport)

  const tMatch = await getTranslations({ locale, namespace: 'match' })
  const tLeague = await getTranslations({ locale, namespace: 'league' })
  const tHome = await getTranslations({ locale, namespace: 'home' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const league = await getCachedLeagueData(slug, sportType)

  if (!league) {
    notFound()
  }

  const isBasketball = sportType === 'BASKETBALL'
  const isBaseball = sportType === 'BASEBALL'
  const isFootball = sportType === 'FOOTBALL'

  // 순위표 데이터 정리
  const standings = league.teams
    .filter((t): t is TeamWithStats & { seasonStats: NonNullable<TeamWithStats['seasonStats']> } => !!t.seasonStats)
    .sort((a, b) => (a.seasonStats.rank || 999) - (b.seasonStats.rank || 999))

  // 농구: 컨퍼런스별 그룹핑
  const getConference = (team: typeof standings[number]) => {
    const additional = team.seasonStats.additionalStats as { conference?: string } | null
    return additional?.conference || 'Unknown'
  }

  const eastTeams = isBasketball
    ? standings
        .filter(t => getConference(t) === 'East')
        .map((t, i) => ({ ...t, conferenceRank: i + 1 }))
    : []

  const westTeams = isBasketball
    ? standings
        .filter(t => getConference(t) === 'West')
        .map((t, i) => ({ ...t, conferenceRank: i + 1 }))
    : []

  const logoUrl = league.logoUrl || LEAGUE_LOGOS[league.code || '']

  return (
    <div className="container py-8">
      {/* Back Navigation */}
      <div className="mb-4">
        <Link
          href={`/${sport}/leagues`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {tMatch('back_to_leagues')}
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
                  <span>{tLeague('round')} {league.currentMatchday}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="standings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="standings">{tLeague('standings')}</TabsTrigger>
          <TabsTrigger value="fixtures">{tLeague('fixtures')}</TabsTrigger>
          <TabsTrigger value="teams">{tLeague('teams')}</TabsTrigger>
        </TabsList>

        {/* Standings */}
        <TabsContent value="standings">
          {standings.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  {tMatch('no_standings_data')}
                </p>
              </CardContent>
            </Card>
          ) : isBasketball ? (
            /* 농구: 컨퍼런스별 탭 */
            <Tabs defaultValue="east" className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="east">Eastern Conference</TabsTrigger>
                <TabsTrigger value="west">Western Conference</TabsTrigger>
              </TabsList>

              {/* Eastern Conference */}
              <TabsContent value="east">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5" />
                      Eastern Conference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tLeague('rank')}</th>
                            <th className="pb-2 pr-1 sm:pr-4">{tMatch('team')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('games')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('win')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('loss')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">PCT</th>
                            <th className="pb-2 text-center hidden sm:table-cell">{tMatch('recent_form')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eastTeams.map((team) => {
                            const stats = team.seasonStats
                            const winPct = stats.gamesPlayed > 0
                              ? (stats.wins / stats.gamesPlayed).toFixed(3).replace(/^0/, '')
                              : '.000'
                            const rank = team.conferenceRank
                            const rankDisplay = rank === 1 ? '1' : rank === 2 ? '2' : rank === 3 ? '3' : rank

                            return (
                              <tr key={team.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center font-medium">{rankDisplay}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4">
                                  <Link href={`/basketball/team/${team.id}`} className="flex items-center gap-1 sm:gap-2 hover:text-primary">
                                    {team.logoUrl ? (
                                      <Image src={team.logoUrl} alt={team.name} width={28} height={28} className="rounded h-5 w-5 sm:h-7 sm:w-7" />
                                    ) : (
                                      <div className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded bg-muted">
                                        <span className="text-[10px] sm:text-xs font-bold">{team.tla || team.shortName}</span>
                                      </div>
                                    )}
                                    <span className="sm:hidden font-medium truncate max-w-[80px]">{team.shortName || team.name}</span>
                                    <span className="hidden sm:inline font-medium">{team.name}</span>
                                  </Link>
                                </td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center">{stats.gamesPlayed}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center text-green-600">{stats.wins}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center text-red-600">{stats.losses}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center font-medium">{winPct}</td>
                                <td className="py-2 sm:py-3 hidden sm:table-cell">
                                  <div className="flex justify-center">
                                    <FormBadge form={stats.form} size="sm" />
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Western Conference */}
              <TabsContent value="west">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5" />
                      Western Conference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tLeague('rank')}</th>
                            <th className="pb-2 pr-1 sm:pr-4">{tMatch('team')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('games')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('win')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">{tMatch('loss')}</th>
                            <th className="pb-2 pr-1 sm:pr-4 text-center">PCT</th>
                            <th className="pb-2 text-center hidden sm:table-cell">{tMatch('recent_form')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {westTeams.map((team) => {
                            const stats = team.seasonStats
                            const winPct = stats.gamesPlayed > 0
                              ? (stats.wins / stats.gamesPlayed).toFixed(3).replace(/^0/, '')
                              : '.000'
                            const rank = team.conferenceRank
                            const rankDisplay = rank === 1 ? '1' : rank === 2 ? '2' : rank === 3 ? '3' : rank

                            return (
                              <tr key={team.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center font-medium">{rankDisplay}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4">
                                  <Link href={`/basketball/team/${team.id}`} className="flex items-center gap-1 sm:gap-2 hover:text-primary">
                                    {team.logoUrl ? (
                                      <Image src={team.logoUrl} alt={team.name} width={28} height={28} className="rounded h-5 w-5 sm:h-7 sm:w-7" />
                                    ) : (
                                      <div className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded bg-muted">
                                        <span className="text-[10px] sm:text-xs font-bold">{team.tla || team.shortName}</span>
                                      </div>
                                    )}
                                    <span className="sm:hidden font-medium truncate max-w-[80px]">{team.shortName || team.name}</span>
                                    <span className="hidden sm:inline font-medium">{team.name}</span>
                                  </Link>
                                </td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center">{stats.gamesPlayed}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center text-green-600">{stats.wins}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center text-red-600">{stats.losses}</td>
                                <td className="py-2 sm:py-3 pr-1 sm:pr-4 text-center font-medium">{winPct}</td>
                                <td className="py-2 sm:py-3 hidden sm:table-cell">
                                  <div className="flex justify-center">
                                    <FormBadge form={stats.form} size="sm" />
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            /* 축구/야구: 일반 순위표 */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {tMatch('league_standings')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 pr-4 text-center">{tLeague('rank')}</th>
                        <th className="pb-3 pr-4">{tMatch('team')}</th>
                        <th className="pb-3 pr-4 text-center">{tMatch('games')}</th>
                        <th className="pb-3 pr-4 text-center">{tMatch('win')}</th>
                        {isFootball && <th className="pb-3 pr-4 text-center">{tMatch('draw')}</th>}
                        <th className="pb-3 pr-4 text-center">{tMatch('loss')}</th>
                        {isFootball && (
                          <>
                            <th className="pb-3 pr-4 text-center">{tMatch('goals_for_short')}</th>
                            <th className="pb-3 pr-4 text-center">{tMatch('goals_against_short')}</th>
                            <th className="pb-3 pr-4 text-center">{tMatch('goal_difference_short')}</th>
                          </>
                        )}
                        {isBaseball && <th className="pb-3 pr-4 text-center">PCT</th>}
                        <th className="pb-3 pr-4 text-center">{tMatch('recent_form')}</th>
                        {isFootball && <th className="pb-3 text-center">{tMatch('points')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((team) => {
                        const stats = team.seasonStats
                        const gd = (stats.goalsFor || 0) - (stats.goalsAgainst || 0)
                        const winPct = stats.gamesPlayed > 0
                          ? (stats.wins / stats.gamesPlayed).toFixed(3).replace(/^0/, '')
                          : '.000'
                        const rankDisplay = stats.rank

                        return (
                          <tr key={team.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 pr-4 text-center font-medium">{rankDisplay}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                {team.logoUrl ? (
                                  <Image src={team.logoUrl} alt={team.name} width={28} height={28} className="rounded" />
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
                            {isFootball && <td className="py-3 pr-4 text-center text-gray-500">{stats.draws}</td>}
                            <td className="py-3 pr-4 text-center text-red-600">{stats.losses}</td>
                            {isFootball && (
                              <>
                                <td className="py-3 pr-4 text-center">{stats.goalsFor}</td>
                                <td className="py-3 pr-4 text-center">{stats.goalsAgainst}</td>
                                <td className="py-3 pr-4 text-center">
                                  <span className={gd > 0 ? 'text-green-600' : gd < 0 ? 'text-red-600' : ''}>
                                    {gd > 0 ? '+' : ''}{gd}
                                  </span>
                                </td>
                              </>
                            )}
                            {isBaseball && <td className="py-3 pr-4 text-center font-medium">{winPct}</td>}
                            <td className="py-3 pr-4">
                              <div className="flex justify-center">
                                <FormBadge form={stats.form} />
                              </div>
                            </td>
                            {isFootball && <td className="py-3 text-center font-bold text-lg">{stats.points}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <div className="space-y-4">
            {league.matches.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">{tHome('no_matches_scheduled')}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {tHome('run_cron_message')}
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
                    <CardContent className="p-2 sm:p-4">
                      <Link href={`/${sport}/match/${match.slug}`} className="block">
                        <div className="flex items-center justify-between">
                          {/* 홈팀 */}
                          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-3 min-w-0">
                            <span className={`sm:hidden text-xs font-medium text-right truncate ${homeWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.homeTeam.shortName || match.homeTeam.name}
                            </span>
                            <span className={`hidden sm:inline text-base font-medium text-right ${homeWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.homeTeam.name}
                            </span>
                            {homeWins && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                            {match.homeTeam.logoUrl ? (
                              <Image
                                src={match.homeTeam.logoUrl}
                                alt={match.homeTeam.name}
                                width={32}
                                height={32}
                                className={`rounded h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${isFinished && !homeWins ? 'grayscale opacity-70' : ''}`}
                              />
                            ) : (
                              <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded bg-muted shrink-0">
                                <span className="text-[10px] sm:text-xs font-bold">{match.homeTeam.tla}</span>
                              </div>
                            )}
                          </div>

                          {/* 스코어/시간 */}
                          <div className="mx-2 sm:mx-6 flex flex-col items-center min-w-[60px] sm:min-w-[100px] shrink-0">
                            {match.status === 'FINISHED' ? (
                              <span className="text-lg sm:text-2xl font-bold">
                                <span className={homeWins ? 'text-foreground' : 'text-muted-foreground'}>{match.homeScore}</span>
                                <span className="mx-1 text-muted-foreground">-</span>
                                <span className={awayWins ? 'text-foreground' : 'text-muted-foreground'}>{match.awayScore}</span>
                              </span>
                            ) : match.status === 'LIVE' ? (
                              <span className="text-lg sm:text-2xl font-bold text-red-500">
                                {match.homeScore ?? 0} - {match.awayScore ?? 0}
                              </span>
                            ) : (
                              <span className="text-base sm:text-lg font-medium">
                                {formatInTimeZone(new Date(match.kickoffAt), timezone, 'HH:mm')}
                              </span>
                            )}
                            <span className="text-[10px] sm:text-xs text-muted-foreground mt-1">
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
                            </span>
                            {match.matchAnalysis && (
                              <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs bg-primary/10 text-primary border-primary/30">
                                {tMatch('ai_analysis')}
                              </Badge>
                            )}
                          </div>

                          {/* 원정팀 */}
                          <div className="flex flex-1 items-center gap-1 sm:gap-3 min-w-0">
                            {match.awayTeam.logoUrl ? (
                              <Image
                                src={match.awayTeam.logoUrl}
                                alt={match.awayTeam.name}
                                width={32}
                                height={32}
                                className={`rounded h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${isFinished && !awayWins ? 'grayscale opacity-70' : ''}`}
                              />
                            ) : (
                              <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded bg-muted shrink-0">
                                <span className="text-[10px] sm:text-xs font-bold">{match.awayTeam.tla}</span>
                              </div>
                            )}
                            {awayWins && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                            <span className={`sm:hidden text-xs font-medium truncate ${awayWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.awayTeam.shortName || match.awayTeam.name}
                            </span>
                            <span className={`hidden sm:inline text-base font-medium ${awayWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                              {match.awayTeam.name}
                            </span>
                          </div>

                          <div className="hidden sm:block">
                            <MatchStatusBadge
                              status={match.status}
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              label={tMatch(MATCH_STATUS_KEYS[match.status] as any)}
                            />
                          </div>
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
          <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {league.teams.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <TrendingDown className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">{tMatch('no_teams_data')}</p>
                </CardContent>
              </Card>
            ) : (
              league.teams.map((team: TeamWithStats) => (
                <Card key={team.id} className="transition-all hover:shadow-md hover:border-primary/50">
                  <CardContent className="flex items-center p-2 sm:p-4">
                    {team.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        width={48}
                        height={48}
                        className="mr-2 sm:mr-4 rounded h-8 w-8 sm:h-12 sm:w-12"
                      />
                    ) : (
                      <div className="mr-2 sm:mr-4 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-muted">
                        <span className="text-xs sm:text-base font-bold">{team.tla || team.shortName}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="sm:hidden text-xs font-semibold truncate">{team.shortName || team.name}</h3>
                      <h3 className="hidden sm:block font-semibold">{team.name}</h3>
                      {team.seasonStats && (
                        <p className="text-[10px] sm:text-sm text-muted-foreground">
                          {team.seasonStats.rank}{tMatch('rank')} • {team.seasonStats.points}{tMatch('points')}
                        </p>
                      )}
                    </div>
                    {team.seasonStats?.form && (
                      <FormBadge form={team.seasonStats.form} size="sm" className="hidden sm:flex" />
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

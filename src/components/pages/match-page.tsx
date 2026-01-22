import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChartBar,
  ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { generateMetadata as buildMetadata, generateMatchSEO, generateMatchJsonLd, resolveBaseUrl } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { MATCH_STATUS_KEYS } from '@/lib/constants'
import { unstable_cache } from 'next/cache'
import { getDateLocale } from '@/lib/utils'
import { type Locale } from '@/i18n/config'
import { headers } from 'next/headers'

export const revalidate = CACHE_REVALIDATE

// 서버 공유 캐시 적용: 개별 경기 데이터
export const getCachedMatch = (slug: string) => unstable_cache(
  async () => {
    try {
      return await prisma.match.findUnique({
        where: { slug },
        include: {
          homeTeam: {
            include: {
              seasonStats: true,
            },
          },
          awayTeam: {
            include: {
              seasonStats: true,
            },
          },
          league: true,
          matchAnalysis: true,
        },
      })
    } catch {
      return null
    }
  },
  [`match-detail-data-${slug}`],
  { revalidate: CACHE_REVALIDATE, tags: ['match-detail'] }
)()

// 마크다운 **bold** 텍스트를 일반 텍스트로 변환
function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1')
}

interface Props {
  params: Promise<{ locale: string; slug: string }>
  searchParams?: Promise<{ from?: string }>
  sport: string
}

type MatchWithRelations = NonNullable<Awaited<ReturnType<typeof getCachedMatch>>>

export async function generateMatchMetadata({ params, sport }: { params: Promise<{ locale: string; slug: string }>; sport: string }): Promise<Metadata> {
  const { slug, locale } = await params
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)
  const match = await getCachedMatch(slug)

  if (!match) {
    return { title: 'Match Not Found' }
  }

  const t = await getTranslations({ locale, namespace: 'match' })
  const dateFormatted = format(new Date(match.kickoffAt), 'yyyy-MM-dd')

  return buildMetadata(
    generateMatchSEO({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      league: match.league.name,
      date: dateFormatted,
      hasAnalysis: Boolean(match.matchAnalysis),
      translations: {
        description: match.matchAnalysis
          ? t('seo_description_with_analysis', { homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name })
          : t('seo_description_no_analysis', { league: match.league.name, date: dateFormatted, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name }),
        keywords: [match.homeTeam.name, match.awayTeam.name, match.league.name, t('analysis'), t('preview'), t('tactics')],
      },
    }),
    { path: `/${sport}/match/${slug}`, locale: locale as Locale, baseUrl }
  )
}

export default async function MatchPageContent({ params, searchParams, sport }: Props) {
  const { locale, slug } = await params
  const { from } = searchParams ? await searchParams : { from: undefined }
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'match' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const initialMatch = await getCachedMatch(slug)

  if (!initialMatch) {
    notFound()
  }

  const match = initialMatch

  let kickoffDate = format(new Date(match.kickoffAt), 'yyyy-MM-dd')
  try {
    const fullFormat = tCommon('date_full_format')
    if (fullFormat && fullFormat !== 'date_full_format') {
      kickoffDate = format(new Date(match.kickoffAt), fullFormat, { locale: getDateLocale(locale) })
    }
  } catch {
    // Fallback set above
  }
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')

  // Get status label
  const statusKey = MATCH_STATUS_KEYS[match.status] || 'upcoming'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusLabel = t(statusKey as any)

  // Parse AI analysis if available
  const analysis = match.matchAnalysis
  let parsedAnalysis: {
    summary?: string
    recentFlowAnalysis?: string
    seasonTrends?: string
    tacticalAnalysis?: string
    keyPoints?: string[]
  } | null = null

  if (analysis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations = (analysis.translations as any) || {}
    const langData = translations[locale] || translations['en'] || {}

    const hasTranslationData = langData.summary || langData.recentFlowAnalysis ||
      langData.seasonTrends || langData.tacticalAnalysis || langData.keyPoints

    const extractNestedText = (data: unknown): string | undefined => {
      if (!data) return undefined
      if (typeof data === 'string') {
        const trimmed = data.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            return extractNestedText(parsed)
          } catch {
            return data
          }
        }
        return data
      }
      if (typeof data === 'object' && data !== null) {
        const values = Object.values(data as Record<string, unknown>)
        const stringParts: string[] = []
        for (const val of values) {
          if (typeof val === 'string') {
            stringParts.push(val)
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            const nestedText = extractNestedText(val)
            if (nestedText) stringParts.push(nestedText)
          }
        }
        if (stringParts.length > 0) {
          return stringParts.join('\n\n')
        }
      }
      return undefined
    }

    const extractKeyPoints = (data: unknown): string[] | undefined => {
      if (!data) return undefined
      if (Array.isArray(data)) return data.filter((item): item is string => typeof item === 'string')
      if (typeof data === 'string') {
        const trimmed = data.trim()
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
              return parsed.filter((item): item is string => typeof item === 'string')
            }
          } catch {
            // Not valid JSON
          }
        }
        return undefined
      }
      if (typeof data === 'object' && data !== null) {
        const values = Object.values(data as Record<string, unknown>)
          .filter((v): v is string => typeof v === 'string')
        if (values.length > 0) return values
      }
      return undefined
    }

    const tryParseJsonSummary = (summary: unknown): Record<string, unknown> | null => {
      if (typeof summary !== 'string') return null
      const trimmed = summary.trim()
      if (!trimmed.startsWith('{')) return null
      try {
        return JSON.parse(trimmed)
      } catch {
        return null
      }
    }

    const jsonFromSummary = tryParseJsonSummary(langData.summary)

    const getSummary = () => {
      if (jsonFromSummary) {
        return extractNestedText(
          jsonFromSummary.summary ||
          jsonFromSummary['3줄 요약'] ||
          jsonFromSummary['3_line_summary']
        )
      }
      return langData.summary || undefined
    }

    const getRecentFlowAnalysis = () => {
      if (jsonFromSummary) {
        return extractNestedText(
          jsonFromSummary.recentFlowAnalysis ||
          jsonFromSummary.recent_5_matches_flow_analysis ||
          jsonFromSummary['최근 5경기 흐름 분석']
        )
      }
      return langData.recentFlowAnalysis ||
        extractNestedText(langData.recent_5_matches_flow_analysis) ||
        undefined
    }

    const getSeasonTrends = () => {
      if (jsonFromSummary) {
        return extractNestedText(
          jsonFromSummary.seasonTrends ||
          jsonFromSummary.season_overall_trends ||
          jsonFromSummary['시즌 전체 성향 요약']
        )
      }
      return langData.seasonTrends ||
        extractNestedText(langData.season_overall_trends) ||
        undefined
    }

    const getTacticalAnalysis = () => {
      if (jsonFromSummary) {
        return extractNestedText(
          jsonFromSummary.tacticalAnalysis ||
          jsonFromSummary.tactical_perspective_based_on_home_away ||
          jsonFromSummary['홈/원정 기반의 전술적 관점']
        )
      }
      return langData.tacticalAnalysis ||
        extractNestedText(langData.tactical_perspective_based_on_home_away) ||
        undefined
    }

    const getKeyPoints = () => {
      if (jsonFromSummary) {
        return extractKeyPoints(
          jsonFromSummary.keyPoints ||
          jsonFromSummary.key_viewing_points ||
          jsonFromSummary['주요 관전 포인트'] ||
          jsonFromSummary['3_key_viewing_points']
        )
      }
      return extractKeyPoints(langData.keyPoints) ||
        extractKeyPoints(langData.key_viewing_points) ||
        undefined
    }

    const rawParsed = {
      summary: getSummary(),
      recentFlowAnalysis: getRecentFlowAnalysis(),
      seasonTrends: getSeasonTrends(),
      tacticalAnalysis: getTacticalAnalysis(),
      keyPoints: getKeyPoints(),
    }

    const hasContent = rawParsed.summary ||
      rawParsed.recentFlowAnalysis ||
      rawParsed.seasonTrends ||
      rawParsed.tacticalAnalysis ||
      (rawParsed.keyPoints && rawParsed.keyPoints.length > 0)

    if (hasContent) {
      parsedAnalysis = rawParsed
    }
  }

  // JSON-LD structured data
  const jsonLd = generateMatchJsonLd({
    id: match.id,
    homeTeam: { name: match.homeTeam.name, logoUrl: match.homeTeam.logoUrl || undefined },
    awayTeam: { name: match.awayTeam.name, logoUrl: match.awayTeam.logoUrl || undefined },
    league: match.league.name,
    kickoffAt: new Date(match.kickoffAt).toISOString(),
    venue: match.venue || undefined,
    status: match.status,
    homeScore: match.homeScore ?? undefined,
    awayScore: match.awayScore ?? undefined,
  })

  // 뒤로가기 경로 결정
  const backPath = from?.startsWith('/daily/') ? from : `/${sport}/matches`

  return (
    <div className="container py-8">
      {/* Add JSON-LD to the page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Back Navigation */}
      <div className="mb-4">
        <Link
          href={backPath}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('back_to_list')}
        </Link>
      </div>

      {/* Match Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {match.league.logoUrl && (
                <Image
                  src={match.league.logoUrl}
                  alt={match.league.name}
                  width={24}
                  height={24}
                  className="rounded"
                />
              )}
              <span className="text-sm text-muted-foreground">{match.league.name}</span>
              {match.matchday && (
                <span className="text-sm text-muted-foreground">• {t('round')} {match.matchday}</span>
              )}
            </div>
            <MatchStatusBadge status={match.status} label={statusLabel} />
          </div>

          <div className="flex items-center justify-between">
            {/* Home Team */}
            <div className="flex flex-1 flex-col items-center min-w-0">
              <div className="flex flex-col items-center w-full">
                {match.homeTeam.logoUrl ? (
                  <Image
                    src={match.homeTeam.logoUrl}
                    alt={match.homeTeam.name}
                    width={80}
                    height={80}
                    className="mb-2 rounded h-12 w-12 sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="mb-2 flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm sm:text-xl font-bold">{match.homeTeam.tla || match.homeTeam.shortName}</span>
                  </div>
                )}
                <h2 className="text-sm sm:text-xl font-bold text-center break-words w-full">{match.homeTeam.name}</h2>
              </div>
              <FormBadge form={match.homeTeam.seasonStats?.form || null} className="mt-2" />
            </div>

            {/* Score / Time */}
            <div className="flex flex-col items-center px-2 sm:px-8 shrink-0">
              {match.status === 'SCHEDULED' || match.status === 'TIMED' ? (
                <>
                  <span className="text-2xl sm:text-4xl font-bold">VS</span>
                  <div className="mt-2 flex items-center text-xs sm:text-sm text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    {kickoffTime}
                  </div>
                </>
              ) : (
                <span className="text-3xl sm:text-5xl font-bold">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-1 flex-col items-center min-w-0">
              <div className="flex flex-col items-center w-full">
                {match.awayTeam.logoUrl ? (
                  <Image
                    src={match.awayTeam.logoUrl}
                    alt={match.awayTeam.name}
                    width={80}
                    height={80}
                    className="mb-2 rounded h-12 w-12 sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="mb-2 flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm sm:text-xl font-bold">{match.awayTeam.tla || match.awayTeam.shortName}</span>
                  </div>
                )}
                <h2 className="text-sm sm:text-xl font-bold text-center break-words w-full">{match.awayTeam.name}</h2>
              </div>
              <FormBadge form={match.awayTeam.seasonStats?.form || null} className="mt-2" />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div>{kickoffDate}</div>
            {match.matchAnalysis && (
              <div className="text-primary">{t('ai_analysis_completed')}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Content */}
      {parsedAnalysis ? (
        <Tabs defaultValue="analysis" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analysis">{t('ai_analysis')}</TabsTrigger>
            <TabsTrigger value="tactical">{t('tactics')}</TabsTrigger>
            <TabsTrigger value="stats">{t('team_stats')}</TabsTrigger>
          </TabsList>

          {/* AI Analysis */}
          <TabsContent value="analysis" className="space-y-6">
            {parsedAnalysis.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ChartBar className="mr-2 h-5 w-5" />
                    {t('three_line_summary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-muted-foreground">{stripMarkdownBold(parsedAnalysis.summary)}</p>
                </CardContent>
              </Card>
            )}

            {parsedAnalysis.recentFlowAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    {t('recent_5_games_analysis')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-muted-foreground">{stripMarkdownBold(parsedAnalysis.recentFlowAnalysis)}</p>
                </CardContent>
              </Card>
            )}

            {parsedAnalysis.seasonTrends && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ChartBar className="mr-2 h-5 w-5" />
                    {t('season_trends')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-muted-foreground">{stripMarkdownBold(parsedAnalysis.seasonTrends)}</p>
                </CardContent>
              </Card>
            )}

            {parsedAnalysis.keyPoints && parsedAnalysis.keyPoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                    {t('key_viewing_points')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {parsedAnalysis.keyPoints.map((point, i) => {
                      const formattedPoint = point.split(/\*\*([^*]+)\*\*/).map((part, j) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                      )
                      return (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <span>{formattedPoint}</span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tactical Analysis */}
          <TabsContent value="tactical">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  {t('tactical_analysis')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {parsedAnalysis.tacticalAnalysis ? (
                  <p className="whitespace-pre-line text-muted-foreground">{stripMarkdownBold(parsedAnalysis.tacticalAnalysis)}</p>
                ) : (
                  <p className="text-center text-muted-foreground">{t('no_tactical_data')}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Stats */}
          <TabsContent value="stats">
            <div className="grid gap-6 md:grid-cols-2">
              <TeamStatsCard team={match.homeTeam} title={t('home_team')} translations={t} />
              <TeamStatsCard team={match.awayTeam} title={t('away_team')} translations={t} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('no_analysis_yet')}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('analysis_auto_generate')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

type TranslationFunction = Awaited<ReturnType<typeof getTranslations<'match'>>>

function TeamStatsCard({ team, title, translations: t }: { team: MatchWithRelations['homeTeam']; title: string; translations: TranslationFunction }) {
  const stats = team.seasonStats

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {team.logoUrl && (
              <Image src={team.logoUrl} alt={team.name} width={24} height={24} className="rounded" />
            )}
            {title}: {team.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{t('no_season_stats')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {team.logoUrl && (
            <Image src={team.logoUrl} alt={team.name} width={24} height={24} className="rounded" />
          )}
          {title}: {team.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{stats.rank || '-'}</p>
            <p className="text-xs text-muted-foreground">{t('rank')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.points || 0}</p>
            <p className="text-xs text-muted-foreground">{t('points')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.gamesPlayed || 0}</p>
            <p className="text-xs text-muted-foreground">{t('games')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.wins || 0}</p>
            <p className="text-xs text-muted-foreground">{t('win')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-500">{stats.draws || 0}</p>
            <p className="text-xs text-muted-foreground">{t('draw')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.losses || 0}</p>
            <p className="text-xs text-muted-foreground">{t('loss')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.goalsFor || 0}</p>
            <p className="text-xs text-muted-foreground">{t('goals_for')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.goalsAgainst || 0}</p>
            <p className="text-xs text-muted-foreground">{t('goals_against')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {((stats.goalsFor || 0) - (stats.goalsAgainst || 0)) > 0 ? '+' : ''}
              {(stats.goalsFor || 0) - (stats.goalsAgainst || 0)}
            </p>
            <p className="text-xs text-muted-foreground">{t('goal_difference')}</p>
          </div>
        </div>
        {stats.form && (
          <div className="mt-4 flex justify-center">
            <FormBadge form={stats.form} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

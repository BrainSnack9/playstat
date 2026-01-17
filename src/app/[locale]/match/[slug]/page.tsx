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
import { ko, enUS } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { generateMetadata as buildMetadata, generateMatchSEO, generateMatchJsonLd } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { MATCH_STATUS_KEYS } from '@/lib/constants'
import { ensureMatchAnalysisTranslations } from '@/lib/ai/translate'
import { unstable_cache } from 'next/cache'

export const revalidate = CACHE_REVALIDATE

// 서버 공유 캐시 적용: 개별 경기 데이터
const getCachedMatch = unstable_cache(
  async (slug: string) => {
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
  ['match-detail-data'],
  { revalidate: CACHE_REVALIDATE, tags: ['match-detail'] }
)

// 마크다운 **bold** 텍스트를 일반 텍스트로 변환
function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1')
}

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

type MatchWithRelations = NonNullable<Awaited<ReturnType<typeof getCachedMatch>>>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const match = await getCachedMatch(slug)

  if (!match) {
    return { title: 'Match Not Found' }
  }

  const localeCode = locale === 'ko' ? 'ko_KR' : 'en_US'

  return buildMetadata(
    generateMatchSEO({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      league: match.league.name,
      date: new Date(match.kickoffAt).toISOString(),
      hasAnalysis: Boolean(match.matchAnalysis),
      locale: localeCode,
    })
  )
}

export default async function MatchPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'match' })
  const initialMatch = await getCachedMatch(slug)

  if (!initialMatch) {
    notFound()
  }

  // 다국어 번역 데이터 확인 및 생성 (없을 경우에만)
  const match = initialMatch.matchAnalysis 
    ? { ...initialMatch, matchAnalysis: await ensureMatchAnalysisTranslations(initialMatch.matchAnalysis) }
    : initialMatch

  const dateLocale = locale === 'ko' ? ko : enUS
  const dateFormat = locale === 'ko' ? 'yyyy년 MM월 dd일 (EEEE)' : 'MMMM d, yyyy (EEEE)'
  const kickoffDate = format(new Date(match.kickoffAt), dateFormat, { locale: dateLocale })
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
    
    parsedAnalysis = {
      summary: langData.summary || analysis.summary || undefined,
      recentFlowAnalysis: langData.recentFlowAnalysis || analysis.recentFlowAnalysis || undefined,
      seasonTrends: langData.seasonTrends || analysis.seasonTrends || undefined,
      tacticalAnalysis: langData.tacticalAnalysis || analysis.tacticalAnalysis || undefined,
      keyPoints: (langData.keyPoints || analysis.keyPoints) as string[] | undefined,
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
          href="/matches/today"
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
            <div className="flex flex-1 flex-col items-center">
              <div className="flex flex-col items-center">
                {match.homeTeam.logoUrl ? (
                  <Image
                    src={match.homeTeam.logoUrl}
                    alt={match.homeTeam.name}
                    width={80}
                    height={80}
                    className="mb-2 rounded"
                  />
                ) : (
                  <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <span className="text-xl font-bold">{match.homeTeam.tla || match.homeTeam.shortName}</span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-center">{match.homeTeam.name}</h2>
              </div>
              <FormBadge form={match.homeTeam.seasonStats?.form || null} />
            </div>

            {/* Score / Time */}
            <div className="flex flex-col items-center px-8">
              {match.status === 'SCHEDULED' || match.status === 'TIMED' ? (
                <>
                  <span className="text-4xl font-bold">VS</span>
                  <div className="mt-2 flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-1 h-4 w-4" />
                    {kickoffTime}
                  </div>
                </>
              ) : (
                <span className="text-5xl font-bold">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-1 flex-col items-center">
              <div className="flex flex-col items-center">
                {match.awayTeam.logoUrl ? (
                  <Image
                    src={match.awayTeam.logoUrl}
                    alt={match.awayTeam.name}
                    width={80}
                    height={80}
                    className="mb-2 rounded"
                  />
                ) : (
                  <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <span className="text-xl font-bold">{match.awayTeam.tla || match.awayTeam.shortName}</span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-center">{match.awayTeam.name}</h2>
              </div>
              <FormBadge form={match.awayTeam.seasonStats?.form || null} />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="mr-1 h-4 w-4" />
              {kickoffDate}
            </div>
            {match.matchAnalysis && (
              <div className="flex items-center text-primary">
                <Sparkles className="mr-1 h-4 w-4" />
                {t('ai_analysis_completed')}
              </div>
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
                    {parsedAnalysis.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        {point}
                      </li>
                    ))}
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

import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Trophy,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Star,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format, parse, isValid, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { getKSTDayRange } from '@/lib/timezone'
import { ensureDailyReportTranslations } from '@/lib/ai/translate'
import { FormBadge } from '@/components/form-badge'
import { MatchStatusBadge } from '@/components/match-status-badge'
import { MATCH_STATUS_KEYS } from '@/lib/constants'
import { CACHE_REVALIDATE, DAILY_REPORT_REVALIDATE } from '@/lib/cache'
import { unstable_cache } from 'next/cache'

export const revalidate = DAILY_REPORT_REVALIDATE

interface Props {
  params: Promise<{ locale: string; date: string }>
}

interface ReportContent {
  title: string
  metaDescription: string
  summary: string
  sections: Array<{
    type: string
    title: string
    content: string
  }>
  keywords: string[]
}

interface HotMatch {
  matchId: string
  title: string
  preview: string
  keyPoint: string
}

// 서버 공유 캐시 적용: 데일리 리포트 데이터
const getCachedDailyReport = unstable_cache(
  async (dateStr: string) => {
    try {
      const { start } = getKSTDayRange(dateStr === 'today' ? undefined : dateStr)
      
      return await prisma.dailyReport.findUnique({
        where: { date: start },
      })
    } catch {
      return null
    }
  },
  ['daily-report-data-v2'],
  { revalidate: DAILY_REPORT_REVALIDATE, tags: ['daily-report'] }
)

// 서버 공유 캐시 적용: 경기 목록 데이터
const getCachedMatches = unstable_cache(
  async (dateStr: string) => {
    try {
      const { start, end } = getKSTDayRange(dateStr === 'today' ? undefined : dateStr)

      return await prisma.match.findMany({
        where: {
          kickoffAt: {
            gte: start,
            lte: end,
          },
        },
        include: {
          league: true,
          homeTeam: { include: { seasonStats: true } },
          awayTeam: { include: { seasonStats: true } },
          matchAnalysis: true,
        },
        orderBy: { kickoffAt: 'asc' },
      })
    } catch {
      return []
    }
  },
  ['daily-matches-data-v2'],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date: dateStr } = await params

  // today는 실제 날짜로 리다이렉트
  if (dateStr === 'today') {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
      title: '오늘의 축구 경기 분석',
      alternates: {
        canonical: `/daily/${today}`,
      },
    }
  }

  const report = await getCachedDailyReport(dateStr)
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
  const dateKo = isValid(parsed)
    ? format(parsed, 'yyyy년 M월 d일', { locale: ko })
    : dateStr

  if (!report) {
    return {
      title: `${dateKo} 축구 경기 일정 및 분석`,
      description: `${dateKo} 프리미어리그, 라리가, 세리에A, 분데스리가 경기 일정과 AI 분석`,
    }
  }

  let content: ReportContent | null = null
  try {
    content = JSON.parse(report.summary) as ReportContent
  } catch {
    content = null
  }

  const title = content?.title || `${dateKo} 축구 경기 분석`
  const description =
    content?.metaDescription ||
    `${dateKo} 유럽 5대 리그 축구 경기 프리뷰 및 AI 분석. 프리미어리그, 라리가, 세리에A, 분데스리가, 리그1 경기 일정.`

  return {
    title,
    description,
    keywords: content?.keywords || [
      '축구',
      '경기 분석',
      '프리미어리그',
      '라리가',
      dateKo,
    ],
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: new Date(report.createdAt).toISOString(),
      modifiedTime: new Date(report.updatedAt).toISOString(),
    },
    alternates: {
      canonical: `/daily/${dateStr}`,
    },
  }
}

// JSON-LD 구조화 데이터
function JsonLd({
  report,
  dateStr,
  matches,
}: {
  report: Awaited<ReturnType<typeof getCachedDailyReport>>
  dateStr: string
  matches: Awaited<ReturnType<typeof getCachedMatches>>
}) {
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
  const dateKo = isValid(parsed)
    ? format(parsed, 'yyyy년 M월 d일', { locale: ko })
    : dateStr

  let content: ReportContent | null = null
  if (report) {
    try {
      content = JSON.parse(report.summary) as ReportContent
    } catch {
      content = null
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content?.title || `${dateKo} 축구 경기 분석`,
    description:
      content?.metaDescription ||
      `${dateKo} 유럽 5대 리그 축구 경기 분석`,
    datePublished: report?.createdAt ? new Date(report.createdAt).toISOString() : new Date().toISOString(),
    dateModified: report?.updatedAt ? new Date(report.updatedAt).toISOString() : new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'PlayStat',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PlayStat',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://playstat.io/daily/${dateStr}`,
    },
  }

  // 경기 이벤트 스키마
  const sportsEvents = matches.map((match) => ({
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    startDate: new Date(match.kickoffAt).toISOString(),
    location: {
      '@type': 'Place',
      name: match.venue || match.homeTeam.venue || 'TBD',
    },
    homeTeam: {
      '@type': 'SportsTeam',
      name: match.homeTeam.name,
    },
    awayTeam: {
      '@type': 'SportsTeam',
      name: match.awayTeam.name,
    },
    description: `${match.league.name} ${match.matchday ? `라운드 ${match.matchday}` : ''} 경기`,
  }))

  // 모든 JSON-LD 데이터를 하나의 배열로 합침
  const allJsonLd = [
    jsonLd,
    ...sportsEvents
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(allJsonLd) }}
    />
  )
}

export default async function DailyReportPage({ params }: Props) {
  const { locale, date: dateStr } = await params
  setRequestLocale(locale)

  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const tHome = await getTranslations({ locale, namespace: 'home' })
  const tDaily = await getTranslations({ locale, namespace: 'daily_report' })
  const tMatch = await getTranslations({ locale, namespace: 'match' })

  // today는 실제 날짜로 리다이렉트
  if (dateStr === 'today') {
    const today = format(new Date(), 'yyyy-MM-dd')
    redirect(`/daily/${today}`)
  }

  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) {
    notFound()
  }

  const [initialReport, matches] = await Promise.all([
    getCachedDailyReport(dateStr),
    getCachedMatches(dateStr),
  ])

  // 다국어 번역 확인 및 생성 (없을 경우에만)
  const report = initialReport 
    ? await ensureDailyReportTranslations(initialReport)
    : null

  const dateKo = format(parsed, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
  const dateEn = format(parsed, 'MMMM d, yyyy (EEEE)')
  const isEn = locale === 'en'
  const dateFormatted = isEn ? dateEn : dateKo
  const dateShort = isEn ? format(parsed, 'MMM d') : format(parsed, 'M월 d일', { locale: ko })

  let content: ReportContent | null = null
  let hotMatches: HotMatch[] = []

  if (report) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translations = (report.translations as any) || {}
      const langData = translations[locale] || translations['en'] || {}
      
      content = {
        title: langData.title || '',
        metaDescription: langData.metaDescription || '',
        summary: langData.summary || '',
        sections: langData.sections || [],
        keywords: langData.keywords || [],
      }
      hotMatches = (report.hotMatches as unknown as HotMatch[]) || []
    } catch {
      // JSON 파싱 실패 시 일반 텍스트 요약으로 처리
      content = {
        title: isEn ? `${dateFormatted} Football Analysis` : `${dateKo} 축구 경기 분석`,
        summary: report.summary || "",
        sections: [],
        keywords: [],
        metaDescription: ""
      }
      hotMatches = (report.hotMatches as unknown as HotMatch[]) || []
    }
  }

  // 리그별 그룹핑
  const matchesByLeague: Record<string, typeof matches> = {}
  for (const match of matches) {
    const leagueName = match.league.name
    if (!matchesByLeague[leagueName]) {
      matchesByLeague[leagueName] = []
    }
    matchesByLeague[leagueName].push(match)
  }

  return (
    <>
      <JsonLd report={report} dateStr={dateStr} matches={matches} />

      <div className="container px-6 py-8 md:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-muted-foreground max-w-6xl mx-auto">
          <ol className="flex items-center justify-start gap-1">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">
                {tCommon('home')}
              </Link>
            </li>
            <ChevronRight className="h-3 w-3 opacity-50 rtl:-scale-x-100" />
            <li>
              <Link href="/daily/today" className="hover:text-primary transition-colors">
                {tCommon('daily_report')}
              </Link>
            </li>
            <ChevronRight className="h-3 w-3 opacity-50 rtl:-scale-x-100" />
            <li className="text-foreground font-medium">{dateShort}</li>
          </ol>
        </nav>

        {/* Page Header - H1 for SEO */}
        <header className="mb-10 text-start max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold mb-3 break-keep sm:text-4xl">
            {content?.title || (isEn ? `${dateFormatted} Football Analysis` : `${dateKo} 축구 경기 분석`)}
          </h1>
          <div className="text-muted-foreground flex items-center justify-start gap-4 text-sm sm:text-base">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              {dateFormatted}
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-primary" />
              {matches.length}{isEn ? ' Matches' : '개 경기'}
            </span>
          </div>
        </header>

        {/* AI Summary - Strategic Insights */}
        {content?.summary && (
          <div className="mb-12 max-w-6xl mx-auto">
            <Card className="border-primary/20 bg-primary/5 shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 rtl:right-auto rtl:left-0">
                <Sparkles className="h-24 w-24 text-primary" />
              </div>
              <CardHeader className="text-start pb-2">
                <CardTitle className="flex items-center justify-start gap-2 text-xl font-black text-primary">
                  <Sparkles className="h-5 w-5" />
                  {isEn ? "Today's Strategic Insights" : '오늘의 핵심 관전 인사이트'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {content.summary.split('\n').filter(line => line.trim()).map((line, i) => (
                    <div key={i} className="flex gap-3 items-start group">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 group-hover:scale-150 transition-transform" />
                      <p className="text-muted-foreground leading-relaxed text-start break-keep text-base font-medium">
                        {line.replace(/^\d+\.\s*/, '')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid - Centered Container */}
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Match List (2/3) */}
          <div className="lg:col-span-2 space-y-10">
            {/* Hot Matches - Filter and show only if valid matches exist */}
            {(() => {
              const validHotMatches = hotMatches.filter(hot => 
                matches.some(m => m.id === hot.matchId)
              );

              if (validHotMatches.length === 0) return null;

              return (
                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-start">
                    <Star className="h-5 w-5 text-yellow-500" />
                    {tDaily('hot_matches')}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {validHotMatches.map((hot, i) => {
                      const match = matches.find((m) => m.id === hot.matchId)!;

                      return (
                        <Link
                          key={i}
                          href={`/match/${match.slug || match.id}`}
                        >
                          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">
                                  {match.league.name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(match.kickoffAt, 'HH:mm')}
                                </span>
                              </div>
                              <h3 className="font-semibold mb-1 text-start">{hot.title}</h3>
                              <p className="text-sm text-muted-foreground mb-2 text-start line-clamp-2">
                                {hot.preview}
                              </p>
                              <p className="text-xs text-primary flex items-center gap-1 text-start font-bold">
                                <TrendingUp className="h-3 w-3" />
                                {hot.keyPoint}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

              {/* Matches by League */}
              <section>
                <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-start">
                    <Trophy className="h-5 w-5 text-primary" />
                    {isEn ? 'Matches by League' : '리그별 경기 일정'}
                  </h2>

                  {/* Weekly Date Picker */}
                  <div className="w-full sm:w-auto">
                    <Card className="overflow-hidden border-primary/10 shadow-sm bg-background/50 backdrop-blur-sm">
                      <CardContent className="p-1.5">
                        <div className="flex justify-between gap-1">
                          {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                            const d = addDays(parsed, offset)
                            const dStr = format(d, 'yyyy-MM-dd')
                            const isCurrent = offset === 0
                            const dayName = format(d, 'EEE', { locale: isEn ? undefined : ko })
                            const dayNum = format(d, 'd')

                            return (
                              <Link
                                key={offset}
                                href={`/daily/${dStr}`}
                                className={`flex min-w-[40px] flex-col items-center py-1.5 px-2 rounded-lg transition-all ${
                                  isCurrent
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <span className={`text-[9px] font-bold uppercase mb-0.5 ${isCurrent ? 'text-primary-foreground/80' : 'text-muted-foreground/60'}`}>
                                  {dayName}
                                </span>
                                <span className="text-xs font-black">{dayNum}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {Object.entries(matchesByLeague).map(([leagueName, leagueMatches]) => (
                  <div key={leagueName} className="mb-8">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-start">
                      {leagueMatches[0]?.league.logoUrl && (
                        <Image
                          src={leagueMatches[0].league.logoUrl}
                          alt={leagueName}
                          width={20}
                          height={20}
                          className="rounded"
                        />
                      )}
                      {leagueName}
                      <Badge variant="outline" className="text-xs">
                        {leagueMatches.length}{isEn ? ' matches' : '경기'}
                      </Badge>
                    </h3>

                    <div className="flex flex-col gap-2">
                      {leagueMatches.map((match) => {
                        const isFinished = match.status === 'FINISHED'
                        const isLive = match.status === 'LIVE'
                        const homeWins = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)
                        const awayWins = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)

                        return (
                          <Link
                            key={match.id}
                            href={`/match/${match.slug || match.id}`}
                          >
                            <Card className={`transition-all hover:shadow-sm ${
                              isFinished ? 'opacity-60 bg-muted/20' : 
                              isLive ? 'border-red-500 shadow-sm shadow-red-100 dark:shadow-red-900/20' :
                              'hover:border-primary/30'
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Time */}
                                    <div className={`text-sm font-bold w-12 text-center ${isLive ? 'text-red-500 animate-pulse' : ''}`}>
                                      {format(new Date(match.kickoffAt), 'HH:mm')}
                                    </div>

                                    {/* Teams */}
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {match.homeTeam.logoUrl && (
                                          <Image
                                            src={match.homeTeam.logoUrl}
                                            alt={match.homeTeam.name}
                                            width={20}
                                            height={20}
                                            className={`rounded ${isFinished && !homeWins ? 'grayscale opacity-70' : ''}`}
                                          />
                                        )}
                                        <span className={`font-medium text-sm ${homeWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                                          {match.homeTeam.name}
                                        </span>
                                        {homeWins && <Trophy className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                        {match.homeTeam.seasonStats?.rank && (
                                          <span className="text-[10px] text-muted-foreground opacity-70">
                                            ({match.homeTeam.seasonStats.rank}{isEn ? 'th' : '위'})
                                          </span>
                                        )}
                                        {!isFinished && (
                                          <FormBadge
                                            form={match.homeTeam.seasonStats?.form || null}
                                            size="sm"
                                          />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {match.awayTeam.logoUrl && (
                                          <Image
                                            src={match.awayTeam.logoUrl}
                                            alt={match.awayTeam.name}
                                            width={20}
                                            height={20}
                                            className={`rounded ${isFinished && !awayWins ? 'grayscale opacity-70' : ''}`}
                                          />
                                        )}
                                        <span className={`font-medium text-sm ${awayWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                                          {match.awayTeam.name}
                                        </span>
                                        {awayWins && <Trophy className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                        {match.awayTeam.seasonStats?.rank && (
                                          <span className="text-[10px] text-muted-foreground opacity-70">
                                            ({match.awayTeam.seasonStats.rank}{isEn ? 'th' : '위'})
                                          </span>
                                        )}
                                        {!isFinished && (
                                          <FormBadge
                                            form={match.awayTeam.seasonStats?.form || null}
                                            size="sm"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Score or Status */}
                                  <div className="flex items-center gap-4">
                                    {(isFinished || isLive) && (
                                      <div className={`text-xl font-black px-3 py-1 rounded bg-muted/50 min-w-[60px] text-center ${isLive ? 'text-red-500' : ''}`}>
                                        {match.homeScore ?? 0} : {match.awayScore ?? 0}
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-col items-end gap-1.5">
                                      <MatchStatusBadge 
                                        status={match.status} 
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        label={tMatch(MATCH_STATUS_KEYS[match.status] as any)} 
                                      />
                                      
                                      {match.matchAnalysis && !isFinished && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] py-0 h-5 bg-primary/10 text-primary border-none"
                                        >
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          {isEn ? 'AI' : 'AI 분석'}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {matches.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {tHome('no_matches_scheduled')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            {/* Right Column - Sidebar (1/3) */}
            <aside className="space-y-6">
              <div className="flex items-center gap-2 px-1 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">{isEn ? 'AI Insights' : 'AI 심층 분석'}</h3>
              </div>

              {/* AI Deep Analysis Sections */}
              {content?.sections && content.sections.length > 0 ? (
                content.sections.map((section, i) => (
                  <Card key={i} className="border-none shadow-sm bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line text-start">
                        {section.content}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-none shadow-sm bg-muted/10 border-dashed border-2">
                  <CardContent className="p-8 text-center text-muted-foreground italic">
                    {isEn ? 'No detailed analysis sections available for this date.' : '해당 날짜의 심층 분석 섹션이 없습니다.'}
                  </CardContent>
                </Card>
              )}

              {/* Related Keywords */}
              <div className="pt-4">
                <div className="flex items-center gap-2 px-1 mb-4">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-bold">{isEn ? 'Keywords' : '관련 키워드'}</h3>
                </div>
                <Card className="border-none shadow-sm bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {content?.keywords && content.keywords.length > 0 ? (
                        content.keywords.map((keyword, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-background">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {isEn ? 'No related keywords found.' : '관련 키워드가 없습니다.'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        </div>


      </div>
    </>
  )
}

import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
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
import { format, parse, isValid, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'

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

async function getDailyReport(dateStr: string) {
  try {
    // 'today' 처리
    let targetDate: Date
    if (dateStr === 'today') {
      targetDate = startOfDay(new Date())
    } else {
      // YYYY-MM-DD 형식 파싱
      const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
      if (!isValid(parsed)) {
        return null
      }
      targetDate = startOfDay(parsed)
    }

    const report = await prisma.dailyReport.findUnique({
      where: { date: targetDate },
    })

    return report
  } catch {
    return null
  }
}

async function getTodayMatches(dateStr: string) {
  try {
    let targetDate: Date
    if (dateStr === 'today') {
      targetDate = new Date()
    } else {
      const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
      if (!isValid(parsed)) return []
      targetDate = parsed
    }

    const dayStart = startOfDay(targetDate)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    return prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: dayStart,
          lt: dayEnd,
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
}

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

  const report = await getDailyReport(dateStr)
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
      publishedTime: report.createdAt.toISOString(),
      modifiedTime: report.updatedAt.toISOString(),
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
  report: Awaited<ReturnType<typeof getDailyReport>>
  dateStr: string
  matches: Awaited<ReturnType<typeof getTodayMatches>>
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
    datePublished: report?.createdAt.toISOString() || new Date().toISOString(),
    dateModified: report?.updatedAt.toISOString() || new Date().toISOString(),
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
    startDate: match.kickoffAt.toISOString(),
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {sportsEvents.map((event, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }}
        />
      ))}
    </>
  )
}

function FormBadge({ form }: { form: string | null }) {
  if (!form) return null
  const formArray = form.split(',').slice(0, 5)
  return (
    <div className="flex gap-0.5">
      {formArray.map((result, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${
            result === 'W'
              ? 'bg-green-500'
              : result === 'D'
                ? 'bg-gray-400'
                : 'bg-red-500'
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  )
}

export default async function DailyReportPage({ params }: Props) {
  const { locale, date: dateStr } = await params
  setRequestLocale(locale)

  // today는 실제 날짜로 리다이렉트
  if (dateStr === 'today') {
    const today = format(new Date(), 'yyyy-MM-dd')
    redirect(`/daily/${today}`)
  }

  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) {
    notFound()
  }

  const [report, matches] = await Promise.all([
    getDailyReport(dateStr),
    getTodayMatches(dateStr),
  ])

  const dateKo = format(parsed, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
  const dateShort = format(parsed, 'M월 d일', { locale: ko })

  let content: ReportContent | null = null
  let hotMatches: HotMatch[] = []

  if (report) {
    try {
      content = JSON.parse(report.summary) as ReportContent
      hotMatches = (report.hotMatches as unknown as HotMatch[]) || []
    } catch {
      content = null
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

      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/" className="hover:text-primary">
                홈
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li>
              <Link href="/daily/today" className="hover:text-primary">
                데일리 리포트
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li className="text-foreground">{dateShort}</li>
          </ol>
        </nav>

        {/* Page Header - H1 for SEO */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {content?.title || `${dateKo} 축구 경기 분석`}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {dateKo}
            <span className="mx-2">•</span>
            <Trophy className="h-4 w-4" />
            {matches.length}개 경기
          </p>
        </header>

        {/* AI Summary */}
        {content?.summary && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                오늘의 축구 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {content.summary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Match List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hot Matches */}
            {hotMatches.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  오늘의 주목 경기
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {hotMatches.map((hot, i) => {
                    const match = matches.find((m) => m.id === hot.matchId)
                    if (!match) return null

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
                            <h3 className="font-semibold mb-1">{hot.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {hot.preview}
                            </p>
                            <p className="text-xs text-primary flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {hot.keyPoint}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Matches by League */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                리그별 경기 일정
              </h2>

              {Object.entries(matchesByLeague).map(([leagueName, leagueMatches]) => (
                <div key={leagueName} className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
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
                      {leagueMatches.length}경기
                    </Badge>
                  </h3>

                  <div className="space-y-2">
                    {leagueMatches.map((match) => (
                      <Link
                        key={match.id}
                        href={`/match/${match.slug || match.id}`}
                      >
                        <Card className="transition-all hover:shadow-sm hover:border-primary/30">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                {/* Time */}
                                <div className="text-sm font-medium w-12 text-center">
                                  {format(match.kickoffAt, 'HH:mm')}
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
                                        className="rounded"
                                      />
                                    )}
                                    <span className="font-medium text-sm">
                                      {match.homeTeam.name}
                                    </span>
                                    {match.homeTeam.seasonStats?.rank && (
                                      <span className="text-xs text-muted-foreground">
                                        ({match.homeTeam.seasonStats.rank}위)
                                      </span>
                                    )}
                                    <FormBadge
                                      form={match.homeTeam.seasonStats?.form || null}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {match.awayTeam.logoUrl && (
                                      <Image
                                        src={match.awayTeam.logoUrl}
                                        alt={match.awayTeam.name}
                                        width={20}
                                        height={20}
                                        className="rounded"
                                      />
                                    )}
                                    <span className="font-medium text-sm">
                                      {match.awayTeam.name}
                                    </span>
                                    {match.awayTeam.seasonStats?.rank && (
                                      <span className="text-xs text-muted-foreground">
                                        ({match.awayTeam.seasonStats.rank}위)
                                      </span>
                                    )}
                                    <FormBadge
                                      form={match.awayTeam.seasonStats?.form || null}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* AI Analysis Badge */}
                              {match.matchAnalysis && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-primary/10 text-primary"
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI 분석
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {matches.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      이 날은 예정된 경기가 없습니다.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <aside className="space-y-6">
            {/* AI Sections */}
            {content?.sections?.map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {section.content}
                  </p>
                </CardContent>
              </Card>
            ))}

            {/* Keywords for SEO */}
            {content?.keywords && content.keywords.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">관련 키워드</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {content.keywords.map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation to other dates */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">다른 날짜</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[-2, -1, 1, 2].map((offset) => {
                  const d = new Date(parsed)
                  d.setDate(d.getDate() + offset)
                  const dStr = format(d, 'yyyy-MM-dd')
                  const dKo = format(d, 'M월 d일 (EEE)', { locale: ko })
                  return (
                    <Link
                      key={offset}
                      href={`/daily/${dStr}`}
                      className="block text-sm hover:text-primary transition-colors"
                    >
                      {dKo}
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </>
  )
}

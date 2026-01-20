import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { Calendar, Clock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { getTodayRangeInTimezone } from '@/lib/timezone'
import { MatchCard } from '@/components/match-card'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { unstable_cache } from 'next/cache'
import { getDateLocale } from '@/lib/utils'
import { SPORT_COOKIE, getSportFromCookie, getSportFromHost, sportIdToEnum } from '@/lib/sport'
import { generateMetadata as buildMetadata, resolveBaseUrl } from '@/lib/seo'
import { type Locale } from '@/i18n/config'

interface Props {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)

  return buildMetadata(
    {
      title: t('today_matches'),
      description: tCommon('description'),
    },
    { path: '/matches/today', locale: locale as Locale, baseUrl }
  )
}

// 서버 공유 캐시 적용: 경기 목록 데이터 조회
const getCachedMatches = (timezone: string, dateStr: string, sportType: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL') => unstable_cache(
  async () => {
    // 사용자 타임존 기준 오늘의 시작/끝
    const { start, end } = getTodayRangeInTimezone(timezone)

    try {
      // 오늘 경기 조회
      const todayMatches = await prisma.match.findMany({
        where: {
          kickoffAt: {
            gte: start,
            lte: end,
          },
          sportType,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          matchAnalysis: true,
        },
        orderBy: {
          kickoffAt: 'asc',
        },
      })

      // 다가오는 경기 조회 (오늘 이후 7일)
      const weekLater = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000)

      const upcomingMatches = await prisma.match.findMany({
        where: {
          kickoffAt: {
            gt: end, // 오늘 이후
            lte: weekLater,
          },
          sportType,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          matchAnalysis: true,
        },
        orderBy: {
          kickoffAt: 'asc',
        },
        take: 30,
      })

      return { todayMatches, upcomingMatches }
    } catch {
      return { todayMatches: [], upcomingMatches: [] }
    }
  },
  [`today-matches-data-${timezone}-${dateStr}-${sportType}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

type MatchWithRelations = Awaited<ReturnType<typeof getCachedMatches>>['todayMatches'][number]

// 리그별로 경기 그룹화하는 헬퍼 함수
function groupMatchesByLeague(matches: MatchWithRelations[]) {
  return matches.reduce(
    (acc, match) => {
      const leagueName = match.league.name
      if (!acc[leagueName]) {
        acc[leagueName] = []
      }
      acc[leagueName].push(match)
      return acc
    },
    {} as Record<string, MatchWithRelations[]>
  )
}

export default async function TodayMatchesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'home' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  // 쿠키에서 타임존과 스포츠 타입 가져오기
  const cookieStore = await cookies()
  const timezone = cookieStore.get('timezone')?.value || 'Asia/Seoul'
  const host = headers().get('host')
  const sportCookie = cookieStore.get(SPORT_COOKIE)?.value
  const sportId = sportCookie ? getSportFromCookie(sportCookie) : getSportFromHost(host)
  const sportType = sportIdToEnum(sportId)

  // 서버에서 날짜 한 번만 계산 (hydration 에러 방지)
  const now = new Date()
  const dateStr = format(now, 'yyyy-MM-dd')

  let today = dateStr
  try {
    const fullFormat = tCommon('date_full_format')
    if (fullFormat && fullFormat !== 'date_full_format') {
      today = format(now, fullFormat, {
        locale: getDateLocale(locale),
      })
    }
  } catch {
    // Fallback set above
  }
  const { todayMatches, upcomingMatches } = await getCachedMatches(timezone, dateStr, sportType)

  const todayByLeague = groupMatchesByLeague(todayMatches)
  const upcomingByLeague = groupMatchesByLeague(upcomingMatches)

  const hasNoMatches = todayMatches.length === 0 && upcomingMatches.length === 0

  return (
    <div className="container py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">
          {t('match_schedule')}
        </h1>
        <p className="flex items-center text-muted-foreground">
          <Calendar className="mr-2 h-5 w-5" />
          {today}
        </p>
      </div>

      {hasNoMatches ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t('no_matches_scheduled')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('run_cron_message')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          {/* 오늘의 경기 섹션 */}
          <section>
            <h2 className="mb-6 text-2xl font-bold flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              {t('today_matches')}
            </h2>

            {todayMatches.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="py-8 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t('no_matches_today')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(todayByLeague).map(([leagueName, leagueMatches]) => (
                  <div key={leagueName}>
                    <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                      {leagueMatches[0].league.logoUrl && (
                        <Image
                          src={leagueMatches[0].league.logoUrl}
                          alt={leagueName}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                      )}
                      {leagueName}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {leagueMatches.map((match) => (
                        <MatchCard key={match.id} match={{...match, slug: match.slug || match.id}} locale={locale} showDate={false} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 다가오는 경기 섹션 */}
          {upcomingMatches.length > 0 && (
            <section>
              <h2 className="mb-6 text-2xl font-bold flex items-center gap-2">
                <Clock className="h-6 w-6 text-muted-foreground" />
                {t('upcoming_matches')}
                <span className="text-sm font-normal text-muted-foreground">
                  ({t('next_7_days')})
                </span>
              </h2>

              <div className="space-y-6">
                {Object.entries(upcomingByLeague).map(([leagueName, leagueMatches]) => (
                  <div key={leagueName}>
                    <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                      {leagueMatches[0].league.logoUrl && (
                        <Image
                          src={leagueMatches[0].league.logoUrl}
                          alt={leagueName}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                      )}
                      {leagueName}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {leagueMatches.map((match) => (
                        <MatchCard key={match.id} match={{...match, slug: match.slug || match.id}} locale={locale} showDate={true} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

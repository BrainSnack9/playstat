import { Card, CardContent } from '@/components/ui/card'
import { Calendar, CalendarClock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import { MatchCard } from '@/components/match-card'
import { getDayRangeInTimezone, getTimezoneFromCookies } from '@/lib/timezone'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { format } from 'date-fns'
import { getSportFromCookie, sportIdToEnum, SPORT_COOKIE } from '@/lib/sport'
import type { SportId } from '@/lib/sport'
import { SportType } from '@prisma/client'

// 서버 공유 캐시 적용: 홈 화면 오늘 경기
const getCachedTodayMatches = (dateStr: string, timezone: string, sportType: SportType) => unstable_cache(
  async () => {
    const { start, end } = getDayRangeInTimezone(dateStr, timezone)

    return await prisma.match.findMany({
      where: {
        sportType,
        kickoffAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
        },
        league: {
          select: { name: true, code: true, logoUrl: true },
        },
        matchAnalysis: {
          select: { id: true },
        },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    })
  },
  [`home-today-matches-${dateStr}-${timezone}-${sportType}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

// 다가오는 경기 조회 (오늘 이후 예정된 경기)
const getCachedUpcomingMatches = (sportType: SportType) => unstable_cache(
  async () => {
    const now = new Date()

    return await prisma.match.findMany({
      where: {
        sportType,
        kickoffAt: {
          gt: now,
        },
        status: 'SCHEDULED',
      },
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
        },
        league: {
          select: { name: true, code: true, logoUrl: true },
        },
        matchAnalysis: {
          select: { id: true },
        },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    })
  },
  [`home-upcoming-matches-${sportType}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

export interface TodayMatchesProps {
  locale?: string
  sport?: string
}

export async function TodayMatches({ locale, sport }: TodayMatchesProps) {
  const cookieStore = await cookies()
  const resolvedLocale = locale || cookieStore.get('NEXT_LOCALE')?.value || 'ko'
  const timezone = getTimezoneFromCookies(cookieStore.get('timezone')?.value || null)
  // sport prop이 있으면 사용, 없으면 쿠키에서 가져옴
  const sportType = sport
    ? sportIdToEnum(sport as SportId) as SportType
    : sportIdToEnum(getSportFromCookie(cookieStore.get(SPORT_COOKIE)?.value)) as SportType
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const todayMatches = await getCachedTodayMatches(dateStr, timezone, sportType)
  const home = await getTranslations('home')

  // sport prop이 있으면 사용, 없으면 sportType에서 변환
  const sportId = sport || (sportType === 'FOOTBALL' ? 'football' : sportType === 'BASKETBALL' ? 'basketball' : 'baseball')

  // 오늘 경기가 없으면 다가오는 경기 조회
  if (todayMatches.length === 0) {
    const upcomingMatches = await getCachedUpcomingMatches(sportType)

    if (upcomingMatches.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{home('no_matches_today')}</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>{home('upcoming_matches')}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {upcomingMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={{
                ...match,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                slug: (match as any).slug || match.id
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any}
              sport={sportId}
              locale={resolvedLocale}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {todayMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={{
            ...match,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            slug: (match as any).slug || match.id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any}
          sport={sportId}
          locale={resolvedLocale}
        />
      ))}
    </div>
  )
}

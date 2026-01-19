import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import { MatchCard } from '@/components/match-card'
import { getTodayRangeInTimezone } from '@/lib/timezone'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { format } from 'date-fns'

// 서버 공유 캐시 적용: 홈 화면 오늘 경기
// 타임존별로 캐싱하여 각 지역 사용자에게 맞는 데이터 제공
const getCachedTodayMatches = (dateStr: string, timezone: string) => unstable_cache(
  async () => {
    const { start, end } = getTodayRangeInTimezone(timezone)

    return await prisma.match.findMany({
      where: {
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
  [`home-today-matches-${dateStr}-${timezone}`],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)()

interface TodayMatchesProps {
  locale: string
  timezone?: string
}

export async function TodayMatches({ locale, timezone = 'Asia/Seoul' }: TodayMatchesProps) {
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const matches = await getCachedTodayMatches(dateStr, timezone)
  const home = await getTranslations('home')

  if (matches.length === 0) {
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard 
          key={match.id} 
          match={{
            ...match,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            slug: (match as any).slug || match.id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any} 
          locale={locale} 
        />
      ))}
    </div>
  )
}

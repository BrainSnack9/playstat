import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import { TrendingUp, Flame, Zap } from 'lucide-react'
import { analyzeTeamTrend, getMatchCombinedTrend } from '@/lib/ai/trend-engine'
import Image from 'next/image'
import { getKSTDayRange } from '@/lib/timezone'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { format } from 'date-fns'

// 서버 공유 캐시 적용: 홈 화면 트렌드 경기
const getCachedTrendingMatches = unstable_cache(
  async (_dateStr: string) => {
    // _dateStr is used by unstable_cache to invalidate cache daily
    void _dateStr;
    const { start, end } = getKSTDayRange()

    const matches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: start,
          lte: end,
        },
        status: { in: ['SCHEDULED', 'TIMED'] },
      },
      include: {
        league: true,
        homeTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
        awayTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
      },
      take: 10,
    })

    return matches.map((match) => {
      const homeTrends = analyzeTeamTrend(
        match.homeTeam.name,
        match.homeTeam.id,
        match.homeTeam.recentMatches?.matchesJson
      )
      const awayTrends = analyzeTeamTrend(
        match.awayTeam.name,
        match.awayTeam.id,
        match.awayTeam.recentMatches?.matchesJson
      )
      const combined = getMatchCombinedTrend(homeTrends, awayTrends)

      return {
        match,
        homeTrends,
        awayTrends,
        combined,
      }
    })
    .filter((m) => m.homeTrends.length > 0 || m.awayTrends.length > 0 || m.combined)
    .slice(0, 3)
  },
  ['home-trending-matches-v2'],
  { revalidate: CACHE_REVALIDATE, tags: ['matches'] }
)

interface HotTrendsProps {
  locale: string
}

export async function HotTrends({ locale }: HotTrendsProps) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const tt = await getTranslations({ locale, namespace: 'trends' })

  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const trendingMatches = await getCachedTrendingMatches(dateStr)

  if (trendingMatches.length === 0) return null

  return (
    <section className="mb-12">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="section-title">{t('hot_trends')}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {trendingMatches.map(({ match, homeTrends, awayTrends, combined }) => (
          <Link key={match.id} href={`/match/${match.slug || match.id}`}>
            <Card className="h-full border-primary/20 bg-primary/5 transition-all hover:border-primary/40 hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{match.league.name}</span>
                  <Badge variant="outline" className="bg-background/50 font-bold text-primary">
                    {combined ? (
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 fill-current" />
                        {tt(combined.type)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 fill-current" />
                        HOT
                      </span>
                    )}
                  </Badge>
                </div>
                
                <div className="mb-4 flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    {match.homeTeam.logoUrl && (
                      <Image src={match.homeTeam.logoUrl} alt={match.homeTeam.name} width={40} height={40} className="h-10 w-10 object-contain" />
                    )}
                    <span className="text-sm font-bold">{match.homeTeam.name}</span>
                  </div>
                  <span className="text-lg font-black text-muted-foreground/30">VS</span>
                  <div className="flex flex-col items-center gap-1">
                    {match.awayTeam.logoUrl && (
                      <Image src={match.awayTeam.logoUrl} alt={match.awayTeam.name} width={40} height={40} className="h-10 w-10 object-contain" />
                    )}
                    <span className="text-sm font-bold">{match.awayTeam.name}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {[...homeTrends, ...awayTrends].slice(0, 2).map((trend, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {trend.trendType.includes('streak') ? (
                        <Flame className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                      ) : (
                        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      )}
                      <span className="font-medium leading-tight">
                        <span className="text-primary">{trend.teamName}</span>:{' '}
                        {tt(trend.trendType, { value: trend.value })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

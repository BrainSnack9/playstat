import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import { TrendingUp, Flame, ShieldAlert, Zap } from 'lucide-react'
import { analyzeTeamTrend, getMatchCombinedTrend, type TeamTrend } from '@/lib/ai/trend-engine'
import Image from 'next/image'

interface HotTrendsProps {
  locale: string
}

export async function HotTrends({ locale }: HotTrendsProps) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const isEn = locale === 'en'

  // 오늘 경기 중 분석 엔진을 돌릴 데이터 조회
  const today = new Date()
  const endOfToday = new Date(today)
  endOfToday.setHours(23, 59, 59, 999)

  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
        lte: endOfToday,
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

  const trendingMatches = matches
    .map((match) => {
      const homeTrends = analyzeTeamTrend(
        match.homeTeam.name,
        match.homeTeam.id,
        match.homeTeam.recentMatches?.matchesJson,
        match.homeTeam.seasonStats
      )
      const awayTrends = analyzeTeamTrend(
        match.awayTeam.name,
        match.awayTeam.id,
        match.awayTeam.recentMatches?.matchesJson,
        match.awayTeam.seasonStats
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
    .slice(0, 3) // 상위 3개만 노출

  if (trendingMatches.length === 0) return null

  return (
    <section className="mb-12">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="section-title">{isEn ? 'Today\'s Hot Trends' : '오늘의 핵심 트렌드'}</h2>
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
                        {isEn ? combined.descriptionEn : combined.description}
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
                        {isEn ? trend.descriptionEn : trend.description}
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

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Target,
  Trophy,
  TrendingUp,
  Clock,
  Check,
  Share2,
  ChevronLeft,
  Zap,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'
import { usePredictions } from '@/stores/predictions'
import { Scoreboard3D } from '@/components/games/scoreboard-3d'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { SportSelector } from '@/components/sport-tabs'
import type { SportId } from '@/lib/sport'

interface MatchData {
  id: string
  homeTeam: {
    id: string
    name: string
    shortName: string | null
    logo: string | null
    rank: number | null
  }
  awayTeam: {
    id: string
    name: string
    shortName: string | null
    logo: string | null
    rank: number | null
  }
  league: {
    id: string
    name: string
    logo?: string | null
  }
  kickoffAt: string
  sportType: string
  homeScore?: number | null
  awayScore?: number | null
}

interface Translations {
  title: string
  description: string
  selectMatch: string
  yourPrediction: string
  confirmPrediction: string
  changePrediction: string
  matchStarts: string
  predictedAt: string
  myPredictions: string
  results: string
  noMatches: string
  stats: {
    totalPoints: string
    totalPredictions: string
    exactMatches: string
    currentStreak: string
    accuracy: string
  }
  points: {
    exact: string
    diff: string
    winner: string
    miss: string
  }
  share: string
  shareText: string
}

interface Props {
  locale: string
  upcomingMatches: MatchData[]
  finishedMatches: MatchData[]
  translations: Translations
}

// SportId를 DB의 sportType과 매핑
const sportIdToType: Record<SportId, string> = {
  football: 'FOOTBALL',
  basketball: 'BASKETBALL',
  baseball: 'BASEBALL',
}

// 순위별 배지 스타일
function getRankBadgeStyle(rank: number): string {
  if (rank <= 5) {
    return 'bg-yellow-500/20 text-yellow-500' // 1~5위: 골드
  } else if (rank <= 11) {
    return 'bg-blue-500/20 text-blue-500' // 6~11위: 블루
  } else {
    return 'bg-muted text-muted-foreground' // 12위~: 회색
  }
}

export function ScoreChallengeClient({
  locale,
  upcomingMatches,
  finishedMatches,
  translations: t,
}: Props) {
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [isHydrated, setIsHydrated] = useState(false)
  const [selectedSport, setSelectedSport] = useState<SportId>('football')

  const {
    predictions,
    stats,
    addPrediction,
    getPrediction,
    hasPrediction,
    settlePrediction,
    recalculateStats,
  } = usePredictions()

  const dateLocale = locale === 'ko' ? ko : enUS

  // Hydration fix
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // 스포츠별 필터링된 경기 (sportIdToType으로 변환하여 비교)
  const filteredUpcoming = upcomingMatches.filter(m => m.sportType === sportIdToType[selectedSport])
  const filteredFinished = finishedMatches.filter(m => m.sportType === sportIdToType[selectedSport])

  // 경기 선택 시 기존 예측값 로드
  useEffect(() => {
    if (selectedMatch) {
      const existing = getPrediction(selectedMatch.id)
      if (existing) {
        setHomeScore(existing.homeScore)
        setAwayScore(existing.awayScore)
      } else {
        setHomeScore(0)
        setAwayScore(0)
      }
    }
  }, [selectedMatch, getPrediction])

  // 종료된 경기 정산
  useEffect(() => {
    if (!isHydrated) return

    for (const match of finishedMatches) {
      const pred = getPrediction(match.id)
      if (
        pred &&
        !pred.settled &&
        match.homeScore !== null &&
        match.awayScore !== null
      ) {
        settlePrediction(match.id, match.homeScore!, match.awayScore!, match.sportType as 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL')
      }
    }
    recalculateStats()
  }, [finishedMatches, isHydrated, getPrediction, settlePrediction, recalculateStats])

  const handleConfirmPrediction = () => {
    if (!selectedMatch) return
    addPrediction(selectedMatch.id, homeScore, awayScore, selectedMatch.sportType as 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL')
    setSelectedMatch(null)
  }

  const handleShare = async (match: MatchData, prediction: ReturnType<typeof getPrediction>) => {
    if (!prediction) return

    const resultEmoji = prediction.points === 3 ? '🎯' : prediction.points === 2 ? '✨' : prediction.points === 1 ? '✅' : '❌'
    const pointsText = prediction.points === 3 ? t.points.exact : prediction.points === 2 ? t.points.diff : prediction.points === 1 ? t.points.winner : t.points.miss

    const text = `⚽ PlayStat Score Challenge

${match.homeTeam.shortName || match.homeTeam.name} vs ${match.awayTeam.shortName || match.awayTeam.name}
${t.yourPrediction}: ${prediction.homeScore}-${prediction.awayScore}
${t.results}: ${prediction.actualHomeScore}-${prediction.actualAwayScore} ${resultEmoji}

${pointsText} (+${prediction.points}pts)
📊 ${t.stats.totalPoints}: ${stats.totalPoints}

playstat.space/games/score-challenge`

    if (navigator.share) {
      await navigator.share({ text })
    } else {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    }
  }

  if (!isHydrated) {
    return (
      <div className="container py-8">
        <div className="h-[600px] bg-muted rounded-xl animate-pulse" />
      </div>
    )
  }

  // 스코어보드 뷰
  if (selectedMatch) {
    const existing = getPrediction(selectedMatch.id)

    return (
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setSelectedMatch(null)}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="text-xs text-muted-foreground hidden md:block">
            {selectedMatch.sportType === 'FOOTBALL' ? '+/- 버튼으로 점수 예측' : '점수를 직접 입력하세요'}
          </span>
        </div>

        {/* 스코어보드 */}
        <Scoreboard3D
          homeTeam={selectedMatch.homeTeam.shortName || selectedMatch.homeTeam.name}
          awayTeam={selectedMatch.awayTeam.shortName || selectedMatch.awayTeam.name}
          homeScore={homeScore}
          awayScore={awayScore}
          homeLogo={selectedMatch.homeTeam.logo}
          awayLogo={selectedMatch.awayTeam.logo}
          homeRank={selectedMatch.homeTeam.rank}
          awayRank={selectedMatch.awayTeam.rank}
          onHomeScoreChange={setHomeScore}
          onAwayScoreChange={setAwayScore}
          matchTime={format(new Date(selectedMatch.kickoffAt), 'PPp', { locale: dateLocale })}
          timeRemaining={formatDistanceToNow(new Date(selectedMatch.kickoffAt), {
            addSuffix: true,
            locale: dateLocale,
          })}
          league={selectedMatch.league.name}
          leagueLogo={selectedMatch.league.logo}
          isLocked={false}
          sportType={selectedMatch.sportType as 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'}
        />

        {/* 확정 버튼 */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={handleConfirmPrediction}
            className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            <Check className="w-5 h-5" />
            {existing ? t.changePrediction : t.confirmPrediction}
          </Button>
        </div>

        {existing && (
          <p className="text-center text-sm text-muted-foreground">
            {t.predictedAt}: {format(new Date(existing.predictedAt), 'PPp', { locale: dateLocale })}
          </p>
        )}
      </div>
    )
  }

  // 메인 뷰
  return (
    <div className="container py-6 space-y-6">
      {/* 스포츠 선택 - 최상단 */}
      <SportSelector
        currentSport={selectedSport}
        onChange={setSelectedSport}
      />

      {/* 헤더 + 통계 */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t.title}</h1>
              <p className="text-sm text-muted-foreground">{t.description}</p>
            </div>
          </div>

          {/* 통계 요약 */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold text-yellow-500">{stats.totalPoints}</span>
              <span className="text-muted-foreground">{t.stats.totalPoints}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <Zap className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-green-500">{stats.currentStreak}</span>
              <span className="text-muted-foreground">{t.stats.currentStreak}</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="font-semibold text-purple-500">
                {stats.totalPredictions > 0
                  ? Math.round((stats.correctWinner + stats.correctDiff + stats.exactMatches) / stats.totalPredictions * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">{t.selectMatch}</TabsTrigger>
          <TabsTrigger value="results">{t.myPredictions}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {filteredUpcoming.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">{t.noMatches}</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredUpcoming.map((match) => {
                const predicted = hasPrediction(match.id)
                const prediction = getPrediction(match.id)

                return (
                  <Card
                    key={match.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/50',
                      predicted && 'border-green-500/50 bg-green-500/5'
                    )}
                    onClick={() => setSelectedMatch(match)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          {match.league.logo ? (
                            <div className="w-4 h-4 rounded bg-white p-0.5 flex items-center justify-center">
                              <Image src={match.league.logo} alt={match.league.name} width={14} height={14} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <span className="text-xs">{match.sportType === 'FOOTBALL' ? '⚽' : '🏀'}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{match.league.name}</span>
                        </div>
                        {predicted && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Check className="w-3 h-3 mr-1" />
                            {prediction?.homeScore}-{prediction?.awayScore}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        {/* 홈팀 */}
                        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                          <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-muted/50 p-2 flex items-center justify-center">
                            {match.homeTeam.logo ? (
                              <Image src={match.homeTeam.logo} alt={match.homeTeam.name} width={40} height={40} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">{(match.homeTeam.shortName || match.homeTeam.name).substring(0, 3).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-1.5 w-full">
                            {match.homeTeam.rank && (
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', getRankBadgeStyle(match.homeTeam.rank))}>
                                #{match.homeTeam.rank}
                              </span>
                            )}
                            <span className="text-xs md:text-sm font-medium truncate text-center">
                              {match.homeTeam.shortName || match.homeTeam.name}
                            </span>
                          </div>
                        </div>

                        {/* VS */}
                        <div className="text-sm text-muted-foreground font-medium px-2">vs</div>

                        {/* 어웨이팀 */}
                        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                          <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-muted/50 p-2 flex items-center justify-center">
                            {match.awayTeam.logo ? (
                              <Image src={match.awayTeam.logo} alt={match.awayTeam.name} width={40} height={40} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">{(match.awayTeam.shortName || match.awayTeam.name).substring(0, 3).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-1.5 w-full">
                            {match.awayTeam.rank && (
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', getRankBadgeStyle(match.awayTeam.rank))}>
                                #{match.awayTeam.rank}
                              </span>
                            )}
                            <span className="text-xs md:text-sm font-medium truncate text-center">
                              {match.awayTeam.shortName || match.awayTeam.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(match.kickoffAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          {(() => {
            // 현재 스포츠에 해당하는 예측 기록만 필터링
            const sportPredictions = predictions
              .filter((p) => p.settled)
              .filter((p) => {
                // finishedMatches에서 해당 경기 찾기 (전체 목록에서)
                const match = finishedMatches.find((m) => m.id === p.matchId)
                return match && match.sportType === sportIdToType[selectedSport]
              })
              .sort((a, b) => new Date(b.predictedAt).getTime() - new Date(a.predictedAt).getTime())

            if (sportPredictions.length === 0) {
              return (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No results yet</p>
                </Card>
              )
            }

            return (
              <div className="space-y-4">
                {sportPredictions.map((pred) => {
                  const match = filteredFinished.find((m) => m.id === pred.matchId)
                  if (!match) return null

                  const pointsColor =
                    pred.points === 3
                      ? 'text-yellow-500 bg-yellow-500/10'
                      : pred.points === 2
                        ? 'text-blue-500 bg-blue-500/10'
                        : pred.points === 1
                          ? 'text-green-500 bg-green-500/10'
                          : 'text-red-500 bg-red-500/10'

                  return (
                    <Card key={pred.matchId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          {/* 팀 로고 */}
                          <div className="flex items-center gap-2">
                            {match.homeTeam.logo ? (
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted/50 p-1.5 flex items-center justify-center">
                                <Image src={match.homeTeam.logo} alt={match.homeTeam.name} width={32} height={32} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {(match.homeTeam.shortName || match.homeTeam.name).substring(0, 3).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">vs</span>
                            {match.awayTeam.logo ? (
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted/50 p-1.5 flex items-center justify-center">
                                <Image src={match.awayTeam.logo} alt={match.awayTeam.name} width={32} height={32} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {(match.awayTeam.shortName || match.awayTeam.name).substring(0, 3).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* 경기 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {match.league.logo ? (
                                <div className="w-3.5 h-3.5 rounded bg-white p-0.5 flex items-center justify-center">
                                  <Image src={match.league.logo} alt={match.league.name} width={12} height={12} className="w-full h-full object-contain" />
                                </div>
                              ) : null}
                              <span className="text-xs text-muted-foreground">{match.league.name}</span>
                            </div>
                            <div className="text-sm font-medium truncate flex items-center gap-1.5">
                              {match.homeTeam.rank && (
                                <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', getRankBadgeStyle(match.homeTeam.rank))}>
                                  #{match.homeTeam.rank}
                                </span>
                              )}
                              <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
                              <span className="text-muted-foreground mx-0.5">vs</span>
                              {match.awayTeam.rank && (
                                <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', getRankBadgeStyle(match.awayTeam.rank))}>
                                  #{match.awayTeam.rank}
                                </span>
                              )}
                              <span>{match.awayTeam.shortName || match.awayTeam.name}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              <span className="text-muted-foreground">
                                {t.yourPrediction}: {pred.homeScore}-{pred.awayScore}
                              </span>
                              <span className="font-medium">
                                {t.results}: {pred.actualHomeScore}-{pred.actualAwayScore}
                              </span>
                            </div>
                          </div>

                          {/* 포인트 + 공유 */}
                          <div className="flex items-center gap-2">
                            <div className={cn('px-3 py-1 rounded-full font-bold text-sm', pointsColor)}>
                              +{pred.points}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleShare(match, pred)}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}

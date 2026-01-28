import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { addDays } from 'date-fns'
import { ScoreChallengeClient } from './client'

interface Props {
  params: Promise<{ locale: string }>
}

// 예측 가능한 경기 조회 (예정된 경기만)
const getUpcomingMatches = unstable_cache(
  async () => {
    const now = new Date()
    // 10분 후부터 14일 이내 경기
    const cutoffTime = new Date(now.getTime() + 10 * 60 * 1000)

    return prisma.match.findMany({
      where: {
        // SCHEDULED (축구) 또는 TIMED (농구/야구) 상태
        status: { in: ['SCHEDULED', 'TIMED'] },
        kickoffAt: {
          gte: cutoffTime,
          lte: addDays(now, 14),
        },
      },
      include: {
        homeTeam: {
          include: { seasonStats: true },
        },
        awayTeam: {
          include: { seasonStats: true },
        },
        league: true,
      },
      orderBy: {
        kickoffAt: 'asc',
      },
      take: 50,
    })
  },
  ['score-challenge-matches'],
  { revalidate: 300, tags: ['matches'] } // 5분마다 갱신
)

// 정산이 필요한 경기 (종료됨 + 아직 정산 안됨)
const getFinishedMatches = unstable_cache(
  async () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return prisma.match.findMany({
      where: {
        status: 'FINISHED',
        kickoffAt: {
          gte: sevenDaysAgo,
        },
      },
      include: {
        homeTeam: {
          include: { seasonStats: true },
        },
        awayTeam: {
          include: { seasonStats: true },
        },
        league: true,
      },
      orderBy: {
        kickoffAt: 'desc',
      },
      take: 30,
    })
  },
  ['score-challenge-finished'],
  { revalidate: 300, tags: ['matches'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'games' })

  return {
    title: `${t('score-challenge.title')} - PlayStat`,
    description: t('score-challenge.description'),
  }
}

export default async function ScoreChallengePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Suspense
      fallback={
        <div className="container py-8">
          <div className="space-y-6">
            <div className="h-12 w-64 bg-muted rounded animate-pulse" />
            <div className="h-[600px] bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      }
    >
      <ScoreChallengeContent locale={locale} />
    </Suspense>
  )
}

async function ScoreChallengeContent({ locale }: { locale: string }) {
  const [upcomingMatches, finishedMatches] = await Promise.all([
    getUpcomingMatches(),
    getFinishedMatches(),
  ])

  const t = await getTranslations({ locale, namespace: 'games' })

  // Date를 ISO 문자열로 안전하게 변환
  const toISOString = (date: Date | string) => {
    if (typeof date === 'string') return date
    return date.toISOString()
  }

  // 경기 데이터를 클라이언트에 전달할 형태로 변환
  const upcomingData = upcomingMatches.map((match) => ({
    id: match.id,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      logo: match.homeTeam.logoUrl,
      rank: match.homeTeam.seasonStats?.rank ?? null,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      logo: match.awayTeam.logoUrl,
      rank: match.awayTeam.seasonStats?.rank ?? null,
    },
    league: {
      id: match.league.id,
      name: match.league.name,
      logo: match.league.logoUrl,
    },
    kickoffAt: toISOString(match.kickoffAt),
    sportType: match.sportType,
  }))

  const finishedData = finishedMatches.map((match) => ({
    id: match.id,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      logo: match.homeTeam.logoUrl,
      rank: match.homeTeam.seasonStats?.rank ?? null,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      logo: match.awayTeam.logoUrl,
      rank: match.awayTeam.seasonStats?.rank ?? null,
    },
    league: {
      id: match.league.id,
      name: match.league.name,
      logo: match.league.logoUrl,
    },
    kickoffAt: toISOString(match.kickoffAt),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    sportType: match.sportType,
  }))

  return (
    <ScoreChallengeClient
      locale={locale}
      upcomingMatches={upcomingData}
      finishedMatches={finishedData}
      translations={{
        title: t('score-challenge.title'),
        description: t('score-challenge.description'),
        selectMatch: t('score-challenge.select_match'),
        yourPrediction: t('score-challenge.your_prediction'),
        confirmPrediction: t('score-challenge.confirm'),
        changePrediction: t('score-challenge.change'),
        matchStarts: t('score-challenge.match_starts'),
        predictedAt: t('score-challenge.predicted_at'),
        myPredictions: t('score-challenge.my_predictions'),
        results: t('score-challenge.results'),
        noMatches: t('score-challenge.no_matches'),
        stats: {
          totalPoints: t('score-challenge.stats.total_points'),
          totalPredictions: t('score-challenge.stats.total_predictions'),
          exactMatches: t('score-challenge.stats.exact_matches'),
          currentStreak: t('score-challenge.stats.current_streak'),
          accuracy: t('score-challenge.stats.accuracy'),
        },
        points: {
          exact: t('score-challenge.points.exact'),
          diff: t('score-challenge.points.diff'),
          winner: t('score-challenge.points.winner'),
          miss: t('score-challenge.points.miss'),
        },
        share: t('score-challenge.share'),
        shareText: t('score-challenge.share_text'),
      }}
    />
  )
}

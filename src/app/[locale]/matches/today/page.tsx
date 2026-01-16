import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'
import { Calendar, Clock } from 'lucide-react'
import { Link } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'

interface DemoMatch {
  id: string
  homeTeam: { name: string; shortName: string }
  awayTeam: { name: string; shortName: string }
  league: { name: string; slug: string }
  kickoffAt: string
  status: MatchStatus
  homeScore?: number
  awayScore?: number
  slug: string
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })

  return {
    title: t('today_matches'),
    description: 'Today\'s football matches with AI analysis',
  }
}

// Demo matches data (Football only)
const demoMatches: DemoMatch[] = [
  {
    id: '1',
    homeTeam: { name: 'Arsenal', shortName: 'ARS' },
    awayTeam: { name: 'Chelsea', shortName: 'CHE' },
    league: { name: 'Premier League', slug: 'epl' },
    kickoffAt: new Date(new Date().setHours(20, 0)).toISOString(),
    status: 'SCHEDULED',
    slug: 'epl/arsenal-vs-chelsea',
  },
  {
    id: '2',
    homeTeam: { name: 'Liverpool', shortName: 'LIV' },
    awayTeam: { name: 'Manchester City', shortName: 'MCI' },
    league: { name: 'Premier League', slug: 'epl' },
    kickoffAt: new Date(new Date().setHours(17, 30)).toISOString(),
    status: 'LIVE',
    homeScore: 2,
    awayScore: 1,
    slug: 'epl/liverpool-vs-manchester-city',
  },
  {
    id: '3',
    homeTeam: { name: 'Barcelona', shortName: 'BAR' },
    awayTeam: { name: 'Real Madrid', shortName: 'RMA' },
    league: { name: 'La Liga', slug: 'laliga' },
    kickoffAt: new Date(new Date().setHours(22, 0)).toISOString(),
    status: 'SCHEDULED',
    slug: 'laliga/barcelona-vs-real-madrid',
  },
  {
    id: '4',
    homeTeam: { name: 'Bayern Munich', shortName: 'BAY' },
    awayTeam: { name: 'Borussia Dortmund', shortName: 'BVB' },
    league: { name: 'Bundesliga', slug: 'bundesliga' },
    kickoffAt: new Date(new Date().setHours(21, 30)).toISOString(),
    status: 'SCHEDULED',
    slug: 'bundesliga/bayern-vs-dortmund',
  },
  {
    id: '5',
    homeTeam: { name: 'Inter Milan', shortName: 'INT' },
    awayTeam: { name: 'AC Milan', shortName: 'ACM' },
    league: { name: 'Serie A', slug: 'serie-a' },
    kickoffAt: new Date(new Date().setHours(22, 45)).toISOString(),
    status: 'SCHEDULED',
    slug: 'serie-a/inter-vs-milan',
  },
]

function MatchCard({ match }: { match: DemoMatch }) {
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')

  const statusColors = {
    SCHEDULED: 'bg-blue-500',
    LIVE: 'bg-red-500 animate-pulse',
    FINISHED: 'bg-gray-500',
    POSTPONED: 'bg-yellow-500',
    CANCELLED: 'bg-gray-400',
  }

  const statusLabels = {
    SCHEDULED: '예정',
    LIVE: '진행중',
    FINISHED: '종료',
    POSTPONED: '연기',
    CANCELLED: '취소',
  }

  return (
    <Link href={`/match/${match.slug}`}>
      <Card className="match-card">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{match.league.name}</span>
            <Badge className={`${statusColors[match.status]} text-white`}>
              {statusLabels[match.status]}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-xs font-bold">{match.homeTeam.shortName}</span>
                </div>
                <span className="font-medium">{match.homeTeam.name}</span>
              </div>
              <span className="text-2xl font-bold">
                {match.status !== 'SCHEDULED' ? match.homeScore : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-xs font-bold">{match.awayTeam.shortName}</span>
                </div>
                <span className="font-medium">{match.awayTeam.name}</span>
              </div>
              <span className="text-2xl font-bold">
                {match.status !== 'SCHEDULED' ? match.awayScore : '-'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center text-sm text-muted-foreground">
            <Clock className="mr-1 h-4 w-4" />
            {kickoffTime}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function TodayMatchesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const dateLocale = locale === 'ko' ? ko : enUS
  const today = format(new Date(), 'yyyy년 MM월 dd일 (EEEE)', { locale: dateLocale })

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">오늘의 경기</h1>
        <p className="flex items-center text-muted-foreground">
          <Calendar className="mr-2 h-5 w-5" />
          {today}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demoMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>

      {demoMatches.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          오늘 예정된 경기가 없습니다.
        </div>
      )}
    </div>
  )
}

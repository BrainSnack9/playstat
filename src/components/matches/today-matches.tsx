'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { Calendar, Clock } from 'lucide-react'

interface Match {
  id: string
  homeTeam: {
    name: string
    shortName?: string
    logoUrl?: string
  }
  awayTeam: {
    name: string
    shortName?: string
    logoUrl?: string
  }
  league: {
    name: string
  }
  kickoffAt: string
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'
  homeScore?: number
  awayScore?: number
  slug?: string
}

// Demo data for initial display
const demoMatches: Match[] = [
  {
    id: '1',
    homeTeam: { name: 'Arsenal', shortName: 'ARS' },
    awayTeam: { name: 'Chelsea', shortName: 'CHE' },
    league: { name: 'Premier League' },
    kickoffAt: new Date().toISOString(),
    status: 'SCHEDULED',
    slug: 'arsenal-vs-chelsea',
  },
  {
    id: '2',
    homeTeam: { name: 'Barcelona', shortName: 'BAR' },
    awayTeam: { name: 'Real Madrid', shortName: 'RMA' },
    league: { name: 'La Liga' },
    kickoffAt: new Date().toISOString(),
    status: 'LIVE',
    homeScore: 1,
    awayScore: 1,
    slug: 'barcelona-vs-real-madrid',
  },
  {
    id: '3',
    homeTeam: { name: 'Bayern Munich', shortName: 'BAY' },
    awayTeam: { name: 'Dortmund', shortName: 'BVB' },
    league: { name: 'Bundesliga' },
    kickoffAt: new Date().toISOString(),
    status: 'FINISHED',
    homeScore: 3,
    awayScore: 1,
    slug: 'bayern-vs-dortmund',
  },
]

function MatchStatusBadge({ status }: { status: Match['status'] }) {
  const t = useTranslations('match')

  const statusConfig = {
    SCHEDULED: { label: t('upcoming'), className: 'badge-upcoming' },
    LIVE: { label: t('live'), className: 'badge-live' },
    FINISHED: { label: t('finished'), className: 'badge-finished' },
    POSTPONED: { label: t('postponed'), className: 'bg-yellow-500 text-white' },
    CANCELLED: { label: t('cancelled'), className: 'bg-gray-400 text-white' },
  }

  const config = statusConfig[status]

  return <Badge className={config.className}>{config.label}</Badge>
}

function MatchCard({ match }: { match: Match }) {
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')

  return (
    <Link href={`/match/${match.slug || match.id}`}>
      <Card className="match-card">
        <CardContent className="p-4">
          {/* League & Status */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{match.league.name}</span>
            <MatchStatusBadge status={match.status} />
          </div>

          {/* Teams */}
          <div className="space-y-2">
            {/* Home Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <span className="text-xs font-semibold">
                    {match.homeTeam.shortName || match.homeTeam.name.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium">{match.homeTeam.name}</span>
              </div>
              {match.status !== 'SCHEDULED' && (
                <span className="text-xl font-bold">{match.homeScore ?? '-'}</span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <span className="text-xs font-semibold">
                    {match.awayTeam.shortName || match.awayTeam.name.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium">{match.awayTeam.name}</span>
              </div>
              {match.status !== 'SCHEDULED' && (
                <span className="text-xl font-bold">{match.awayScore ?? '-'}</span>
              )}
            </div>
          </div>

          {/* Kickoff Time */}
          {match.status === 'SCHEDULED' && (
            <div className="mt-3 flex items-center justify-center text-sm text-muted-foreground">
              <Clock className="mr-1 h-4 w-4" />
              {kickoffTime}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function TodayMatches() {
  // TODO: Fetch from API
  const matches = demoMatches
  const isLoading = false

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-3 h-4 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">오늘 예정된 경기가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  )
}

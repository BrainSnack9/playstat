import { Link } from '@/i18n/routing'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Calendar, Clock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'

// KST (UTC+9) 오프셋 (밀리초)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function getKSTDayRange(): { start: Date; end: Date } {
  const now = new Date()
  const kstTime = new Date(now.getTime() + KST_OFFSET_MS)

  const kstDateStart = new Date(
    Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 0, 0, 0)
  )
  const utcStart = new Date(kstDateStart.getTime() - KST_OFFSET_MS)

  const kstDateEnd = new Date(
    Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 23, 59, 59)
  )
  const utcEnd = new Date(kstDateEnd.getTime() - KST_OFFSET_MS)

  return { start: utcStart, end: utcEnd }
}

// Status translations mapping
const STATUS_KEYS: Record<string, string> = {
  SCHEDULED: 'upcoming',
  TIMED: 'upcoming',
  IN_PLAY: 'live',
  PAUSED: 'paused',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
}

async function getTodayMatches() {
  const { start, end } = getKSTDayRange()

  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      homeTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true },
      },
      awayTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true },
      },
      league: {
        select: { name: true, code: true },
      },
    },
    orderBy: { kickoffAt: 'asc' },
    take: 6,
  })

  return matches
}

type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED'

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500 text-white',
  TIMED: 'bg-blue-500 text-white',
  IN_PLAY: 'bg-red-500 text-white animate-pulse',
  PAUSED: 'bg-yellow-500 text-white',
  FINISHED: 'bg-gray-500 text-white',
  POSTPONED: 'bg-yellow-500 text-white',
  CANCELLED: 'bg-gray-400 text-white',
  SUSPENDED: 'bg-orange-500 text-white',
}

function MatchStatusBadge({ status, label }: { status: string; label: string }) {
  const className = STATUS_STYLES[status] || STATUS_STYLES.SCHEDULED
  return <Badge className={className}>{label}</Badge>
}

interface MatchCardProps {
  match: {
    id: string
    slug: string | null
    kickoffAt: Date
    status: string
    homeScore: number | null
    awayScore: number | null
    homeTeam: {
      id: string
      name: string
      shortName: string | null
      logoUrl: string | null
    }
    awayTeam: {
      id: string
      name: string
      shortName: string | null
      logoUrl: string | null
    }
    league: {
      name: string
      code: string | null
    }
  }
  statusLabel: string
}

function MatchCard({ match, statusLabel }: MatchCardProps) {
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')
  const isScheduled = match.status === 'SCHEDULED' || match.status === 'TIMED'

  return (
    <Link href={`/match/${match.slug || match.id}`}>
      <Card className="transition-shadow hover:shadow-md h-full">
        <CardContent className="p-4">
          {/* League & Status */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{match.league.name}</span>
            <MatchStatusBadge status={match.status} label={statusLabel} />
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
                <span className="font-medium text-sm">{match.homeTeam.name}</span>
              </div>
              {!isScheduled && (
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
                <span className="font-medium text-sm">{match.awayTeam.name}</span>
              </div>
              {!isScheduled && (
                <span className="text-xl font-bold">{match.awayScore ?? '-'}</span>
              )}
            </div>
          </div>

          {/* Kickoff Time */}
          {isScheduled && (
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

export async function TodayMatches() {
  const matches = await getTodayMatches()
  const t = await getTranslations('match')
  const home = await getTranslations('home')

  // Get status labels for all matches
  const getStatusLabel = (status: string): string => {
    const key = STATUS_KEYS[status] || 'upcoming'
    return t(key as 'upcoming' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'paused' | 'suspended')
  }

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
        <MatchCard key={match.id} match={match} statusLabel={getStatusLabel(match.status)} />
      ))}
    </div>
  )
}

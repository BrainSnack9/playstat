'use client'

import { format } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'
import { Clock, Sparkles, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import Image from 'next/image'
import { useFavoriteTeams } from '@/stores/favorite-teams'
import { useTranslations } from 'next-intl'

interface MatchCardProps {
  match: {
    id: string
    slug: string
    kickoffAt: Date
    status: string
    homeScore: number | null
    awayScore: number | null
    homeTeam: {
      id: string
      name: string
      shortName: string | null
      tla: string | null
      logoUrl: string | null
    }
    awayTeam: {
      id: string
      name: string
      shortName: string | null
      tla: string | null
      logoUrl: string | null
    }
    league: {
      name: string
      logoUrl: string | null
    }
    matchAnalysis: { id: string } | null
  }
  locale: string
  showDate?: boolean
}

const STATUS_KEYS: Record<string, string> = {
  SCHEDULED: 'upcoming',
  TIMED: 'upcoming',
  LIVE: 'live',
  IN_PLAY: 'live',
  PAUSED: 'paused',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
}

export function MatchCard({ match, locale, showDate = false }: MatchCardProps) {
  const { favoriteTeamIds } = useFavoriteTeams()
  const t = useTranslations('match')
  const dateLocale = locale === 'ko' ? ko : enUS
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')
  const kickoffDate = format(new Date(match.kickoffAt), locale === 'ko' ? 'M월 d일 (EEE)' : 'MMM d (EEE)', {
    locale: dateLocale,
  })

  const hasHomeFavorite = favoriteTeamIds.includes(match.homeTeam.id)
  const hasAwayFavorite = favoriteTeamIds.includes(match.awayTeam.id)
  const hasFavorite = hasHomeFavorite || hasAwayFavorite

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-500',
    TIMED: 'bg-blue-500',
    LIVE: 'bg-red-500 animate-pulse',
    IN_PLAY: 'bg-red-500 animate-pulse',
    FINISHED: 'bg-gray-500',
    POSTPONED: 'bg-yellow-500',
    CANCELLED: 'bg-gray-400',
    SUSPENDED: 'bg-orange-500',
    PAUSED: 'bg-yellow-500',
  }

  const getStatusLabel = (status: string): string => {
    const key = STATUS_KEYS[status] || 'upcoming'
    return t(key as 'upcoming' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'paused' | 'suspended')
  }

  return (
    <Link href={`/match/${match.slug}`}>
      <Card
        className={`match-card relative transition-all hover:shadow-md hover:border-primary/50 ${
          hasFavorite ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''
        }`}
      >
        {/* 즐겨찾기 배지 */}
        {hasFavorite && (
          <div className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 shadow-md z-10">
            <Star className="h-3.5 w-3.5 fill-white text-white" />
          </div>
        )}

        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {match.league.logoUrl && (
                <Image
                  src={match.league.logoUrl}
                  alt={match.league.name}
                  width={20}
                  height={20}
                  className="rounded"
                />
              )}
              <span className="text-xs text-muted-foreground">{match.league.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.matchAnalysis && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              <Badge className={`${statusColors[match.status]} text-white`}>{getStatusLabel(match.status)}</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {/* 홈팀 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {match.homeTeam.logoUrl ? (
                  <Image
                    src={match.homeTeam.logoUrl}
                    alt={match.homeTeam.name}
                    width={36}
                    height={36}
                    className="rounded"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <span className="text-xs font-bold">{match.homeTeam.tla || match.homeTeam.shortName}</span>
                  </div>
                )}
                <span className={`font-medium ${hasHomeFavorite ? 'text-yellow-500' : ''}`}>
                  {match.homeTeam.name}
                  {hasHomeFavorite && <Star className="inline ml-1 h-3 w-3 fill-yellow-500 text-yellow-500" />}
                </span>
              </div>
              <span className="text-2xl font-bold">
                {match.status === 'FINISHED' || match.status === 'LIVE' ? (match.homeScore ?? 0) : '-'}
              </span>
            </div>

            {/* 원정팀 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {match.awayTeam.logoUrl ? (
                  <Image
                    src={match.awayTeam.logoUrl}
                    alt={match.awayTeam.name}
                    width={36}
                    height={36}
                    className="rounded"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <span className="text-xs font-bold">{match.awayTeam.tla || match.awayTeam.shortName}</span>
                  </div>
                )}
                <span className={`font-medium ${hasAwayFavorite ? 'text-yellow-500' : ''}`}>
                  {match.awayTeam.name}
                  {hasAwayFavorite && <Star className="inline ml-1 h-3 w-3 fill-yellow-500 text-yellow-500" />}
                </span>
              </div>
              <span className="text-2xl font-bold">
                {match.status === 'FINISHED' || match.status === 'LIVE' ? (match.awayScore ?? 0) : '-'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center text-sm text-muted-foreground">
            <Clock className="mr-1 h-4 w-4" />
            {showDate ? `${kickoffDate} ${kickoffTime}` : kickoffTime}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

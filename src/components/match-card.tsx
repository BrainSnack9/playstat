'use client'

import { Clock, Star, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import { useFavoriteTeams } from '@/stores/favorite-teams'
import { useTranslations } from 'next-intl'
import { MatchStatusBadge } from './match-status-badge'
import { MATCH_STATUS_KEYS } from '@/lib/constants'
import { LeagueLogo } from '@/components/ui/league-logo'
import { TeamLogo } from '@/components/ui/team-logo'
import { LocalTime, LocalDateTime } from '@/components/local-time'

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
    matchAnalysis?: { id: string } | null
  }
  locale?: string
  showDate?: boolean
}

export function MatchCard({ match, showDate = false }: MatchCardProps) {
  const { favoriteTeamIds } = useFavoriteTeams()
  const t = useTranslations('match')

  const hasHomeFavorite = favoriteTeamIds.includes(match.homeTeam.id)
  const hasAwayFavorite = favoriteTeamIds.includes(match.awayTeam.id)
  const hasFavorite = hasHomeFavorite || hasAwayFavorite

  const isFinished = match.status === 'FINISHED'
  const homeWins = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)
  const awayWins = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)

  return (
    <Link href={`/match/${match.slug}`}>
      <Card
        className={`match-card relative transition-all hover:shadow-md hover:border-primary/50 ${
          hasFavorite ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''
        }`}
      >
        {/* 즐겨찾기 배지 */}
        {hasFavorite && (
          <div className="absolute -top-1.5 -right-1.5 rtl:-left-1.5 rtl:right-auto flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 shadow-md z-10">
            <Star className="h-3.5 w-3.5 fill-white text-white" />
          </div>
        )}

        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LeagueLogo logoUrl={match.league.logoUrl} name={match.league.name} size="sm" />
              <span className="text-xs text-muted-foreground">{match.league.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.matchAnalysis && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  {t('ai_analysis')}
                </Badge>
              )}
          <MatchStatusBadge 
            status={match.status} 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={t(MATCH_STATUS_KEYS[match.status] as any)} 
          />
            </div>
          </div>

          <div className="space-y-3">
            {/* 홈팀 */}
            <div className={`flex items-center justify-between p-1 rounded-md transition-colors ${homeWins ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center gap-2">
                <TeamLogo
                  logoUrl={match.homeTeam.logoUrl}
                  name={match.homeTeam.name}
                  tla={match.homeTeam.tla}
                  shortName={match.homeTeam.shortName}
                  size="md"
                  grayscale={isFinished && !homeWins}
                />
                <span className={`font-medium ${hasHomeFavorite ? 'text-yellow-500' : ''} ${homeWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                  {match.homeTeam.name}
                  {hasHomeFavorite && <Star className="inline ms-1 h-3 w-3 fill-yellow-500 text-yellow-500" />}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {homeWins && <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                <span className={`text-2xl font-bold ${homeWins ? 'text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                  {match.status === 'FINISHED' || match.status === 'LIVE' ? (match.homeScore ?? 0) : '-'}
                </span>
              </div>
            </div>

            {/* 원정팀 */}
            <div className={`flex items-center justify-between p-1 rounded-md transition-colors ${awayWins ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center gap-2">
                <TeamLogo
                  logoUrl={match.awayTeam.logoUrl}
                  name={match.awayTeam.name}
                  tla={match.awayTeam.tla}
                  shortName={match.awayTeam.shortName}
                  size="md"
                  grayscale={isFinished && !awayWins}
                />
                <span className={`font-medium ${hasAwayFavorite ? 'text-yellow-500' : ''} ${awayWins ? 'font-bold text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                  {match.awayTeam.name}
                  {hasAwayFavorite && <Star className="inline ms-1 h-3 w-3 fill-yellow-500 text-yellow-500" />}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {awayWins && <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                <span className={`text-2xl font-bold ${awayWins ? 'text-foreground' : isFinished ? 'text-muted-foreground' : ''}`}>
                  {match.status === 'FINISHED' || match.status === 'LIVE' ? (match.awayScore ?? 0) : '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center text-sm text-muted-foreground">
            <Clock className="me-1 h-4 w-4" />
            {showDate ? (
              <LocalDateTime utcTime={match.kickoffAt} dateFormat="MM/dd" timeFormat="HH:mm" />
            ) : (
              <LocalTime utcTime={match.kickoffAt} formatStr="HH:mm" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

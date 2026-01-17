'use client'

import { Trophy, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import Image from 'next/image'
import { useFavoriteTeams } from '@/stores/favorite-teams'

interface TeamCardProps {
  team: {
    id: string
    name: string
    shortName: string | null
    tla: string | null
    logoUrl: string | null
    league: {
      name: string
      country: string | null
    }
  }
  locale: string
}

export function TeamCard({ team }: Omit<TeamCardProps, 'locale'>) {
  const { favoriteTeamIds, toggleFavoriteTeam } = useFavoriteTeams()
  const isFavorite = favoriteTeamIds.includes(team.id)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavoriteTeam(team.id)
  }

  return (
    <Link href={`/team/${team.id}`}>
      <Card
        className={`transition-all hover:shadow-md hover:border-primary/50 ${
          isFavorite ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''
        }`}
      >
        <CardContent className="flex items-center p-4">
          {team.logoUrl ? (
            <Image
              src={team.logoUrl}
              alt={team.name}
              width={56}
              height={56}
              className="mr-4 rounded"
            />
          ) : (
            <div className="mr-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg font-bold text-primary">{team.tla || team.shortName}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate ${isFavorite ? 'text-yellow-500' : ''}`}>
              {team.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-3 w-3 shrink-0" />
              <span className="truncate">{team.league.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {team.league.country && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {team.league.country}
              </Badge>
            )}
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-full transition-colors ${
                isFavorite
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-white' : ''}`} />
            </button>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

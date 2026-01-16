'use client'

import { Star } from 'lucide-react'
import { useFavoriteTeams } from '@/stores/favorite-teams'

interface FavoriteTeamBadgeProps {
  homeTeamId: string
  awayTeamId: string
}

export function FavoriteTeamBadge({ homeTeamId, awayTeamId }: FavoriteTeamBadgeProps) {
  const { favoriteTeamIds } = useFavoriteTeams()

  const hasHomeFavorite = favoriteTeamIds.includes(homeTeamId)
  const hasAwayFavorite = favoriteTeamIds.includes(awayTeamId)

  if (!hasHomeFavorite && !hasAwayFavorite) {
    return null
  }

  return (
    <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 shadow-sm">
      <Star className="h-3 w-3 fill-white text-white" />
    </div>
  )
}

// 경기 카드 래퍼 - 즐겨찾기 팀이 있으면 특별한 스타일 적용
export function useFavoriteMatchStyle(homeTeamId: string, awayTeamId: string) {
  const { favoriteTeamIds } = useFavoriteTeams()

  const hasHomeFavorite = favoriteTeamIds.includes(homeTeamId)
  const hasAwayFavorite = favoriteTeamIds.includes(awayTeamId)
  const hasFavorite = hasHomeFavorite || hasAwayFavorite

  return {
    hasFavorite,
    hasHomeFavorite,
    hasAwayFavorite,
    cardClassName: hasFavorite ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : '',
  }
}

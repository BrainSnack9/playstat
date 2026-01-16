'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoriteTeamsState {
  favoriteTeamIds: string[]
  addFavoriteTeam: (teamId: string) => void
  removeFavoriteTeam: (teamId: string) => void
  toggleFavoriteTeam: (teamId: string) => void
  isFavorite: (teamId: string) => boolean
}

export const useFavoriteTeams = create<FavoriteTeamsState>()(
  persist(
    (set, get) => ({
      favoriteTeamIds: [],

      addFavoriteTeam: (teamId: string) => {
        set((state) => ({
          favoriteTeamIds: state.favoriteTeamIds.includes(teamId)
            ? state.favoriteTeamIds
            : [...state.favoriteTeamIds, teamId],
        }))
      },

      removeFavoriteTeam: (teamId: string) => {
        set((state) => ({
          favoriteTeamIds: state.favoriteTeamIds.filter((id) => id !== teamId),
        }))
      },

      toggleFavoriteTeam: (teamId: string) => {
        const { favoriteTeamIds } = get()
        if (favoriteTeamIds.includes(teamId)) {
          set({ favoriteTeamIds: favoriteTeamIds.filter((id) => id !== teamId) })
        } else {
          set({ favoriteTeamIds: [...favoriteTeamIds, teamId] })
        }
      },

      isFavorite: (teamId: string) => {
        return get().favoriteTeamIds.includes(teamId)
      },
    }),
    {
      name: 'favorite-teams',
    }
  )
)

'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SportId } from '@/lib/sport'

export const SPORTS_CONFIG = [
  {
    id: 'football' as SportId,
    label: 'Football',
    labelKo: '축구',
    color: 'text-lime-500',
    bgColor: 'bg-lime-500',
    hoverBg: 'hover:bg-lime-500/10',
    activeBg: 'bg-lime-500/20',
    borderColor: 'border-lime-500',
  },
  {
    id: 'basketball' as SportId,
    label: 'Basketball',
    labelKo: '농구',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    hoverBg: 'hover:bg-orange-500/10',
    activeBg: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
  },
  {
    id: 'baseball' as SportId,
    label: 'Baseball',
    labelKo: '야구',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    hoverBg: 'hover:bg-emerald-500/10',
    activeBg: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500',
  },
]

export const STORAGE_KEY = 'ps_preferred_sport'

interface SportTabsProps {
  currentSport: SportId
  basePath: string // 예: '/matches', '/leagues', '/teams'
}

export function SportTabs({ currentSport, basePath }: SportTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 현재 스포츠를 로컬스토리지와 쿠키에 저장 (다른 페이지에서 참조할 수 있도록)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, currentSport)
      document.cookie = `${STORAGE_KEY}=${currentSport};path=/;max-age=31536000`
    }
  }, [currentSport])

  const handleSportChange = (sportId: SportId) => {
    if (sportId === currentSport) return

    // 로컬스토리지에 선호 스포츠 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, sportId)
    }

    // 현재 경로에서 스포츠 부분만 교체
    // 예: /ko/football/matches → /ko/basketball/matches
    const pathParts = pathname.split('/')
    const sportIndex = pathParts.findIndex(part =>
      part === 'football' || part === 'basketball' || part === 'baseball'
    )

    if (sportIndex !== -1) {
      pathParts[sportIndex] = sportId
      router.push(pathParts.join('/'))
    } else {
      // 스포츠 경로가 없으면 새로 추가
      router.push(`/${sportId}${basePath}`)
    }
  }

  if (!mounted) {
    return (
      <div className="flex gap-2 mb-6">
        {SPORTS_CONFIG.map((sport) => (
          <div
            key={sport.id}
            className={cn(
              'px-4 py-2 rounded-lg border transition-all',
              sport.id === currentSport
                ? `${sport.activeBg} ${sport.borderColor} ${sport.color}`
                : 'border-border bg-background text-muted-foreground'
            )}
          >
            <span className="text-sm font-medium">{sport.label}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 mb-6">
      {SPORTS_CONFIG.map((sport) => {
        const isActive = sport.id === currentSport

        return (
          <button
            key={sport.id}
            onClick={() => handleSportChange(sport.id)}
            className={cn(
              'px-4 py-2 rounded-lg border transition-all',
              isActive
                ? `${sport.activeBg} ${sport.borderColor} ${sport.color} font-semibold`
                : `border-border bg-background text-muted-foreground ${sport.hoverBg}`
            )}
          >
            <span className="text-sm font-medium">{sport.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// 로컬스토리지에서 선호 스포츠 가져오기 (클라이언트용)
export function getPreferredSport(): SportId {
  if (typeof window === 'undefined') return 'football'
  return (localStorage.getItem(STORAGE_KEY) as SportId) || 'football'
}

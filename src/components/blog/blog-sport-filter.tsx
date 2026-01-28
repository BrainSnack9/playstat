'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SportId } from '@/lib/sport'

const SPORTS_CONFIG = [
  {
    id: 'football' as SportId,
    label: 'Football',
    labelKo: '축구',
    color: 'text-lime-500',
    hoverBg: 'hover:bg-lime-500/10',
    activeBg: 'bg-lime-500/20',
    borderColor: 'border-lime-500',
  },
  {
    id: 'basketball' as SportId,
    label: 'Basketball',
    labelKo: '농구',
    color: 'text-orange-500',
    hoverBg: 'hover:bg-orange-500/10',
    activeBg: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
  },
  {
    id: 'baseball' as SportId,
    label: 'Baseball',
    labelKo: '야구',
    color: 'text-emerald-500',
    hoverBg: 'hover:bg-emerald-500/10',
    activeBg: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500',
  },
]

const STORAGE_KEY = 'ps_preferred_sport'

interface BlogSportFilterProps {
  currentSport: SportId
  basePath: string
  locale: string
}

export function BlogSportFilter({ currentSport, basePath, locale }: BlogSportFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSportChange = (sportId: SportId) => {
    if (sportId === currentSport) return

    // 로컬스토리지와 쿠키에 선호 스포츠 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, sportId)
      document.cookie = `${STORAGE_KEY}=${sportId};path=/;max-age=31536000`
    }

    // 쿼리 파라미터 업데이트
    const params = new URLSearchParams(searchParams.toString())
    params.set('sport', sportId)
    router.push(`${basePath}?${params.toString()}`)
  }

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        {SPORTS_CONFIG.map((sport) => (
          <div
            key={sport.id}
            className={cn(
              'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all text-xs sm:text-sm',
              sport.id === currentSport
                ? `${sport.activeBg} ${sport.borderColor} ${sport.color} font-medium`
                : 'border-transparent bg-transparent text-gray-400'
            )}
          >
            {locale === 'ko' ? sport.labelKo : sport.label}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {SPORTS_CONFIG.map((sport) => {
        const isActive = sport.id === currentSport

        return (
          <button
            key={sport.id}
            onClick={() => handleSportChange(sport.id)}
            className={cn(
              'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all text-xs sm:text-sm',
              isActive
                ? `${sport.activeBg} ${sport.borderColor} ${sport.color} font-medium`
                : `border-transparent bg-transparent text-gray-400 ${sport.hoverBg} hover:text-white`
            )}
          >
            {locale === 'ko' ? sport.labelKo : sport.label}
          </button>
        )
      })}
    </div>
  )
}

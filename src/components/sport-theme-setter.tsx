'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import type { SportId } from '@/lib/sport'

const SPORT_PATHS: Record<string, SportId> = {
  football: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
}

export function SportThemeSetter() {
  const pathname = usePathname()

  useEffect(() => {
    // URL 경로에서 스포츠 감지
    const pathParts = pathname.split('/')
    let detectedSport: SportId = 'football'

    for (const part of pathParts) {
      if (SPORT_PATHS[part]) {
        detectedSport = SPORT_PATHS[part]
        break
      }
    }

    // html 태그의 data-sport 속성 업데이트
    document.documentElement.setAttribute('data-sport', detectedSport)
  }, [pathname])

  return null
}

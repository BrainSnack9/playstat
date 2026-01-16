'use client'

import { useEffect } from 'react'

export function TimezoneDetector() {
  useEffect(() => {
    // 브라우저에서 타임존 감지
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // 현재 쿠키에 저장된 타임존 확인
    const currentTz = document.cookie
      .split('; ')
      .find((row) => row.startsWith('timezone='))
      ?.split('=')[1]

    // 타임존이 다르면 쿠키 업데이트
    if (currentTz !== timezone) {
      // 1년 유효한 쿠키 설정
      const expires = new Date()
      expires.setFullYear(expires.getFullYear() + 1)
      document.cookie = `timezone=${timezone}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`

      // 페이지 새로고침하여 서버에서 새 타임존 적용
      // 첫 방문시에만 새로고침 (무한 루프 방지)
      if (currentTz !== undefined) {
        window.location.reload()
      }
    }
  }, [])

  // 렌더링 없음
  return null
}

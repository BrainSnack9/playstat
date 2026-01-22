'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// TypeScript 지원
declare global {
  interface Window {
    ezstandalone: {
      cmd: Array<() => void>
      showAds: (...ids: number[]) => void
      refresh: () => void
    }
  }
}

/**
 * Ezoic 헤더 스크립트
 * - Privacy 스크립트 (먼저 로드)
 * - Ezoic 메인 스크립트
 */
export function EzoicScript() {
  const pathname = usePathname()

  // 페이지 이동 시 광고 새로고침 (Next.js 클라이언트 네비게이션 대응)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ezstandalone) {
      window.ezstandalone.cmd = window.ezstandalone.cmd || []
      window.ezstandalone.cmd.push(function () {
        window.ezstandalone.refresh()
      })
    }
  }, [pathname])

  return (
    <>
      {/* Privacy Scripts (먼저 로드) */}
      <Script
        data-cfasync="false"
        src="https://cmp.gatekeeperconsent.com/min.js"
        strategy="beforeInteractive"
      />
      <Script
        data-cfasync="false"
        src="https://the.gatekeeperconsent.com/cmp.min.js"
        strategy="beforeInteractive"
      />

      {/* Ezoic Header Script */}
      <Script
        async
        src="//www.ezojs.com/ezoic/sa.min.js"
        strategy="beforeInteractive"
      />
      <Script id="ezoic-init" strategy="beforeInteractive">
        {`
          window.ezstandalone = window.ezstandalone || {};
          ezstandalone.cmd = ezstandalone.cmd || [];
        `}
      </Script>
    </>
  )
}

/**
 * Ezoic 광고 플레이스홀더
 * @param id - Ezoic 대시보드에서 생성한 플레이스홀더 ID
 */
interface EzoicAdProps {
  id: number
  className?: string
}

export function EzoicAd({ id, className }: EzoicAdProps) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ezstandalone) {
      window.ezstandalone.cmd = window.ezstandalone.cmd || []
      window.ezstandalone.cmd.push(function () {
        window.ezstandalone.showAds(id)
      })
    }
  }, [id])

  return (
    <div id={`ezoic-pub-ad-placeholder-${id}`} className={className} />
  )
}

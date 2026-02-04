'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { spaceGrotesk } from '@/lib/fonts'

export function Footer({ variant = 'default' }: { variant?: 'default' | 'landing' | 'neon' }) {
  const t = useTranslations('common')
  const footer = useTranslations('footer')
  const pathname = usePathname()
  const isNeon = variant !== 'default'

  // Hydration 에러 방지: 클라이언트에서만 계산
  const [mounted, setMounted] = useState(false)
  const [currentSport, setCurrentSport] = useState<string>('football')
  const [legalBase, setLegalBase] = useState('')
  // 오늘 날짜 (UTC 기준) - SEO를 위해 실제 날짜 URL 사용
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    setMounted(true)

    // 오늘 날짜 업데이트 (UTC 기준)
    setTodayDate(new Date().toISOString().slice(0, 10))

    // Legal base URL 설정
    const hostname = window.location.hostname
    setLegalBase(
      hostname.endsWith('localhost') || hostname === 'localhost'
        ? 'http://localhost:3030'
        : window.location.origin
    )

    // 스포츠 타입 감지 (경로 기반)
    if (pathname.includes('/football')) setCurrentSport('football')
    else if (pathname.includes('/basketball')) setCurrentSport('basketball')
    else if (pathname.includes('/baseball')) setCurrentSport('baseball')
    else setCurrentSport('football') // 기본값
  }, [pathname])

  return (
    <footer
      className={cn(
        'border-t',
        isNeon
          ? `border-white/10 bg-[#0b0f14] text-white/70 ${spaceGrotesk.className}`
          : 'bg-muted/30'
      )}
    >
      <div className="container py-6">
        <div className="flex flex-col items-center gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/app-icon-512.png"
              alt="PlayStat"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="font-semibold">PlayStat</span>
          </Link>

          {/* Main Navigation */}
          <nav className={cn(
            'flex flex-wrap items-center justify-center gap-4 text-sm',
            isNeon ? 'text-white/70' : 'text-muted-foreground'
          )}>
            <Link href={`/${currentSport}/matches`} className="hover:text-primary transition-colors">
              {t('matches')}
            </Link>
            <Link href={`/${currentSport}/leagues`} className="hover:text-primary transition-colors">
              {t('leagues')}
            </Link>
            <Link href={`/${currentSport}/daily/${todayDate}`} className="hover:text-primary transition-colors">
              {t('daily_report')}
            </Link>
          </nav>

          {/* Legal Links */}
          <nav
            className={cn(
              'flex flex-wrap items-center justify-center gap-4 text-xs',
              isNeon ? 'text-white/60' : 'text-muted-foreground'
            )}
          >
            <Link href="/" className="hover:text-primary transition-colors">
              {footer('main_hub')}
            </Link>
            <span className={cn(isNeon ? 'text-white/30' : 'text-muted-foreground/50')}>|</span>
            <a href={mounted ? `${legalBase}/privacy` : '/privacy'} className="hover:text-primary transition-colors">
              {footer('privacy')}
            </a>
            <span className={cn(isNeon ? 'text-white/30' : 'text-muted-foreground/50')}>|</span>
            <a href={mounted ? `${legalBase}/terms` : '/terms'} className="hover:text-primary transition-colors">
              {footer('terms')}
            </a>
          </nav>

          {/* Copyright */}
          <p className={cn('text-xs text-center', isNeon ? 'text-white/60' : 'text-muted-foreground')}>
            © 2026 PlayStat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

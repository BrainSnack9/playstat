'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { spaceGrotesk } from '@/lib/fonts'

export function Footer({ variant = 'default' }: { variant?: 'default' | 'landing' | 'neon' }) {
  const t = useTranslations('common')
  const footer = useTranslations('footer')
  const currentYear = new Date().getFullYear()
  const isNeon = variant !== 'default'
  const legalBase =
    typeof window !== 'undefined'
      ? window.location.hostname.endsWith('localhost')
        ? 'http://localhost:3030'
        : window.location.origin
      : ''

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
            <Link href="/matches/today" className="hover:text-primary transition-colors">
              {t('matches')}
            </Link>
            <Link href="/leagues" className="hover:text-primary transition-colors">
              {t('leagues')}
            </Link>
            <Link href="/daily/today" className="hover:text-primary transition-colors">
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
            <a href="https://playstat.space" className="hover:text-primary transition-colors">
              {footer('main_hub')}
            </a>
            <span className={cn(isNeon ? 'text-white/30' : 'text-muted-foreground/50')}>|</span>
            <a href={`${legalBase}/privacy`} className="hover:text-primary transition-colors">
              {footer('privacy')}
            </a>
            <span className={cn(isNeon ? 'text-white/30' : 'text-muted-foreground/50')}>|</span>
            <a href={`${legalBase}/terms`} className="hover:text-primary transition-colors">
              {footer('terms')}
            </a>
          </nav>

          {/* Copyright */}
          <p className={cn('text-xs text-center', isNeon ? 'text-white/60' : 'text-muted-foreground')}>
            © {currentYear} PlayStat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import Image from 'next/image'

export function Footer() {
  const t = useTranslations('common')
  const footer = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-6">
        <div className="flex flex-col items-center gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center space-x-2">
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
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
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
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-primary transition-colors">
              {footer('about')}
            </Link>
            <span className="text-muted-foreground/50">|</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              {footer('privacy')}
            </Link>
            <span className="text-muted-foreground/50">|</span>
            <Link href="/terms" className="hover:text-primary transition-colors">
              {footer('terms')}
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground text-center">
            © {currentYear} PlayStat. Data by{' '}
            <a
              href="https://www.football-data.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary underline"
            >
              Football-Data.org
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

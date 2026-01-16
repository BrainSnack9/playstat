'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Separator } from '@/components/ui/separator'
import { Trophy } from 'lucide-react'

export function Footer() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-background">
      <div className="container py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <Trophy className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">PlayStat</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-powered sports analysis platform
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <nav className="flex flex-col space-y-2">
              <Link href="/matches/today" className="text-sm text-muted-foreground hover:text-primary">
                Today&apos;s Matches
              </Link>
              <Link href="/leagues" className="text-sm text-muted-foreground hover:text-primary">
                Leagues
              </Link>
              <Link href="/news" className="text-sm text-muted-foreground hover:text-primary">
                News
              </Link>
            </nav>
          </div>

          {/* Sports */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Sports</h4>
            <nav className="flex flex-col space-y-2">
              <Link href="/league/epl" className="text-sm text-muted-foreground hover:text-primary">
                Premier League
              </Link>
              <Link href="/league/laliga" className="text-sm text-muted-foreground hover:text-primary">
                La Liga
              </Link>
              <Link href="/league/ucl" className="text-sm text-muted-foreground hover:text-primary">
                Champions League
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Legal</h4>
            <nav className="flex flex-col space-y-2">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-primary">
                {t('about')}
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">
                {t('privacy')}
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
                {t('terms')}
              </Link>
            </nav>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
          <p className="text-sm text-muted-foreground">
            {t('copyright', { year: currentYear })}
          </p>
          <p className="text-xs text-muted-foreground">
            Sports data provided by API-Football
          </p>
        </div>
      </div>
    </footer>
  )
}

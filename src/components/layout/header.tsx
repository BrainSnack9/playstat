'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Menu, Newspaper, Calendar, Users, ChartBar, Trophy } from 'lucide-react'
import Image from 'next/image'
import { LanguageSwitcher } from './language-switcher'
import { spaceGrotesk } from '@/lib/fonts'

const mainNav = [
  {
    key: 'matches',
    href: '/matches/today',
    icon: Calendar,
  },
  {
    key: 'leagues',
    href: '/leagues',
    icon: Trophy,
  },
  {
    key: 'teams',
    href: '/teams',
    icon: Users,
  },
  {
    key: 'news',
    href: '/news',
    icon: Newspaper,
  },
  {
    key: 'daily_report',
    href: '/daily/today',
    icon: ChartBar,
  },
]

const sportConfig: Record<string, { emoji: string; color: string }> = {
  football: { emoji: '⚽', color: 'bg-green-500/10 text-green-500 border-green-500/30' },
  basketball: { emoji: '🏀', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  baseball: { emoji: '⚾', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
}

export function Header({ variant = 'default' }: { variant?: 'default' | 'landing' | 'neon' }) {
  const t = useTranslations('common')
  const sports = useTranslations('sports')
  const pathname = usePathname()
  const showNav = variant !== 'landing'
  const isNeon = variant === 'neon'

  // 서브도메인에서 스포츠 타입 감지 (football.playstat.space, basketball.playstat.space 등)
  const getCurrentSport = (): string | null => {
    if (typeof window === 'undefined') return null
    const hostname = window.location.hostname
    if (hostname.startsWith('football.')) return 'football'
    if (hostname.startsWith('basketball.')) return 'basketball'
    if (hostname.startsWith('baseball.')) return 'baseball'
    // localhost에서는 경로로 판단
    if (hostname === 'localhost') {
      if (pathname.includes('/football')) return 'football'
      if (pathname.includes('/basketball')) return 'basketball'
      if (pathname.includes('/baseball')) return 'baseball'
    }
    return null
  }

  const currentSport = getCurrentSport()
  const sportInfo = currentSport ? sportConfig[currentSport] : null

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60',
        isNeon
          ? `border-white/10 bg-[#0b0f14]/90 text-white ${spaceGrotesk.className}`
          : 'bg-background/95'
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo + Sport Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/app-icon-512.png"
              alt="PlayStat"
              width={28}
              height={28}
              className="rounded"
            />
            <span className={cn('text-xl font-bold', isNeon && 'text-white')}>PlayStat</span>
          </Link>
          {sportInfo && (
            <Badge variant="outline" className={cn('hidden sm:flex px-2 py-1 text-xs font-medium', sportInfo.color)}>
              {sportInfo.emoji}&nbsp;&nbsp;{sports(currentSport!)}
            </Badge>
          )}
        </div>

        {/* Desktop Navigation */}
        {showNav && (
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {mainNav.map((item) => (
                <NavigationMenuItem key={item.key}>
                  <Link href={item.href} legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        pathname === item.href && (isNeon ? 'bg-primary/10 text-primary' : 'bg-accent'),
                        isNeon && 'bg-transparent text-white/70 hover:text-primary hover:bg-primary/10 focus:text-primary focus:bg-primary/10 data-[state=open]:text-primary data-[state=open]:bg-primary/10'
                      )}
                      style={isNeon ? { fontFamily: spaceGrotesk.style.fontFamily } : undefined}
                    >
                      <item.icon className="me-2 h-4 w-4" />
                      {t(item.key)}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {/* Mobile Menu */}
          {showNav && (
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className={cn(isNeon && 'bg-[#0b0f14] text-white')}>
                <nav className="flex flex-col gap-4 mt-8">
                  {mainNav.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                      'flex items-center gap-2 text-lg font-medium transition-colors hover:text-primary',
                      pathname === item.href && 'text-primary',
                      isNeon && 'text-white/80 hover:text-white'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{t(item.key)}</span>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}

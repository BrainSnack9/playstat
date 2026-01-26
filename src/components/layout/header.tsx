'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
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
import { Menu, Newspaper, Calendar, Users, ChartBar, Trophy, PenSquare } from 'lucide-react'
import Image from 'next/image'
import { LanguageSwitcher } from './language-switcher'
import { spaceGrotesk } from '@/lib/fonts'
import { useEffect, useState } from 'react'
import type { SportId } from '@/lib/sport'

const SPORT_STORAGE_KEY = 'ps_preferred_sport'

// 스포츠별 색상 (hex 값으로 인라인 스타일 적용)
const SPORT_COLORS: Record<SportId, { color: string; bgColor: string }> = {
  football: { color: '#84cc16', bgColor: 'rgba(132, 204, 22, 0.2)' },      // lime-500
  basketball: { color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.2)' },    // orange-500
  baseball: { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.2)' },      // emerald-500
}

// 스포츠별 네비게이션 생성
const getMainNav = (sport: SportId) => [
  {
    key: 'matches',
    href: `/${sport}/matches`,
    icon: Calendar,
  },
  {
    key: 'leagues',
    href: `/${sport}/leagues`,
    icon: Trophy,
  },
  {
    key: 'teams',
    href: `/${sport}/teams`,
    icon: Users,
  },
  {
    key: 'news',
    href: '/news',
    icon: Newspaper,
  },
  {
    key: 'daily_report',
    href: `/${sport}/daily/today`,
    icon: ChartBar,
  },
  {
    key: 'blog',
    href: '/blog',
    icon: PenSquare,
  },
]

export function Header({ variant = 'default' }: { variant?: 'default' | 'landing' | 'neon' }) {
  const t = useTranslations('common')
  const pathname = usePathname()
  const showNav = variant !== 'landing'
  const isNeon = variant === 'neon'

  // 현재 경로에서 스포츠 감지 또는 로컬스토리지에서 가져오기
  const [currentSport, setCurrentSport] = useState<SportId>('football')

  useEffect(() => {
    // 현재 경로에서 스포츠 감지
    const sportFromPath = pathname.match(/\/(football|basketball|baseball)\//)?.[1] as SportId | undefined

    if (sportFromPath) {
      // 경로에 스포츠가 있으면 그것을 사용하고 저장
      setCurrentSport(sportFromPath)
      localStorage.setItem(SPORT_STORAGE_KEY, sportFromPath)
    } else {
      // 경로에 없으면 로컬스토리지에서 가져오기
      const savedSport = localStorage.getItem(SPORT_STORAGE_KEY) as SportId | null
      if (savedSport && ['football', 'basketball', 'baseball'].includes(savedSport)) {
        setCurrentSport(savedSport)
      }
    }
  }, [pathname])

  const mainNav = getMainNav(currentSport)

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
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/app-icon-512.png"
            alt="PlayStat"
            width={28}
            height={28}
            className="rounded"
          />
          <span className={cn('text-xl font-bold', isNeon && 'text-white')}>PlayStat</span>
        </Link>

        {/* Desktop Navigation */}
        {showNav && (
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {mainNav.map((item) => {
                // daily_report는 /sport/daily로 시작하면 활성화
                const isActive = item.key === 'daily_report'
                  ? pathname.startsWith(`/${currentSport}/daily`)
                  : pathname === item.href
                const sportColor = SPORT_COLORS[currentSport]
                return (
                  <NavigationMenuItem key={item.key}>
                    <Link href={item.href} legacyBehavior passHref>
                      <NavigationMenuLink
                        className={cn(
                          navigationMenuTriggerStyle(),
                          'transition-colors',
                          isNeon && 'bg-transparent text-white/70'
                        )}
                        style={{
                          ...(isNeon ? { fontFamily: spaceGrotesk.style.fontFamily } : {}),
                          ...(isActive ? { color: sportColor.color, backgroundColor: sportColor.bgColor } : {}),
                          // CSS 변수로 hover 색상 설정
                          '--sport-color': sportColor.color,
                        } as React.CSSProperties}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = sportColor.color
                            e.currentTarget.style.backgroundColor = sportColor.bgColor
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = ''
                            e.currentTarget.style.backgroundColor = ''
                          }
                        }}
                      >
                        <item.icon className="me-2 h-4 w-4" />
                        {t(item.key)}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                )
              })}
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
                <nav className="flex flex-col gap-6 mt-8">
                  {mainNav.map((item) => {
                    const isActive = item.key === 'daily_report'
                      ? pathname.startsWith(`/${currentSport}/daily`)
                      : pathname === item.href
                    const sportColor = SPORT_COLORS[currentSport]
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 text-lg font-medium transition-colors',
                          isNeon && 'text-white/80'
                        )}
                        style={isActive ? { color: sportColor.color } : undefined}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = sportColor.color
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = ''
                          }
                        }}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{t(item.key)}</span>
                      </Link>
                    )
                  })}
                </nav>

                {/* Footer section */}
                <div className="absolute bottom-8 left-6 right-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Image
                      src="/app-icon-512.png"
                      alt="PlayStat"
                      width={16}
                      height={16}
                      className="rounded opacity-60"
                    />
                    <span>© {new Date().getFullYear()} PlayStat</span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}

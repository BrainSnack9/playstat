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
import { Menu, Newspaper, Calendar, Users, ChartBar, Trophy } from 'lucide-react'
import Image from 'next/image'
import { LanguageSwitcher } from './language-switcher'

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

export function Header() {
  const t = useTranslations('common')
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/app-icon-512.png"
            alt="PlayStat"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="text-xl font-bold">PlayStat</span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {mainNav.map((item) => (
              <NavigationMenuItem key={item.key}>
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      pathname === item.href && 'bg-accent'
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {t(item.key)}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side */}
        <div className="flex items-center space-x-2">
          <LanguageSwitcher />

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="flex flex-col space-y-4 mt-8">
                {mainNav.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 text-lg font-medium transition-colors hover:text-primary',
                      pathname === item.href && 'text-primary'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{t(item.key)}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

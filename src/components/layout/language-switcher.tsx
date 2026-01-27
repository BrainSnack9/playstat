'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config'
import { Globe, Home } from 'lucide-react'

// locale prefix를 제거하는 헬퍼 함수
function stripLocalePrefix(path: string): string {
  for (const loc of locales) {
    if (path === `/${loc}` || path.startsWith(`/${loc}/`)) {
      return path.slice(`/${loc}`.length) || '/'
    }
  }
  return path
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const rawPathname = usePathname()
  const t = useTranslations('footer')

  // 이미 locale이 포함되어 있을 수 있으므로 제거
  const pathname = stripLocalePrefix(rawPathname)

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale })
  }

  const handleGoToMain = () => {
    window.location.href = 'https://playstat.space'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            <span className="mr-2">{localeFlags[loc]}</span>
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoToMain}>
          <Home className="mr-2 h-4 w-4" />
          {t('main_hub')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // 쿠키 기반 언어 유지 (사용자가 선택한 언어 기억)
  localeDetection: true,
})

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)

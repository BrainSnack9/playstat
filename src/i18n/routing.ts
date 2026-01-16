import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // 브라우저 Accept-Language 헤더 기반 자동 언어 감지 (기본값: true)
  localeDetection: true,
})

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)

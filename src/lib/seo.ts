import { Metadata } from 'next'
import { locales, type Locale } from '@/i18n/config'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.space'
const SITE_NAME = 'PlayStat'

const localeToLangTag: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  es: 'es-ES',
  ja: 'ja-JP',
  de: 'de-DE',
}

const localeToOgLocale: Record<Locale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  es: 'es_ES',
  ja: 'ja_JP',
  de: 'de_DE',
}

export interface SEOConfig {
  title: string
  description: string
  keywords?: string[]
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  locale?: string
  noIndex?: boolean
}

export interface SEOPageOptions {
  path?: string
  locale?: Locale
  baseUrl?: string
}

function normalizePath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function buildAlternates(path: string, locale: Locale) {
  const normalized = normalizePath(path)
  const localizedPath = normalized === '/' ? '' : normalized
  const canonical = `/${locale}${localizedPath}`
  const languages = Object.fromEntries(
    locales.map((loc) => [localeToLangTag[loc], `/${loc}${localizedPath}`])
  )

  return { canonical, languages }
}

/**
 * SEO 메타데이터 생성 헬퍼
 */
export function generateMetadata(config: SEOConfig, options: SEOPageOptions = {}): Metadata {
  const {
    title,
    description,
    keywords = [],
    image,
    type = 'website',
    publishedTime,
    modifiedTime,
    locale,
    noIndex = false,
  } = config
  const pageLocale = options.locale || 'ko'
  const ogLocale = locale || localeToOgLocale[pageLocale]
  const baseUrl = options.baseUrl || SITE_URL

  const fullTitle = `${title} | ${SITE_NAME}`
  const ogImage = image || `${baseUrl}/og-default.png`
  const alternates = options.path ? buildAlternates(options.path, pageLocale) : undefined
  const canonicalUrl = alternates?.canonical
    ? new URL(alternates.canonical, baseUrl).toString()
    : baseUrl

  return {
    title: fullTitle,
    description,
    keywords: [...keywords, 'PlayStat'],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(baseUrl),
    alternates,
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: ogLocale,
      type,
      ...(type === 'article' && {
        publishedTime,
        modifiedTime,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
      creator: '@playstat',
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }
}

/**
 * 경기 페이지 SEO 데이터 생성
 */
export function generateMatchSEO(match: {
  homeTeam: string
  awayTeam: string
  league: string
  date: string
  hasAnalysis: boolean
  translations: {
    description: string
    keywords: string[]
  }
}): SEOConfig {
  const title = `${match.homeTeam} vs ${match.awayTeam} - ${match.league}`
  
  return {
    title,
    description: match.translations.description,
    keywords: match.translations.keywords,
    type: 'article',
  }
}

/**
 * 팀 페이지 SEO 데이터 생성
 */
export function generateTeamSEO(team: {
  name: string
  league: string
  translations: {
    description: string
    keywords: string[]
  }
}): SEOConfig {
  const title = `${team.name} - ${team.league}`
  
  return {
    title,
    description: team.translations.description,
    keywords: team.translations.keywords,
    type: 'website',
  }
}

/**
 * 리그 페이지 SEO 데이터 생성
 */
export function generateLeagueSEO(league: {
  name: string
  country: string
  season: string
  translations: {
    title: string
    description: string
    keywords: string[]
  }
}): SEOConfig {
  return {
    title: league.translations.title,
    description: league.translations.description,
    keywords: league.translations.keywords,
    type: 'website',
  }
}

/**
 * JSON-LD 스키마 생성 (경기)
 */
export function generateMatchJsonLd(match: {
  id: string
  homeTeam: { name: string; logoUrl?: string }
  awayTeam: { name: string; logoUrl?: string }
  league: string
  kickoffAt: string
  venue?: string
  status: string
  homeScore?: number
  awayScore?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    startDate: match.kickoffAt,
    location: match.venue
      ? {
          '@type': 'Place',
          name: match.venue,
        }
      : undefined,
    homeTeam: {
      '@type': 'SportsTeam',
      name: match.homeTeam.name,
      logo: match.homeTeam.logoUrl,
    },
    awayTeam: {
      '@type': 'SportsTeam',
      name: match.awayTeam.name,
      logo: match.awayTeam.logoUrl,
    },
    eventStatus:
      match.status === 'FINISHED'
        ? 'https://schema.org/EventCompleted'
        : match.status === 'CANCELLED'
        ? 'https://schema.org/EventCancelled'
        : match.status === 'POSTPONED'
        ? 'https://schema.org/EventPostponed'
        : 'https://schema.org/EventScheduled',
  }
}

/**
 * JSON-LD 스키마 생성 (팀)
 */
export function generateTeamJsonLd(team: {
  name: string
  logoUrl?: string
  venue?: string
  city?: string
  founded?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    logo: team.logoUrl,
    location: team.city
      ? {
          '@type': 'Place',
          name: team.city,
        }
      : undefined,
    foundingDate: team.founded ? String(team.founded) : undefined,
  }
}

/**
 * JSON-LD 스키마 생성 (WebSite/Organization)
 */
export function generateWebsiteJsonLd(locale?: Locale, baseUrl: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: baseUrl,
    inLanguage: locale ? localeToLangTag[locale] : 'ko-KR',
  }
}

export function generateOrganizationJsonLd(baseUrl: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: baseUrl,
    logo: `${baseUrl}/app-icon-512.png`,
  }
}

export function resolveBaseUrl(host?: string | null) {
  if (!host) return SITE_URL
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

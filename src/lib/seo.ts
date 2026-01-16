import { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.com'
const SITE_NAME = 'PlayStat'

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

/**
 * SEO 메타데이터 생성 헬퍼
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image,
    type = 'website',
    publishedTime,
    modifiedTime,
    locale = 'ko_KR',
    noIndex = false,
  } = config

  const fullTitle = `${title} | ${SITE_NAME}`
  const ogImage = image || `${SITE_URL}/og-default.png`

  return {
    title: fullTitle,
    description,
    keywords: [...keywords, 'PlayStat', '스포츠분석', 'AI분석', '축구', 'NBA', 'MLB'],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: '/',
      languages: {
        'ko-KR': '/ko',
        'en-US': '/en',
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: SITE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale,
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
}): SEOConfig {
  const title = `${match.homeTeam} vs ${match.awayTeam} - ${match.league}`
  const description = match.hasAnalysis
    ? `${match.homeTeam}와 ${match.awayTeam}의 경기 AI 분석. 최근 폼, 전술 분석, 핵심 관전 포인트를 확인하세요.`
    : `${match.date} ${match.league} 경기: ${match.homeTeam} vs ${match.awayTeam}`

  return {
    title,
    description,
    keywords: [
      match.homeTeam,
      match.awayTeam,
      match.league,
      '경기분석',
      '프리뷰',
      '전술분석',
    ],
    type: 'article',
  }
}

/**
 * 팀 페이지 SEO 데이터 생성
 */
export function generateTeamSEO(team: {
  name: string
  league: string
  recentForm?: string
}): SEOConfig {
  const title = `${team.name} - ${team.league}`
  const description = `${team.name} 팀 분석. 최근 폼${team.recentForm ? ` (${team.recentForm})` : ''}, 스쿼드, 경기 일정, 전술 스타일을 확인하세요.`

  return {
    title,
    description,
    keywords: [team.name, team.league, '팀분석', '스쿼드', '전술'],
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
}): SEOConfig {
  const title = `${league.name} ${league.season} 시즌`
  const description = `${league.name} ${league.season} 시즌 순위, 경기 일정, 팀 분석을 확인하세요.`

  return {
    title,
    description,
    keywords: [league.name, league.country, league.season, '순위', '일정'],
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
    description: `${match.league} 경기`,
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

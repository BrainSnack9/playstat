import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { getSportFromHost, isApexHost, SPORT_COOKIE } from './lib/sport'

const intlMiddleware = createMiddleware(routing)
const locales = ['ko', 'en', 'es', 'ja', 'de']
const sports = ['football', 'basketball', 'baseball']

function hasLocalePrefix(pathname: string): string | null {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

function hasSportPrefix(pathname: string): boolean {
  for (const sport of sports) {
    if (pathname === `/${sport}` || pathname.startsWith(`/${sport}/`)) {
      return true
    }
  }
  // locale 뒤에 sport가 있는지도 체크
  for (const locale of locales) {
    for (const sport of sports) {
      if (pathname.startsWith(`/${locale}/${sport}`)) {
        return true
      }
    }
  }
  return false
}

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const sport = getSportFromHost(host)
  const isApex = isApexHost(host)
  const pathname = request.nextUrl.pathname

  // 서브도메인이고 스포츠 경로가 아직 없는 경우 rewrite
  if (!isApex && !hasSportPrefix(pathname)) {
    const url = request.nextUrl.clone()
    const locale = hasLocalePrefix(pathname)

    if (locale) {
      // /ko/matches -> /ko/football/matches
      const rest = pathname.slice(locale.length + 1) // +1 for the leading /
      url.pathname = `/${locale}/${sport}${rest ? `/${rest}` : ''}`
    } else {
      // /matches -> /football/matches
      url.pathname = `/${sport}${pathname}`
    }

    // intl middleware를 통해 rewrite된 URL 처리
    const rewrittenRequest = new NextRequest(url, {
      headers: request.headers,
    })
    const response = intlMiddleware(rewrittenRequest)

    response.cookies.set(SPORT_COOKIE, sport, {
      path: '/',
      sameSite: 'lax',
    })

    return response
  }

  // apex 도메인이거나 이미 스포츠 경로가 있는 경우 기존 처리
  const response = intlMiddleware(request)

  response.cookies.set(SPORT_COOKIE, sport, {
    path: '/',
    sameSite: 'lax',
  })

  return response
}

export const config = {
  matcher: [
    // Match all pathnames except:
    // - API routes
    // - Static files (_next, images, etc.)
    // - Favicon and other public files
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}

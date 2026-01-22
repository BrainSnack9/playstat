import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { DEFAULT_SPORT, SPORT_COOKIE, type SportId } from './lib/sport'

const intlMiddleware = createMiddleware(routing)

// 서브도메인 → 스포츠 ID 매핑
const SPORT_SUBDOMAINS: Record<string, SportId> = {
  football: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
}

// 메인 도메인 목록 (리다이렉트 하지 않음)
const MAIN_HOSTS = new Set([
  'playstat.space',
  'www.playstat.space',
  'localhost',
  'localhost:3030',
])

function getSubdomainSport(host: string): SportId | null {
  const hostname = host.split(':')[0].toLowerCase()

  // localhost 처리: football.localhost:3030
  if (hostname.endsWith('.localhost') || hostname.includes('.localhost')) {
    const subdomain = hostname.split('.')[0]
    return SPORT_SUBDOMAINS[subdomain] || null
  }

  // 프로덕션: football.playstat.space
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    const subdomain = parts[0]
    return SPORT_SUBDOMAINS[subdomain] || null
  }

  return null
}

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // 서브도메인 체크 → 301 리다이렉트
  const subdomainSport = getSubdomainSport(host)
  if (subdomainSport) {
    // 이미 스포츠 경로로 시작하면 리다이렉트 하지 않음 (무한루프 방지)
    const sportPaths = ['/football', '/basketball', '/baseball']
    const startsWithSportPath = sportPaths.some(p => pathname.startsWith(p))

    if (!startsWithSportPath) {
      // 서브도메인에서 메인 도메인 + 스포츠 경로로 301 리다이렉트
      const isLocal = host.includes('localhost')
      const mainHost = isLocal ? 'localhost:3030' : 'playstat.space'
      const protocol = isLocal ? 'http' : 'https'

      // pathname이 /이면 /football, 아니면 /football/matches 등
      const newPath = pathname === '/' ? `/${subdomainSport}` : `/${subdomainSport}${pathname}`
      const redirectUrl = `${protocol}://${mainHost}${newPath}`

      return NextResponse.redirect(redirectUrl, { status: 301 })
    }
  }

  // intlMiddleware 호출
  const response = intlMiddleware(request)

  // 스포츠 쿠키 설정 - 기본값 football
  response.cookies.set(SPORT_COOKIE, DEFAULT_SPORT, {
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

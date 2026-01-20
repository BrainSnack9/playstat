import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { getSportFromHost, SPORT_COOKIE } from './lib/sport'

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const sport = getSportFromHost(host)

  // intlMiddleware 호출
  const response = intlMiddleware(request)

  // 스포츠 쿠키 설정
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

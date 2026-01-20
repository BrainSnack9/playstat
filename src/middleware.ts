import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { getSportFromHost, SPORT_COOKIE } from './lib/sport'

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request)
  const sport = getSportFromHost(request.headers.get('host'))

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

import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { getSportFromHost, isApexHost, SPORT_COOKIE } from './lib/sport'

const intlMiddleware = createMiddleware(routing)
const locales = ['ko', 'en', 'es', 'ja', 'de']

// 스포츠 서브페이지 패턴 (루트 제외)
const sportSubpages = ['/matches', '/teams', '/leagues', '/daily', '/news']

function needsSportPrefix(pathname: string): boolean {
  // 루트 경로는 제외 (메인 페이지 표시)
  if (pathname === '/' || pathname === '') return false

  // locale prefix 제거 후 확인
  let path = pathname
  for (const locale of locales) {
    if (pathname === `/${locale}`) return false
    if (pathname.startsWith(`/${locale}/`)) {
      path = pathname.slice(locale.length + 1)
      break
    }
  }

  // 스포츠 서브페이지인지 확인
  return sportSubpages.some(subpage => path.startsWith(subpage))
}

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const sport = getSportFromHost(host)
  const isApex = isApexHost(host)
  const pathname = request.nextUrl.pathname

  // 서브도메인이고 스포츠 서브페이지인 경우 경로 수정
  if (!isApex && needsSportPrefix(pathname)) {
    const url = request.nextUrl.clone()

    // locale prefix 확인
    let locale = ''
    let restPath = pathname
    for (const loc of locales) {
      if (pathname.startsWith(`/${loc}/`)) {
        locale = loc
        restPath = pathname.slice(loc.length + 1)
        break
      }
    }

    // 새 경로 생성: /{locale}/{sport}/{restPath}
    if (locale) {
      url.pathname = `/${locale}/${sport}${restPath}`
    } else {
      url.pathname = `/${sport}${pathname}`
    }

    // rewrite로 내부 경로 변경 (URL은 유지)
    const response = NextResponse.rewrite(url)
    response.cookies.set(SPORT_COOKIE, sport, {
      path: '/',
      sameSite: 'lax',
    })
    return response
  }

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

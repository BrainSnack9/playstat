import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { routing } from './i18n/routing'
import { type SportId } from './lib/sport'

const intlMiddleware = createMiddleware(routing)

// Supabase 클라이언트 (미들웨어용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

// 관리자 인증 확인
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false
  }

  try {
    // 쿠키에서 세션 토큰 가져오기
    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value

    if (!accessToken) {
      return false
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })

    // 세션 설정
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user?.email) {
      return false
    }

    // 관리자 이메일 확인
    const adminEmail = process.env.ADMIN_EMAIL
    return user.email.toLowerCase() === adminEmail?.toLowerCase()
  } catch {
    return false
  }
}

export default async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // /admin 경로 처리 (i18n 미적용)
  if (pathname.startsWith('/admin')) {
    // 로그인 페이지는 그대로 통과
    if (pathname.startsWith('/admin/login')) {
      return NextResponse.next()
    }

    // 인증 확인
    const isAuthenticated = await checkAdminAuth(request)

    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // 인증됐으면 그대로 통과 (i18n 미들웨어 건너뜀)
    return NextResponse.next()
  }

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
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    // Match all pathnames except:
    // - API routes
    // - Static files (_next, images, etc.)
    // - Favicon and other public files
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Admin routes
    '/admin/:path*',
  ],
}

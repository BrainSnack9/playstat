export type SportId = 'football' | 'basketball' | 'baseball'

export const DEFAULT_SPORT: SportId = 'football'
export const SPORT_COOKIE = 'ps_sport'

export const ALL_SPORTS: SportId[] = ['football', 'basketball', 'baseball']

const APEX_HOSTS = new Set([
  'playstat.space',
  'www.playstat.space',
  'localhost',
  'playstat.localhost',
  'www.playstat.localhost',
])

const SPORT_BY_SUBDOMAIN: Record<string, SportId> = {
  football: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
}

function getSubdomainFromHost(hostname: string): string | null {
  const lower = hostname.toLowerCase()
  const parts = lower.split('.')
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    return parts.length >= 2 ? parts[0] : null
  }

  return parts.length >= 3 ? parts[0] : null
}

export function getSportFromHost(host?: string | null): SportId {
  if (!host) return DEFAULT_SPORT

  const hostname = host.split(':')[0]
  const subdomain = getSubdomainFromHost(hostname)
  if (!subdomain) return DEFAULT_SPORT

  return SPORT_BY_SUBDOMAIN[subdomain] ?? DEFAULT_SPORT
}

export function getSportFromCookie(value?: string | null): SportId {
  if (value === 'basketball') return 'basketball'
  if (value === 'baseball') return 'baseball'
  if (value === 'football') return 'football'
  return DEFAULT_SPORT
}

export function isValidSportId(value: string): value is SportId {
  return ALL_SPORTS.includes(value as SportId)
}

export function sportIdToEnum(sport: SportId): 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL' {
  return sport.toUpperCase() as 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'
}

export function isApexHost(host?: string | null): boolean {
  if (!host) return false
  const hostname = host.split(':')[0].toLowerCase()
  return APEX_HOSTS.has(hostname)
}

/**
 * API 라우트에서 스포츠를 자동 감지
 * 우선순위: 1. 쿼리 파라미터 2. 쿠키 3. 서브도메인 4. 기본값
 */
export function getSportFromRequest(request: Request): SportId {
  const url = new URL(request.url)

  // 1. 쿼리 파라미터 (sport 또는 sportType)
  const sportParam = url.searchParams.get('sport') || url.searchParams.get('sportType')
  if (sportParam && isValidSportId(sportParam.toLowerCase())) {
    return sportParam.toLowerCase() as SportId
  }

  // 2. 쿠키
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieMatch = cookieHeader.match(new RegExp(`${SPORT_COOKIE}=([^;]+)`))
  if (cookieMatch) {
    const cookieValue = cookieMatch[1]
    if (isValidSportId(cookieValue)) {
      return cookieValue as SportId
    }
  }

  // 3. 서브도메인 (Host 헤더)
  const host = request.headers.get('host')
  return getSportFromHost(host)
}

/**
 * API 라우트에서 SportType enum 값을 바로 반환
 */
export function getSportTypeFromRequest(request: Request): 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL' {
  return sportIdToEnum(getSportFromRequest(request))
}

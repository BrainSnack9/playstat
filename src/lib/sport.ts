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

// ===========================================
// 시즌 정보
// ===========================================

export interface SeasonInfo {
  sport: SportId
  name: string
  seasonYear: number | string // 예: 2025 또는 "2024-25"
  startMonth: number // 1-12
  endMonth: number // 1-12
  isOffseason: boolean
  currentPhase: 'preseason' | 'regular' | 'postseason' | 'offseason'
  nextSeasonStart?: Date
  seasonEnd?: Date
}

/**
 * 각 스포츠의 시즌 일정 정보
 * - Football (유럽축구): 8월~5월 (다음해)
 * - Basketball (NBA): 10월~6월 (다음해)
 * - Baseball (MLB): 4월~10월 (같은해)
 */
export function getSeasonInfo(sport: SportId, referenceDate?: Date): SeasonInfo {
  const now = referenceDate || new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  switch (sport) {
    case 'football': {
      // 유럽 축구: 8월~5월 (다음해)
      // 시즌 표기: 2024-25 형식
      const isInSeason = month >= 8 || month <= 5
      const seasonYear = month >= 8 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`

      let currentPhase: SeasonInfo['currentPhase']
      if (month >= 6 && month <= 7) {
        currentPhase = 'offseason'
      } else if (month === 8) {
        currentPhase = 'preseason'
      } else if (month >= 9 || month <= 4) {
        currentPhase = 'regular'
      } else {
        currentPhase = 'postseason' // 5월
      }

      const nextSeasonStart = !isInSeason ? new Date(year, 7, 1) : undefined // 8월 1일
      const seasonEnd = isInSeason && month <= 5 ? new Date(year, 4, 31) : undefined // 5월 31일

      return {
        sport,
        name: 'Football',
        seasonYear,
        startMonth: 8,
        endMonth: 5,
        isOffseason: !isInSeason,
        currentPhase,
        nextSeasonStart,
        seasonEnd,
      }
    }

    case 'basketball': {
      // NBA: 10월~6월 (다음해)
      // 시즌 표기: 2024-25 형식
      const isInSeason = month >= 10 || month <= 6
      const seasonYear = month >= 10 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`

      let currentPhase: SeasonInfo['currentPhase']
      if (month >= 7 && month <= 9) {
        currentPhase = 'offseason'
      } else if (month === 10) {
        currentPhase = 'preseason'
      } else if (month >= 11 || month <= 3) {
        currentPhase = 'regular'
      } else {
        currentPhase = 'postseason' // 4월~6월 플레이오프
      }

      const nextSeasonStart = !isInSeason ? new Date(year, 9, 1) : undefined // 10월 1일
      const seasonEnd = isInSeason && month <= 6 ? new Date(year, 5, 30) : undefined // 6월 30일

      return {
        sport,
        name: 'NBA',
        seasonYear,
        startMonth: 10,
        endMonth: 6,
        isOffseason: !isInSeason,
        currentPhase,
        nextSeasonStart,
        seasonEnd,
      }
    }

    case 'baseball': {
      // MLB: 4월~10월 (같은해)
      // 시즌 표기: 2025 형식
      const isInSeason = month >= 4 && month <= 10
      const seasonYear = isInSeason ? year : (month <= 3 ? year : year + 1)

      let currentPhase: SeasonInfo['currentPhase']
      if (month >= 11 || month <= 2) {
        currentPhase = 'offseason'
      } else if (month === 3) {
        currentPhase = 'preseason' // 스프링 트레이닝
      } else if (month >= 4 && month <= 9) {
        currentPhase = 'regular'
      } else {
        currentPhase = 'postseason' // 10월 포스트시즌
      }

      const nextSeasonStart = !isInSeason ? new Date(month <= 3 ? year : year + 1, 3, 1) : undefined // 4월 1일
      const seasonEnd = isInSeason ? new Date(year, 9, 31) : undefined // 10월 31일

      return {
        sport,
        name: 'MLB',
        seasonYear,
        startMonth: 4,
        endMonth: 10,
        isOffseason: !isInSeason,
        currentPhase,
        nextSeasonStart,
        seasonEnd,
      }
    }
  }
}

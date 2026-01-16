/**
 * 통합 스포츠 API 클라이언트
 * API-Sports Free Plan 제한을 고려한 설계:
 * - 분당 10회 제한
 * - 월 약 2,000회 제한
 * - 유저 접속 시 API 호출 금지 (DB 읽기만)
 * - 크론에서만 API 호출
 */

import { executeWithRateLimit } from './rate-limiter'

// API 기본 URL
const API_URLS = {
  football: 'https://v3.football.api-sports.io',
  basketball: 'https://v1.basketball.api-sports.io',
  baseball: 'https://v1.baseball.api-sports.io',
} as const

type ApiType = keyof typeof API_URLS

// API 응답 기본 구조
interface ApiResponse<T> {
  get: string
  parameters: Record<string, string>
  errors: Record<string, string> | string[]
  results: number
  paging: {
    current: number
    total: number
  }
  response: T[]
}

/**
 * API 요청 헬퍼 함수 (Rate Limit 적용)
 */
async function apiRequest<T>(
  apiType: ApiType,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY not configured')
  }

  return executeWithRateLimit(apiType, endpoint, async () => {
    const queryString = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString()

    const url = `${API_URLS[apiType]}${endpoint}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': `v3.${apiType}.api-sports.io`,
      },
      cache: 'no-store', // 크론에서 호출하므로 캐시 없음
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data: ApiResponse<T> = await response.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(`API error: ${JSON.stringify(data.errors)}`)
    }

    return data.response
  })
}

// ===========================================
// 축구 (Football) API
// ===========================================

export interface FootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    venue: {
      id: number
      name: string
      city: string
    }
    status: {
      long: string
      short: string
      elapsed: number | null
    }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    season: number
    round: string
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
}

export interface FootballTeamStats {
  league: { id: number; name: string; season: number }
  team: { id: number; name: string; logo: string }
  form: string
  fixtures: {
    played: { home: number; away: number; total: number }
    wins: { home: number; away: number; total: number }
    draws: { home: number; away: number; total: number }
    loses: { home: number; away: number; total: number }
  }
  goals: {
    for: { total: { home: number; away: number; total: number }; average: { home: string; away: string; total: string } }
    against: { total: { home: number; away: number; total: number }; average: { home: string; away: string; total: string } }
  }
}

export const footballApi = {
  // 날짜별 경기 목록
  getFixturesByDate: (date: string) =>
    apiRequest<FootballFixture>('football', '/fixtures', { date }),

  // 리그별 경기 목록
  getFixturesByLeague: (leagueId: number, season: number, options?: { from?: string; to?: string }) =>
    apiRequest<FootballFixture>('football', '/fixtures', { league: leagueId, season, ...options }),

  // 팀 최근 경기
  getTeamLastFixtures: (teamId: number, count: number = 10) =>
    apiRequest<FootballFixture>('football', '/fixtures', { team: teamId, last: count }),

  // 팀 시즌 통계
  getTeamStatistics: (teamId: number, leagueId: number, season: number) =>
    apiRequest<FootballTeamStats>('football', '/teams/statistics', { team: teamId, league: leagueId, season }),

  // 상대 전적
  getHeadToHead: (team1Id: number, team2Id: number, count: number = 5) =>
    apiRequest<FootballFixture>('football', '/fixtures/headtohead', { h2h: `${team1Id}-${team2Id}`, last: count }),
}

// ===========================================
// 농구 (Basketball) API
// ===========================================

export interface BasketballGame {
  id: number
  date: string
  time: string
  timestamp: number
  timezone: string
  stage: string | null
  week: string | null
  status: { long: string; short: string; timer: string | null }
  league: { id: number; name: string; type: string; season: string; logo: string }
  country: { id: number; name: string; code: string; flag: string }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  scores: {
    home: { quarter_1: number | null; quarter_2: number | null; quarter_3: number | null; quarter_4: number | null; over_time: number | null; total: number | null }
    away: { quarter_1: number | null; quarter_2: number | null; quarter_3: number | null; quarter_4: number | null; over_time: number | null; total: number | null }
  }
}

export interface BasketballTeamStats {
  team: { id: number; name: string; logo: string }
  games: { played: { home: number; away: number; all: number } }
  wins: { home: { total: number; percentage: string }; away: { total: number; percentage: string }; all: { total: number; percentage: string } }
  loses: { home: { total: number; percentage: string }; away: { total: number; percentage: string }; all: { total: number; percentage: string } }
  points: { for: { total: { home: number; away: number; all: number }; average: { home: string; away: string; all: string } }; against: { total: { home: number; away: number; all: number }; average: { home: string; away: string; all: string } } }
}

export const basketballApi = {
  // 날짜별 경기 목록
  getGamesByDate: (date: string) =>
    apiRequest<BasketballGame>('basketball', '/games', { date }),

  // 리그별 경기 목록
  getGamesByLeague: (leagueId: number, season: string) =>
    apiRequest<BasketballGame>('basketball', '/games', { league: leagueId, season }),

  // 팀 최근 경기
  getTeamLastGames: (teamId: number, count: number = 10) =>
    apiRequest<BasketballGame>('basketball', '/games', { team: teamId, last: count }),

  // 팀 시즌 통계
  getTeamStatistics: (teamId: number, leagueId: number, season: string) =>
    apiRequest<BasketballTeamStats>('basketball', '/statistics', { team: teamId, league: leagueId, season }),

  // 상대 전적
  getHeadToHead: (team1Id: number, team2Id: number, count: number = 5) =>
    apiRequest<BasketballGame>('basketball', '/games/h2h', { h2h: `${team1Id}-${team2Id}`, last: count }),
}

// ===========================================
// 야구 (Baseball) API
// ===========================================

export interface BaseballGame {
  id: number
  date: string
  time: string
  timestamp: number
  timezone: string
  week: string | null
  status: { long: string; short: string }
  league: { id: number; name: string; type: string; season: number; logo: string }
  country: { id: number; name: string; code: string; flag: string }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  scores: {
    home: { hits: number | null; errors: number | null; innings: Record<string, number | null>; total: number | null }
    away: { hits: number | null; errors: number | null; innings: Record<string, number | null>; total: number | null }
  }
}

export interface BaseballTeamStats {
  team: { id: number; name: string; logo: string }
  games: { played: { home: number; away: number; all: number } }
  wins: { home: { total: number; percentage: string }; away: { total: number; percentage: string }; all: { total: number; percentage: string } }
  loses: { home: { total: number; percentage: string }; away: { total: number; percentage: string }; all: { total: number; percentage: string } }
  runs: { for: { total: { home: number; away: number; all: number }; average: { home: string; away: string; all: string } }; against: { total: { home: number; away: number; all: number }; average: { home: string; away: string; all: string } } }
}

export const baseballApi = {
  // 날짜별 경기 목록
  getGamesByDate: (date: string) =>
    apiRequest<BaseballGame>('baseball', '/games', { date }),

  // 리그별 경기 목록
  getGamesByLeague: (leagueId: number, season: number) =>
    apiRequest<BaseballGame>('baseball', '/games', { league: leagueId, season }),

  // 팀 최근 경기
  getTeamLastGames: (teamId: number, count: number = 10) =>
    apiRequest<BaseballGame>('baseball', '/games', { team: teamId, last: count }),

  // 팀 시즌 통계
  getTeamStatistics: (teamId: number, leagueId: number, season: number) =>
    apiRequest<BaseballTeamStats>('baseball', '/teams/statistics', { team: teamId, league: leagueId, season }),

  // 상대 전적
  getHeadToHead: (team1Id: number, team2Id: number, count: number = 5) =>
    apiRequest<BaseballGame>('baseball', '/games/h2h', { h2h: `${team1Id}-${team2Id}`, last: count }),
}

// ===========================================
// 주요 리그 ID 상수
// ===========================================

export const LEAGUE_IDS = {
  // 축구
  EPL: 39,
  LALIGA: 140,
  SERIE_A: 135,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  UCL: 2,
  UEL: 3,
  K_LEAGUE_1: 292,

  // 농구 (NBA)
  NBA: 12,

  // 야구 (MLB)
  MLB: 1,
} as const

/**
 * 현재 시즌 가져오기 (축구)
 */
export function getCurrentFootballSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month < 8 ? year - 1 : year
}

/**
 * 현재 시즌 가져오기 (NBA/MLB)
 */
export function getCurrentSeason(sport: 'basketball' | 'baseball'): string | number {
  const now = new Date()
  const year = now.getFullYear()

  if (sport === 'basketball') {
    // NBA 시즌은 10월~6월 (예: "2024-2025")
    const month = now.getMonth() + 1
    return month >= 10 ? `${year}-${year + 1}` : `${year - 1}-${year}`
  } else {
    // MLB 시즌은 3월~10월 (예: 2024)
    return year
  }
}

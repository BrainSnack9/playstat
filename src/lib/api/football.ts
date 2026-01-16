// API-Football client for fetching football data
// Documentation: https://www.api-football.com/documentation-v3

const API_BASE_URL = 'https://v3.football.api-sports.io'

interface ApiFootballResponse<T> {
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

async function apiRequest<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY not configured')
  }

  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()

  const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    next: { revalidate: 300 }, // 5분 캐시
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const data: ApiFootballResponse<T> = await response.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(data.errors)}`)
  }

  return data.response
}

// Types
export interface ApiLeague {
  league: {
    id: number
    name: string
    type: string
    logo: string
  }
  country: {
    name: string
    code: string
    flag: string
  }
  seasons: Array<{
    year: number
    start: string
    end: string
    current: boolean
  }>
}

export interface ApiTeam {
  team: {
    id: number
    name: string
    code: string
    country: string
    founded: number
    national: boolean
    logo: string
  }
  venue: {
    id: number
    name: string
    address: string
    city: string
    capacity: number
    surface: string
    image: string
  }
}

export interface ApiPlayer {
  player: {
    id: number
    name: string
    firstname: string
    lastname: string
    age: number
    birth: {
      date: string
      place: string
      country: string
    }
    nationality: string
    height: string
    weight: string
    injured: boolean
    photo: string
  }
  statistics: Array<{
    team: {
      id: number
      name: string
      logo: string
    }
    league: {
      id: number
      name: string
      country: string
      logo: string
      flag: string
      season: number
    }
    games: {
      appearences: number
      lineups: number
      minutes: number
      number: number | null
      position: string
      rating: string | null
      captain: boolean
    }
    goals: {
      total: number
      conceded: number
      assists: number
      saves: number
    }
  }>
}

export interface ApiFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: {
      first: number | null
      second: number | null
    }
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
    flag: string
    season: number
    round: string
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
    away: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface ApiFixtureStats {
  team: {
    id: number
    name: string
    logo: string
  }
  statistics: Array<{
    type: string
    value: number | string | null
  }>
}

export interface ApiTeamStatistics {
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string
    season: number
  }
  team: {
    id: number
    name: string
    logo: string
  }
  form: string
  fixtures: {
    played: { home: number; away: number; total: number }
    wins: { home: number; away: number; total: number }
    draws: { home: number; away: number; total: number }
    loses: { home: number; away: number; total: number }
  }
  goals: {
    for: {
      total: { home: number; away: number; total: number }
      average: { home: string; away: string; total: string }
    }
    against: {
      total: { home: number; away: number; total: number }
      average: { home: string; away: string; total: string }
    }
  }
  clean_sheet: { home: number; away: number; total: number }
  failed_to_score: { home: number; away: number; total: number }
}

// API Functions

// 리그 목록 조회
export async function getLeagues(country?: string): Promise<ApiLeague[]> {
  return apiRequest<ApiLeague>('/leagues', country ? { country } : {})
}

// 특정 리그 조회
export async function getLeague(leagueId: number): Promise<ApiLeague | null> {
  const leagues = await apiRequest<ApiLeague>('/leagues', { id: leagueId })
  return leagues[0] || null
}

// 리그 팀 목록 조회
export async function getTeamsByLeague(
  leagueId: number,
  season: number
): Promise<ApiTeam[]> {
  return apiRequest<ApiTeam>('/teams', { league: leagueId, season })
}

// 특정 팀 조회
export async function getTeam(teamId: number): Promise<ApiTeam | null> {
  const teams = await apiRequest<ApiTeam>('/teams', { id: teamId })
  return teams[0] || null
}

// 팀 선수 목록 조회
export async function getPlayersByTeam(
  teamId: number,
  season: number
): Promise<ApiPlayer[]> {
  return apiRequest<ApiPlayer>('/players', { team: teamId, season })
}

// 날짜별 경기 목록 조회
export async function getFixturesByDate(date: string): Promise<ApiFixture[]> {
  return apiRequest<ApiFixture>('/fixtures', { date })
}

// 리그별 경기 목록 조회
export async function getFixturesByLeague(
  leagueId: number,
  season: number,
  options?: { from?: string; to?: string; round?: string }
): Promise<ApiFixture[]> {
  return apiRequest<ApiFixture>('/fixtures', {
    league: leagueId,
    season,
    ...options,
  })
}

// 특정 경기 조회
export async function getFixture(fixtureId: number): Promise<ApiFixture | null> {
  const fixtures = await apiRequest<ApiFixture>('/fixtures', { id: fixtureId })
  return fixtures[0] || null
}

// 경기 스탯 조회
export async function getFixtureStats(
  fixtureId: number
): Promise<ApiFixtureStats[]> {
  return apiRequest<ApiFixtureStats>('/fixtures/statistics', {
    fixture: fixtureId,
  })
}

// 팀 통계 조회
export async function getTeamStatistics(
  teamId: number,
  leagueId: number,
  season: number
): Promise<ApiTeamStatistics | null> {
  const stats = await apiRequest<ApiTeamStatistics>('/teams/statistics', {
    team: teamId,
    league: leagueId,
    season,
  })
  return stats[0] || null
}

// 팀 최근 경기 조회
export async function getTeamLastFixtures(
  teamId: number,
  count: number = 5
): Promise<ApiFixture[]> {
  return apiRequest<ApiFixture>('/fixtures', {
    team: teamId,
    last: count,
  })
}

// 상대 전적 조회 (Head to Head)
export async function getHeadToHead(
  team1Id: number,
  team2Id: number,
  count: number = 10
): Promise<ApiFixture[]> {
  return apiRequest<ApiFixture>('/fixtures/headtohead', {
    h2h: `${team1Id}-${team2Id}`,
    last: count,
  })
}

// 부상자 목록 조회
export async function getInjuries(
  leagueId: number,
  season: number
): Promise<
  Array<{
    player: { id: number; name: string; photo: string; type: string; reason: string }
    team: { id: number; name: string; logo: string }
    fixture: { id: number; date: string }
    league: { id: number; name: string; country: string }
  }>
> {
  return apiRequest('/injuries', { league: leagueId, season })
}

// 주요 리그 IDs
export const LEAGUE_IDS = {
  // Football
  EPL: 39, // English Premier League
  LALIGA: 140, // La Liga
  SERIE_A: 135, // Serie A
  BUNDESLIGA: 78, // Bundesliga
  LIGUE_1: 61, // Ligue 1
  UCL: 2, // UEFA Champions League
  UEL: 3, // UEFA Europa League
  K_LEAGUE_1: 292, // K League 1
} as const

// 현재 시즌 가져오기
export function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  // 8월 이전이면 전년도 시즌
  return month < 8 ? year - 1 : year
}

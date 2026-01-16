/**
 * Football-Data.org API v4 클라이언트
 * 무료 플랜: 10 requests/minute, 현재 시즌 데이터 접근 가능
 *
 * 무료 지원 리그:
 * - Champions League (CL)
 * - Premier League (PL)
 * - Bundesliga (BL1)
 * - La Liga (PD)
 * - Serie A (SA)
 * - Ligue 1 (FL1)
 * - Eredivisie (DED)
 * - Primeira Liga (PPL)
 * - Championship (ELC)
 * - FIFA World Cup (WC)
 * - European Championship (EC)
 */

const API_BASE_URL = 'https://api.football-data.org/v4'

// Rate limiting: 10 requests per minute
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 6000 // 6초 간격 (안전하게)

async function waitForRateLimit() {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

async function apiRequest<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY not configured')
  }

  await waitForRateLimit()

  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()

  const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Football-Data API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

// ===========================================
// 타입 정의
// ===========================================

export interface Competition {
  id: number
  name: string
  code: string
  type: 'LEAGUE' | 'CUP'
  emblem: string
  area: {
    id: number
    name: string
    code: string
    flag: string
  }
  currentSeason: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number
    winner: Team | null
  }
}

export interface Team {
  id: number
  name: string
  shortName: string
  tla: string // 3글자 약어
  crest: string
  address?: string
  website?: string
  founded?: number
  clubColors?: string
  venue?: string
  coach?: Person
  squad?: Person[]
  runningCompetitions?: Competition[]
}

export interface Person {
  id: number
  name: string
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  nationality?: string
  position?: string  // Goalkeeper, Defence, Midfield, Offence
  shirtNumber?: number
  marketValue?: number  // 시장 가치 (유로)
  contract?: {
    start?: string
    until?: string
  }
}

export interface Match {
  id: number
  utcDate: string
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED'
  matchday: number
  stage: string
  group?: string
  lastUpdated: string
  venue?: string
  homeTeam: {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
  }
  awayTeam: {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
  }
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  odds?: {
    homeWin?: number
    draw?: number
    awayWin?: number
  }
  referees?: Person[]
  competition: {
    id: number
    name: string
    code: string
    type: string
    emblem: string
  }
}

export interface Standing {
  stage: string
  type: 'TOTAL' | 'HOME' | 'AWAY'
  group?: string
  table: StandingTableEntry[]
}

export interface StandingTableEntry {
  position: number
  team: {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
  }
  playedGames: number
  form: string | null // "W,W,D,L,W" 형식
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface HeadToHead {
  aggregates: {
    numberOfMatches: number
    totalGoals: number
    homeTeam: {
      id: number
      name: string
      wins: number
      draws: number
      losses: number
    }
    awayTeam: {
      id: number
      name: string
      wins: number
      draws: number
      losses: number
    }
  }
  matches: Match[]
}

// API 응답 타입
interface CompetitionsResponse {
  count: number
  competitions: Competition[]
}

interface MatchesResponse {
  filters: Record<string, string>
  resultSet: {
    count: number
    competitions: string
    first: string
    last: string
    played: number
  }
  matches: Match[]
}

interface StandingsResponse {
  filters: Record<string, string>
  competition: Competition
  season: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number
  }
  standings: Standing[]
}

interface TeamResponse extends Team {
  runningCompetitions: Competition[]
}

interface TeamMatchesResponse {
  filters: Record<string, string>
  resultSet: {
    count: number
    competitions: string
    first: string
    last: string
    played: number
  }
  matches: Match[]
}

interface HeadToHeadResponse {
  filters: Record<string, string>
  resultSet: {
    count: number
    first: string
    last: string
  }
  aggregates: HeadToHead['aggregates']
  matches: Match[]
}

// ===========================================
// 무료 리그 코드
// ===========================================

export const FREE_COMPETITIONS = {
  CHAMPIONS_LEAGUE: 'CL',
  PREMIER_LEAGUE: 'PL',
  BUNDESLIGA: 'BL1',
  LA_LIGA: 'PD',
  SERIE_A: 'SA',
  LIGUE_1: 'FL1',
  EREDIVISIE: 'DED',
  PRIMEIRA_LIGA: 'PPL',
  CHAMPIONSHIP: 'ELC',
  WORLD_CUP: 'WC',
  EURO: 'EC',
} as const

export const COMPETITION_IDS = {
  CL: 2001,   // Champions League
  PL: 2021,   // Premier League
  BL1: 2002,  // Bundesliga
  PD: 2014,   // La Liga (Primera Division)
  SA: 2019,   // Serie A
  FL1: 2015,  // Ligue 1
  DED: 2003,  // Eredivisie
  PPL: 2017,  // Primeira Liga
  ELC: 2016,  // Championship
  WC: 2000,   // World Cup
  EC: 2018,   // European Championship
} as const

// ===========================================
// API 함수
// ===========================================

export const footballDataApi = {
  // 모든 무료 리그 목록 조회
  getCompetitions: () =>
    apiRequest<CompetitionsResponse>('/competitions'),

  // 특정 리그 정보 조회
  getCompetition: (code: string) =>
    apiRequest<Competition>(`/competitions/${code}`),

  // 리그 순위표 조회
  getStandings: (competitionCode: string) =>
    apiRequest<StandingsResponse>(`/competitions/${competitionCode}/standings`),

  // 리그 경기 목록 조회
  getCompetitionMatches: (
    competitionCode: string,
    options?: {
      dateFrom?: string
      dateTo?: string
      status?: string
      matchday?: number
    }
  ) =>
    apiRequest<MatchesResponse>(`/competitions/${competitionCode}/matches`, options || {}),

  // 특정 날짜의 모든 경기 조회
  getMatchesByDate: (date: string) =>
    apiRequest<MatchesResponse>('/matches', { date }),

  // 날짜 범위의 경기 조회
  getMatchesByDateRange: (dateFrom: string, dateTo: string) =>
    apiRequest<MatchesResponse>('/matches', { dateFrom, dateTo }),

  // 특정 경기 상세 조회
  getMatch: (matchId: number) =>
    apiRequest<Match>(`/matches/${matchId}`),

  // 경기 상대전적 (Head to Head)
  getHeadToHead: (matchId: number, limit: number = 10) =>
    apiRequest<HeadToHeadResponse>(`/matches/${matchId}/head2head`, { limit }),

  // 팀 정보 조회
  getTeam: (teamId: number) =>
    apiRequest<TeamResponse>(`/teams/${teamId}`),

  // 팀 경기 목록 조회 (최근 경기 포함)
  getTeamMatches: (
    teamId: number,
    options?: {
      dateFrom?: string
      dateTo?: string
      status?: string
      limit?: number
    }
  ) =>
    apiRequest<TeamMatchesResponse>(`/teams/${teamId}/matches`, options || {}),

  // 리그 득점 순위
  getScorers: (competitionCode: string, limit: number = 10) =>
    apiRequest<{
      count: number
      competition: Competition
      season: { id: number; startDate: string; endDate: string; currentMatchday: number }
      scorers: Array<{
        player: Person
        team: { id: number; name: string; shortName: string; tla: string; crest: string }
        playedMatches: number
        goals: number
        assists: number | null
        penalties: number | null
      }>
    }>(`/competitions/${competitionCode}/scorers`, { limit }),
}

// ===========================================
// 유틸리티 함수
// ===========================================

/**
 * 경기 상태를 한글로 변환
 */
export function getMatchStatusKorean(status: Match['status']): string {
  const statusMap: Record<Match['status'], string> = {
    SCHEDULED: '예정',
    TIMED: '예정',
    IN_PLAY: '진행중',
    PAUSED: '휴식',
    FINISHED: '종료',
    SUSPENDED: '중단',
    POSTPONED: '연기',
    CANCELLED: '취소',
    AWARDED: '몰수',
  }
  return statusMap[status] || status
}

/**
 * 경기 결과를 W/D/L 형식으로 변환
 */
export function getMatchResult(
  match: Match,
  teamId: number
): 'W' | 'D' | 'L' | null {
  if (match.status !== 'FINISHED' || !match.score.winner) return null

  const isHomeTeam = match.homeTeam.id === teamId

  if (match.score.winner === 'DRAW') return 'D'
  if (match.score.winner === 'HOME_TEAM') return isHomeTeam ? 'W' : 'L'
  if (match.score.winner === 'AWAY_TEAM') return isHomeTeam ? 'L' : 'W'

  return null
}

/**
 * 팀의 최근 폼 계산 (예: "WWDLW")
 */
export function calculateRecentForm(matches: Match[], teamId: number): string {
  return matches
    .filter(m => m.status === 'FINISHED')
    .slice(0, 5)
    .map(m => getMatchResult(m, teamId))
    .filter(Boolean)
    .join('')
}

/**
 * 현재 시즌 문자열 반환 (예: "2024")
 */
export function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  // 축구 시즌은 보통 8월에 시작
  return month < 7 ? year - 1 : year
}

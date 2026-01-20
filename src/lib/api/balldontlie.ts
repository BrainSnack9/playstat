/**
 * BallDontLie API 클라이언트
 * 다중 스포츠 데이터 수집용
 *
 * 지원 스포츠:
 * - NBA (농구)
 * - EPL, La Liga, Serie A, Bundesliga, Ligue 1, MLS (축구)
 * - MLB (야구)
 *
 * Free Tier 제한:
 * - 분당 5회 요청
 * - 기본 데이터만 접근 가능
 * - 고급 통계는 유료 (ALL-STAR: 60/min, GOAT: 600/min)
 *
 * @see https://www.balldontlie.io/docs/
 */

// API Base URLs
const NBA_BASE_URL = 'https://api.balldontlie.io/v1'
const EPL_BASE_URL = 'https://api.balldontlie.io/epl/v1'
const LALIGA_BASE_URL = 'https://api.balldontlie.io/laliga/v1'
const SERIEA_BASE_URL = 'https://api.balldontlie.io/seriea/v1'
const BUNDESLIGA_BASE_URL = 'https://api.balldontlie.io/bundesliga/v1'
const LIGUE1_BASE_URL = 'https://api.balldontlie.io/ligue1/v1'
const MLS_BASE_URL = 'https://api.balldontlie.io/mls/v1'
const MLB_BASE_URL = 'https://api.balldontlie.io/mlb/v1'

// Rate Limit: 분당 5회 → 요청 사이 최소 13초 딜레이
const REQUEST_DELAY_MS = 13000

// 마지막 요청 시간 추적
let lastRequestTime = 0

/**
 * Rate Limit을 준수하며 API 요청
 * @param baseUrl - API Base URL (NBA, EPL, MLB 등)
 * @param endpoint - API 엔드포인트
 * @param params - 쿼리 파라미터
 */
async function rateLimitedFetch<T>(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string | number | string[]> = {}
): Promise<T> {
  const apiKey = process.env.BALLDONTLIE_API_KEY
  if (!apiKey) {
    throw new Error('BALLDONTLIE_API_KEY not configured')
  }

  // Rate limit 대기
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < REQUEST_DELAY_MS && lastRequestTime > 0) {
    const waitTime = REQUEST_DELAY_MS - timeSinceLastRequest
    console.log(`[BallDontLie] Rate limit: waiting ${waitTime}ms...`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }

  // 쿼리 파라미터 구성 (배열 지원)
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)))
    } else {
      searchParams.append(key, String(value))
    }
  })

  const url = `${baseUrl}${endpoint}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  console.log(`[BallDontLie] Fetching: ${baseUrl}${endpoint}`)

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
    cache: 'no-store',
  })

  lastRequestTime = Date.now()

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('BallDontLie rate limit exceeded. Please wait and retry.')
    }
    throw new Error(`BallDontLie API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// ===========================================
// 공통 타입 정의
// ===========================================

interface PaginatedResponse<T> {
  data: T[]
  meta: {
    next_cursor?: number
    per_page: number
  }
}

// ===========================================
// NBA (농구) 타입 정의
// ===========================================

export interface BDLTeam {
  id: number
  conference: string
  division: string
  city: string
  name: string
  full_name: string
  abbreviation: string
}

export interface BDLPlayer {
  id: number
  first_name: string
  last_name: string
  position: string
  height: string | null
  weight: string | null
  jersey_number: string | null
  college: string | null
  country: string | null
  draft_year: number | null
  draft_round: number | null
  draft_number: number | null
  team: BDLTeam
}

export interface BDLGame {
  id: number
  date: string
  season: number
  status: string
  period: number
  time: string | null
  postseason: boolean
  home_team_score: number
  visitor_team_score: number
  home_team: BDLTeam
  visitor_team: BDLTeam
}

// ===========================================
// Football/Soccer (축구) 타입 정의
// ===========================================

export interface BDLSoccerTeam {
  id: number
  name: string
  code: string
  logo: string
  country: string
  founded?: number
  venue?: string
}

export interface BDLSoccerPlayer {
  id: number
  name: string
  first_name: string
  last_name: string
  position: string
  jersey_number: number | null
  date_of_birth: string | null
  nationality: string | null
  height: string | null
  weight: string | null
  team: BDLSoccerTeam
}

export interface BDLSoccerGame {
  id: number
  date: string
  season: number
  week: number
  status: string
  venue: string | null
  home_team: BDLSoccerTeam
  away_team: BDLSoccerTeam
  home_team_score: number | null
  away_team_score: number | null
  home_team_halftime_score: number | null
  away_team_halftime_score: number | null
}

export interface BDLSoccerStanding {
  position: number
  team: BDLSoccerTeam
  season: number
  points: number
  games_played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  form: string | null
}

// ===========================================
// MLB (야구) 타입 정의
// ===========================================

export interface BDLBaseballTeam {
  id: number
  name: string
  abbreviation: string
  location: string
  league: string // AL or NL
  division: string
  logo: string
}

export interface BDLBaseballPlayer {
  id: number
  first_name: string
  last_name: string
  position: string
  jersey_number: number | null
  team: BDLBaseballTeam
}

export interface BDLBaseballGame {
  id: number
  date: string
  season: number
  status: string
  inning: number | null
  home_team: BDLBaseballTeam
  away_team: BDLBaseballTeam
  home_team_score: number | null
  away_team_score: number | null
  venue: string | null
}

export interface BDLBaseballStanding {
  team: BDLBaseballTeam
  season: number
  wins: number
  losses: number
  win_percentage: number
  games_back: number
  home_record: string
  away_record: string
  streak: string
}

// ===========================================
// NBA API 함수
// ===========================================

/**
 * NBA 팀 목록 조회
 */
export async function getTeams(): Promise<BDLTeam[]> {
  const response = await rateLimitedFetch<PaginatedResponse<BDLTeam>>(NBA_BASE_URL, '/teams')
  return response.data
}

/**
 * 특정 팀 조회
 */
export async function getTeam(teamId: number): Promise<BDLTeam> {
  const response = await rateLimitedFetch<{ data: BDLTeam }>(NBA_BASE_URL, `/teams/${teamId}`)
  return response.data
}

/**
 * 날짜별 경기 조회
 * @param dates - 조회할 날짜들 (YYYY-MM-DD 형식, 최대 여러 개)
 */
export async function getGamesByDates(dates: string[]): Promise<BDLGame[]> {
  const allGames: BDLGame[] = []

  // 날짜를 하나씩 조회 (rate limit 고려)
  for (const date of dates) {
    const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(NBA_BASE_URL, '/games', {
      'dates[]': date,
    })
    allGames.push(...response.data)
  }

  return allGames
}

/**
 * 날짜 범위별 경기 조회
 * @param startDate - 시작 날짜 (YYYY-MM-DD)
 * @param endDate - 종료 날짜 (YYYY-MM-DD)
 */
export async function getGamesByDateRange(
  startDate: string,
  endDate: string
): Promise<BDLGame[]> {
  const allGames: BDLGame[] = []
  let cursor: number | undefined

  do {
    const params: Record<string, string | number> = {
      start_date: startDate,
      end_date: endDate,
      per_page: 100,
    }
    if (cursor) {
      params.cursor = cursor
    }

    const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(NBA_BASE_URL, '/games', params)
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  return allGames
}

/**
 * 시즌별 경기 조회
 * @param season - 시즌 연도 (예: 2024)
 * @param teamIds - 팀 ID 필터 (선택)
 */
export async function getGamesBySeason(
  season: number,
  teamIds?: number[]
): Promise<BDLGame[]> {
  const allGames: BDLGame[] = []
  let cursor: number | undefined

  do {
    const params: Record<string, string | number> = {
      season: season,
      per_page: 100,
    }
    if (cursor) {
      params.cursor = cursor
    }
    if (teamIds && teamIds.length > 0) {
      // BallDontLie는 team_ids[] 파라미터 지원
      // 단, 여러 팀은 별도 요청 필요
    }

    const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(NBA_BASE_URL, '/games', params)
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  return allGames
}

/**
 * 팀의 최근 경기 조회 (단일 팀)
 * @param teamId - 팀 ID
 * @param count - 가져올 경기 수
 */
export async function getTeamRecentGames(
  teamId: number,
  count: number = 10
): Promise<BDLGame[]> {
  // 최근 경기를 가져오기 위해 현재 시즌 경기 중 해당 팀 필터
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 60) // 최근 60일

  const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(NBA_BASE_URL, '/games', {
    start_date: startDate.toISOString().split('T')[0],
    end_date: today.toISOString().split('T')[0],
    'team_ids[]': teamId,
    per_page: count,
  })

  // 완료된 경기만 필터 (status가 'Final')
  return response.data
    .filter((game) => game.status === 'Final')
    .slice(0, count)
}

/**
 * NBA 전체 팀 최근 경기 일괄 조회 (최적화)
 * 한 번의 API 호출로 모든 팀의 최근 경기를 가져옴
 * @returns 팀 ID를 키로 하는 Map
 */
export async function getAllTeamsRecentGames(
  season: number,
  recentDays: number = 30
): Promise<Map<number, BDLGame[]>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - recentDays)

  // 한 번의 API 호출로 최근 모든 경기 조회
  const allGames: BDLGame[] = []
  let cursor: number | undefined

  do {
    const queryParams: Record<string, string | number> = {
      season: season,
      start_date: startDate.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
      per_page: 100,
    }
    if (cursor) queryParams.cursor = cursor

    const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(
      NBA_BASE_URL,
      '/games',
      queryParams
    )
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  // 완료된 경기만 필터 후 날짜 역순 정렬
  const finishedGames = allGames
    .filter((game) => game.status === 'Final')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 팀별로 그룹핑
  const teamGamesMap = new Map<number, BDLGame[]>()

  for (const game of finishedGames) {
    // 홈팀
    if (!teamGamesMap.has(game.home_team.id)) {
      teamGamesMap.set(game.home_team.id, [])
    }
    const homeGames = teamGamesMap.get(game.home_team.id)!
    if (homeGames.length < 10) {
      homeGames.push(game)
    }

    // 원정팀 (visitor_team)
    if (!teamGamesMap.has(game.visitor_team.id)) {
      teamGamesMap.set(game.visitor_team.id, [])
    }
    const awayGames = teamGamesMap.get(game.visitor_team.id)!
    if (awayGames.length < 10) {
      awayGames.push(game)
    }
  }

  return teamGamesMap
}

/**
 * 두 팀 간 상대 전적 조회
 * (BallDontLie는 직접 H2H 엔드포인트가 없으므로 수동 필터링)
 */
export async function getHeadToHead(
  team1Id: number,
  team2Id: number,
  count: number = 5
): Promise<BDLGame[]> {
  // 최근 시즌들의 경기에서 두 팀이 모두 포함된 경기 찾기
  const today = new Date()
  const twoYearsAgo = new Date(today)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const response = await rateLimitedFetch<PaginatedResponse<BDLGame>>(NBA_BASE_URL, '/games', {
    start_date: twoYearsAgo.toISOString().split('T')[0],
    end_date: today.toISOString().split('T')[0],
    'team_ids[]': team1Id,
    per_page: 100,
  })

  // 상대팀이 team2인 경기만 필터
  const h2hGames = response.data.filter(
    (game) =>
      game.status === 'Final' &&
      ((game.home_team.id === team1Id && game.visitor_team.id === team2Id) ||
        (game.home_team.id === team2Id && game.visitor_team.id === team1Id))
  )

  // 최근 순 정렬 후 count개 반환
  return h2hGames
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, count)
}

/**
 * 현재 NBA 시즌 계산
 * NBA 시즌: 10월~6월 (예: 2024-25 시즌은 2024년 10월 시작)
 */
export function getCurrentNBASeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // 7월~9월은 이전 시즌으로 간주 (오프시즌)
  // 10월 이후는 현재 연도가 시즌
  return month >= 10 ? year : year - 1
}

/**
 * 팀 폼 계산 (최근 경기 결과 기반)
 * @returns 'W' 또는 'L'의 문자열 (예: "WWLWL")
 */
export function calculateTeamForm(games: BDLGame[], teamId: number): string {
  return games
    .slice(0, 5)
    .map((game) => {
      const isHome = game.home_team.id === teamId
      const teamScore = isHome ? game.home_team_score : game.visitor_team_score
      const opponentScore = isHome ? game.visitor_team_score : game.home_team_score
      return teamScore > opponentScore ? 'W' : 'L'
    })
    .join('')
}

/**
 * 시즌 경기 결과에서 팀별 순위 계산
 * @param games - 완료된 경기 목록
 * @returns 팀별 순위 데이터 (승률 기준 정렬)
 */
export interface TeamStanding {
  teamId: number
  teamName: string
  teamAbbrev: string
  conference: string
  division: string
  wins: number
  losses: number
  gamesPlayed: number
  winPct: number
  homeWins: number
  homeLosses: number
  awayWins: number
  awayLosses: number
  form: string // 최근 5경기 결과 (예: "WWLWL")
  rank?: number
}

export function calculateStandings(games: BDLGame[]): TeamStanding[] {
  // 팀별 통계 맵
  const teamStats = new Map<number, TeamStanding>()

  // 최신순으로 정렬 (form 계산용)
  const sortedGames = [...games]
    .filter(g => g.status === 'Final')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 팀별 최근 경기 기록 (form 계산용)
  const teamRecentResults = new Map<number, string[]>()

  for (const game of sortedGames) {
    const homeTeam = game.home_team
    const awayTeam = game.visitor_team
    const homeWon = game.home_team_score > game.visitor_team_score

    // 홈팀 통계 초기화
    if (!teamStats.has(homeTeam.id)) {
      teamStats.set(homeTeam.id, {
        teamId: homeTeam.id,
        teamName: homeTeam.full_name,
        teamAbbrev: homeTeam.abbreviation,
        conference: homeTeam.conference,
        division: homeTeam.division,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        form: '',
      })
      teamRecentResults.set(homeTeam.id, [])
    }

    // 원정팀 통계 초기화
    if (!teamStats.has(awayTeam.id)) {
      teamStats.set(awayTeam.id, {
        teamId: awayTeam.id,
        teamName: awayTeam.full_name,
        teamAbbrev: awayTeam.abbreviation,
        conference: awayTeam.conference,
        division: awayTeam.division,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        form: '',
      })
      teamRecentResults.set(awayTeam.id, [])
    }

    const homeStat = teamStats.get(homeTeam.id)!
    const awayStat = teamStats.get(awayTeam.id)!
    const homeRecent = teamRecentResults.get(homeTeam.id)!
    const awayRecent = teamRecentResults.get(awayTeam.id)!

    // 홈팀 결과 업데이트
    homeStat.gamesPlayed++
    if (homeWon) {
      homeStat.wins++
      homeStat.homeWins++
      if (homeRecent.length < 5) homeRecent.push('W')
    } else {
      homeStat.losses++
      homeStat.homeLosses++
      if (homeRecent.length < 5) homeRecent.push('L')
    }

    // 원정팀 결과 업데이트
    awayStat.gamesPlayed++
    if (!homeWon) {
      awayStat.wins++
      awayStat.awayWins++
      if (awayRecent.length < 5) awayRecent.push('W')
    } else {
      awayStat.losses++
      awayStat.awayLosses++
      if (awayRecent.length < 5) awayRecent.push('L')
    }
  }

  // 승률 계산 및 form 설정
  const standings = Array.from(teamStats.values()).map(stat => {
    stat.winPct = stat.gamesPlayed > 0 ? stat.wins / stat.gamesPlayed : 0
    // form은 최신순 (가장 최근 경기가 앞에)
    stat.form = (teamRecentResults.get(stat.teamId) || []).join('')
    return stat
  })

  // 승률 기준 정렬 (내림차순)
  standings.sort((a, b) => b.winPct - a.winPct)

  // 순위 부여
  standings.forEach((stat, index) => {
    stat.rank = index + 1
  })

  return standings
}

// ===========================================
// Football/Soccer API 함수
// ===========================================

export type SoccerLeague = 'epl' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1' | 'mls'

const SOCCER_LEAGUE_BASE_URLS: Record<SoccerLeague, string> = {
  epl: EPL_BASE_URL,
  laliga: LALIGA_BASE_URL,
  seriea: SERIEA_BASE_URL,
  bundesliga: BUNDESLIGA_BASE_URL,
  ligue1: LIGUE1_BASE_URL,
  mls: MLS_BASE_URL,
}

/**
 * 축구 리그 팀 목록 조회
 */
export async function getSoccerTeams(league: SoccerLeague): Promise<BDLSoccerTeam[]> {
  const baseUrl = SOCCER_LEAGUE_BASE_URLS[league]
  const response = await rateLimitedFetch<PaginatedResponse<BDLSoccerTeam>>(baseUrl, '/teams')
  return response.data
}

/**
 * 축구 경기 조회 (날짜 범위)
 */
export async function getSoccerGames(
  league: SoccerLeague,
  params: {
    season: number
    start_date?: string
    end_date?: string
    week?: number
  }
): Promise<BDLSoccerGame[]> {
  const baseUrl = SOCCER_LEAGUE_BASE_URLS[league]
  const allGames: BDLSoccerGame[] = []
  let cursor: number | undefined

  do {
    const queryParams: Record<string, string | number> = {
      season: params.season,
      per_page: 100,
    }
    if (params.start_date) queryParams.start_date = params.start_date
    if (params.end_date) queryParams.end_date = params.end_date
    if (params.week) queryParams.week = params.week
    if (cursor) queryParams.cursor = cursor

    const response = await rateLimitedFetch<PaginatedResponse<BDLSoccerGame>>(
      baseUrl,
      '/games',
      queryParams
    )
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  return allGames
}

/**
 * 축구 순위표 조회
 */
export async function getSoccerStandings(
  league: SoccerLeague,
  season: number
): Promise<BDLSoccerStanding[]> {
  const baseUrl = SOCCER_LEAGUE_BASE_URLS[league]
  const response = await rateLimitedFetch<PaginatedResponse<BDLSoccerStanding>>(
    baseUrl,
    '/standings',
    { season }
  )
  return response.data
}

/**
 * 축구 팀 최근 경기 조회 (단일 팀)
 */
export async function getSoccerTeamRecentGames(
  league: SoccerLeague,
  teamId: number,
  season: number,
  count: number = 10
): Promise<BDLSoccerGame[]> {
  const baseUrl = SOCCER_LEAGUE_BASE_URLS[league]
  const response = await rateLimitedFetch<PaginatedResponse<BDLSoccerGame>>(baseUrl, '/games', {
    season,
    'team_ids[]': teamId,
    per_page: count,
  })

  // 완료된 경기만 필터
  return response.data.filter((game) => game.status === 'FT').slice(0, count)
}

/**
 * 축구 리그 전체 팀 최근 경기 일괄 조회 (최적화)
 * 한 번의 API 호출로 해당 리그 모든 팀의 최근 경기를 가져옴
 * @returns 팀 ID를 키로 하는 Map
 */
export async function getSoccerAllTeamsRecentGames(
  league: SoccerLeague,
  season: number,
  recentDays: number = 30
): Promise<Map<number, BDLSoccerGame[]>> {
  const baseUrl = SOCCER_LEAGUE_BASE_URLS[league]
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - recentDays)

  // 한 번의 API 호출로 최근 모든 경기 조회
  const allGames: BDLSoccerGame[] = []
  let cursor: number | undefined

  do {
    const queryParams: Record<string, string | number> = {
      season,
      start_date: startDate.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
      per_page: 100,
    }
    if (cursor) queryParams.cursor = cursor

    const response = await rateLimitedFetch<PaginatedResponse<BDLSoccerGame>>(
      baseUrl,
      '/games',
      queryParams
    )
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  // 완료된 경기만 필터 후 날짜 역순 정렬
  const finishedGames = allGames
    .filter((game) => game.status === 'FT')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 팀별로 그룹핑
  const teamGamesMap = new Map<number, BDLSoccerGame[]>()

  for (const game of finishedGames) {
    // 홈팀
    if (!teamGamesMap.has(game.home_team.id)) {
      teamGamesMap.set(game.home_team.id, [])
    }
    const homeGames = teamGamesMap.get(game.home_team.id)!
    if (homeGames.length < 10) {
      homeGames.push(game)
    }

    // 원정팀
    if (!teamGamesMap.has(game.away_team.id)) {
      teamGamesMap.set(game.away_team.id, [])
    }
    const awayGames = teamGamesMap.get(game.away_team.id)!
    if (awayGames.length < 10) {
      awayGames.push(game)
    }
  }

  return teamGamesMap
}

/**
 * 현재 축구 시즌 계산 (예: 2024-25 시즌은 2024)
 * BallDontLie Soccer API는 시즌 시작 연도를 사용
 * 8월~12월: 현재 연도, 1월~7월: 전년도
 */
export function getCurrentSoccerSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // 8월 이후면 현재 연도가 시즌 시작 (예: 2024년 8월 = 2024-25 시즌 = season 2024)
  // 1월~7월이면 전년도가 시즌 시작 (예: 2025년 1월 = 2024-25 시즌 = season 2024)
  return month >= 8 ? year : year - 1
}

// ===========================================
// MLB (야구) API 함수
// ===========================================

/**
 * MLB 팀 목록 조회
 */
export async function getBaseballTeams(): Promise<BDLBaseballTeam[]> {
  const response = await rateLimitedFetch<PaginatedResponse<BDLBaseballTeam>>(
    MLB_BASE_URL,
    '/teams'
  )
  return response.data
}

/**
 * MLB 경기 조회 (날짜 범위)
 */
export async function getBaseballGames(params: {
  season: number
  start_date?: string
  end_date?: string
  team_ids?: number[]
}): Promise<BDLBaseballGame[]> {
  const allGames: BDLBaseballGame[] = []
  let cursor: number | undefined

  do {
    const queryParams: Record<string, string | number | string[]> = {
      season: params.season,
      per_page: 100,
    }
    if (params.start_date) queryParams.start_date = params.start_date
    if (params.end_date) queryParams.end_date = params.end_date
    if (params.team_ids) queryParams['team_ids[]'] = params.team_ids.map(String)
    if (cursor) queryParams.cursor = cursor

    const response = await rateLimitedFetch<PaginatedResponse<BDLBaseballGame>>(
      MLB_BASE_URL,
      '/games',
      queryParams
    )
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  return allGames
}

/**
 * MLB 순위표 조회
 */
export async function getBaseballStandings(season: number): Promise<BDLBaseballStanding[]> {
  const response = await rateLimitedFetch<PaginatedResponse<BDLBaseballStanding>>(
    MLB_BASE_URL,
    '/standings',
    { season }
  )
  return response.data
}

/**
 * MLB 팀 최근 경기 조회 (단일 팀)
 */
export async function getBaseballTeamRecentGames(
  teamId: number,
  count: number = 10
): Promise<BDLBaseballGame[]> {
  const today = new Date()
  const twoMonthsAgo = new Date(today)
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

  const response = await rateLimitedFetch<PaginatedResponse<BDLBaseballGame>>(
    MLB_BASE_URL,
    '/games',
    {
      start_date: twoMonthsAgo.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
      'team_ids[]': teamId,
      per_page: count,
    }
  )

  // 완료된 경기만 필터
  return response.data.filter((game) => game.status === 'Final').slice(0, count)
}

/**
 * MLB 전체 팀 최근 경기 일괄 조회 (최적화)
 * 한 번의 API 호출로 모든 팀의 최근 경기를 가져옴
 * @returns 팀 ID를 키로 하는 Map
 */
export async function getBaseballAllTeamsRecentGames(
  season: number,
  recentDays: number = 30
): Promise<Map<number, BDLBaseballGame[]>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - recentDays)

  // 한 번의 API 호출로 최근 모든 경기 조회
  const allGames: BDLBaseballGame[] = []
  let cursor: number | undefined

  do {
    const queryParams: Record<string, string | number> = {
      season,
      start_date: startDate.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
      per_page: 100,
    }
    if (cursor) queryParams.cursor = cursor

    const response = await rateLimitedFetch<PaginatedResponse<BDLBaseballGame>>(
      MLB_BASE_URL,
      '/games',
      queryParams
    )
    allGames.push(...response.data)
    cursor = response.meta.next_cursor
  } while (cursor)

  // 완료된 경기만 필터 후 날짜 역순 정렬
  const finishedGames = allGames
    .filter((game) => game.status === 'Final')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 팀별로 그룹핑
  const teamGamesMap = new Map<number, BDLBaseballGame[]>()

  for (const game of finishedGames) {
    // 홈팀
    if (!teamGamesMap.has(game.home_team.id)) {
      teamGamesMap.set(game.home_team.id, [])
    }
    const homeGames = teamGamesMap.get(game.home_team.id)!
    if (homeGames.length < 10) {
      homeGames.push(game)
    }

    // 원정팀
    if (!teamGamesMap.has(game.away_team.id)) {
      teamGamesMap.set(game.away_team.id, [])
    }
    const awayGames = teamGamesMap.get(game.away_team.id)!
    if (awayGames.length < 10) {
      awayGames.push(game)
    }
  }

  return teamGamesMap
}

/**
 * 현재 MLB 시즌 계산
 * MLB 시즌: 4월~10월 (예: 2025년 시즌)
 */
export function getCurrentMLBSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // 11월~3월은 이전 시즌으로 간주 (오프시즌)
  // 4월~10월은 현재 연도가 시즌
  return month >= 4 && month <= 10 ? year : year - 1
}

/**
 * MLB 경기 결과에서 팀별 순위 계산
 * (Free Tier에서 /standings API 미지원으로 직접 계산)
 */
export interface BaseballTeamStanding {
  teamId: number
  teamName: string
  teamAbbrev: string
  league: string
  division: string
  wins: number
  losses: number
  gamesPlayed: number
  winPct: number
  form: string
  rank?: number
}

export function calculateBaseballStandings(games: BDLBaseballGame[]): BaseballTeamStanding[] {
  const teamStats = new Map<number, BaseballTeamStanding>()
  const teamRecentResults = new Map<number, string[]>()

  // 완료된 경기만 필터, 최신순 정렬
  const finishedGames = games
    .filter(g => g.status === 'STATUS_FINAL' || g.status === 'Final')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  for (const game of finishedGames) {
    const homeTeam = game.home_team
    const awayTeam = game.away_team
    const homeScore = game.home_team_score || 0
    const awayScore = game.away_team_score || 0
    const homeWon = homeScore > awayScore

    // 홈팀 통계 초기화
    if (!teamStats.has(homeTeam.id)) {
      teamStats.set(homeTeam.id, {
        teamId: homeTeam.id,
        teamName: homeTeam.name,
        teamAbbrev: homeTeam.abbreviation,
        league: homeTeam.league || '',
        division: homeTeam.division || '',
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: 0,
        form: '',
      })
      teamRecentResults.set(homeTeam.id, [])
    }

    // 원정팀 통계 초기화
    if (!teamStats.has(awayTeam.id)) {
      teamStats.set(awayTeam.id, {
        teamId: awayTeam.id,
        teamName: awayTeam.name,
        teamAbbrev: awayTeam.abbreviation,
        league: awayTeam.league || '',
        division: awayTeam.division || '',
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: 0,
        form: '',
      })
      teamRecentResults.set(awayTeam.id, [])
    }

    const homeStat = teamStats.get(homeTeam.id)!
    const awayStat = teamStats.get(awayTeam.id)!
    const homeRecent = teamRecentResults.get(homeTeam.id)!
    const awayRecent = teamRecentResults.get(awayTeam.id)!

    // 홈팀 통계 업데이트
    homeStat.gamesPlayed++
    if (homeWon) {
      homeStat.wins++
      if (homeRecent.length < 5) homeRecent.push('W')
    } else {
      homeStat.losses++
      if (homeRecent.length < 5) homeRecent.push('L')
    }

    // 원정팀 통계 업데이트
    awayStat.gamesPlayed++
    if (!homeWon) {
      awayStat.wins++
      if (awayRecent.length < 5) awayRecent.push('W')
    } else {
      awayStat.losses++
      if (awayRecent.length < 5) awayRecent.push('L')
    }
  }

  // 승률 계산 및 form 설정
  const standings = Array.from(teamStats.values()).map(stat => {
    stat.winPct = stat.gamesPlayed > 0 ? stat.wins / stat.gamesPlayed : 0
    stat.form = teamRecentResults.get(stat.teamId)?.join('') || ''
    return stat
  })

  // 승률 기준 정렬 후 순위 부여
  standings.sort((a, b) => b.winPct - a.winPct)
  standings.forEach((stat, idx) => {
    stat.rank = idx + 1
  })

  return standings
}

// ===========================================
// 통합 export
// ===========================================

export const ballDontLieApi = {
  // NBA
  getTeams,
  getTeam,
  getGamesByDates,
  getGamesByDateRange,
  getGamesBySeason,
  getTeamRecentGames,
  getAllTeamsRecentGames,
  getHeadToHead,
  getCurrentNBASeason,
  calculateTeamForm,
  calculateStandings,

  // Football/Soccer
  getSoccerTeams,
  getSoccerGames,
  getSoccerStandings,
  getSoccerTeamRecentGames,
  getSoccerAllTeamsRecentGames,
  getCurrentSoccerSeason,

  // MLB
  getBaseballTeams,
  getBaseballGames,
  getBaseballStandings,
  getBaseballTeamRecentGames,
  getBaseballAllTeamsRecentGames,
  getCurrentMLBSeason,
  calculateBaseballStandings,
}

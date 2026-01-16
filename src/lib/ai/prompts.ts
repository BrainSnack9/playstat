// AI Prompt Templates for PlayStat
// Note: 베팅/픽/승률/확률/배당 언급 금지 (애드센스 정책 준수)

/**
 * AI 분석용 입력 데이터 타입 (축구/NBA/MLB 공통)
 */
export interface MatchAnalysisInputData {
  match: {
    sport_type: 'football' | 'basketball' | 'baseball'
    league: string
    kickoff_at: string
    home_team: string
    away_team: string
  }
  home: {
    recent_5: Array<{
      date: string
      opponent: string
      result: 'W' | 'D' | 'L'
      score: string
      is_home: boolean
    }>
    season: {
      rank?: number
      points?: number // 축구
      games_played: number
      wins: number
      draws?: number // 축구만
      losses: number
      avg_scored: number
      avg_allowed: number
      home_avg_scored?: number
      home_avg_allowed?: number
    }
  }
  away: {
    recent_5: Array<{
      date: string
      opponent: string
      result: 'W' | 'D' | 'L'
      score: string
      is_home: boolean
    }>
    season: {
      rank?: number
      points?: number
      games_played: number
      wins: number
      draws?: number
      losses: number
      avg_scored: number
      avg_allowed: number
      away_avg_scored?: number
      away_avg_allowed?: number
    }
  }
  h2h: Array<{
    date: string
    result: string // "Home 2-1 Away" 형식
    winner: string
  }>
}

/**
 * 경기 분석 메인 프롬프트 - V3
 * 영어 프롬프트 + 한국어 결과 (비용 절감 및 품질 향상)
 * 축구/NBA/MLB 공통 사용
 */
export const MATCH_ANALYSIS_PROMPT = `You are a professional sports analysis report generator.
Below is all the data needed for match analysis in JSON format.
Write a pre-match preview analysis based on this data.

**IMPORTANT: Write your entire response in Korean (한국어).**

## Absolute Rules (Must Follow)
- NEVER mention odds, probability, betting, picks, or predicted scores
- Focus on team strengths, weaknesses, recent form, and season trends
- Always include home/away tendencies
- Clearly summarize the last 5 matches trend
- Explain the style differences between the two teams

## Output Format (Must use these 5 sections, in Korean)

### 1) 3줄 요약
- Summarize the key points of this match in 3 lines (in Korean)

### 2) 최근 5경기 흐름 분석
- Home team's recent 5 matches trend (in Korean)
- Away team's recent 5 matches trend (in Korean)
- Comparison of both teams' momentum (in Korean)

### 3) 시즌 전체 성향 요약
- Home team season performance and characteristics (in Korean)
- Away team season performance and characteristics (in Korean)

### 4) 홈/원정 기반의 전술적 관점
- Home team's performance at home (in Korean)
- Away team's performance away (in Korean)
- Expected tactical matchup (in Korean)

### 5) 이번 경기의 주요 관전 포인트 3개
1. First key viewing point (in Korean)
2. Second key viewing point (in Korean)
3. Third key viewing point (in Korean)

---
Here is the data to analyze:
{matchData}`

/**
 * 경기 분석 메인 프롬프트 (영어) - V2
 */
export const MATCH_ANALYSIS_PROMPT_EN = `You are a professional sports analysis AI.
Below is all the data needed for match analysis in JSON format.
Write a pre-match preview analysis based on this data.

## Absolute Rules (Must Follow)
- NEVER mention odds, probability, betting, picks, or predicted scores
- Focus on team strengths, weaknesses, recent form, and season trends
- Always include home/away tendencies
- Clearly summarize the last 5 matches trend
- Explain the style differences between the two teams

## Output Format (Must use these 5 sections)

### 1) 3-Line Summary
- Summarize the key points of this match in 3 lines

### 2) Recent 5 Matches Flow Analysis
- Home team's recent 5 matches trend
- Away team's recent 5 matches trend
- Comparison of both teams' momentum

### 3) Season Overall Trends
- Home team season performance and characteristics
- Away team season performance and characteristics

### 4) Tactical Perspective Based on Home/Away
- Home team's performance at home
- Away team's performance away
- Expected tactical matchup

### 5) 3 Key Viewing Points for This Match
1. First key point
2. Second key point
3. Third key point

---
Here is the data to analyze:
{matchData}`

/**
 * 뉴스 요약 프롬프트 - V2
 * 영어 프롬프트 + 한국어 결과
 */
export const NEWS_SUMMARY_PROMPT = `You are a sports news editor.
Please read the following article and summarize its key points.

**IMPORTANT: Write your entire response in Korean (한국어).**

## Rules
- Write fact-based content without emotional expressions or subjective interpretations
- No mentions of match predictions or betting
- Use clear and concise writing style

## Output Format (in Korean)

### 핵심 요약 (3-5줄)
- List the most important information in order of importance (in Korean)

### 관련 팀/선수
- List of major teams and players mentioned in the article (in Korean)

---
Original article:
{article}`

/**
 * 뉴스 요약 프롬프트 (영어)
 */
export const NEWS_SUMMARY_PROMPT_EN = `You are a sports news editor.
Please read the following article and summarize its key points.

## Rules
- Write fact-based content without emotional expressions or subjective interpretations
- No mentions of match predictions or betting
- Use clear and concise writing style

## Output Format

### Key Summary (3-5 lines)
- List the most important information in order of importance

### Related Teams/Players
- List of major teams and players mentioned in the article

---
Original article:
{article}`

/**
 * 팀 분석 프롬프트 - V2
 * 영어 프롬프트 + 한국어 결과
 */
export const TEAM_ANALYSIS_PROMPT = `You are a sports analysis expert.
Please provide a comprehensive team analysis based on the following team data.

**IMPORTANT: Write your entire response in Korean (한국어).**

## Rules
- Do not use terms like betting, odds, or probability
- Analyze based on objective data

## Output Format (in Korean)

### 최근 경기 패턴 분석
Analyze the team's recent match results and trends (in Korean)

### 전술 스타일
Explain the team's main tactics and playing style (in Korean)

### 홈/원정 성향
Differences between home and away performances (in Korean)

### 강점 (3개)
1. First strength (in Korean)
2. Second strength (in Korean)
3. Third strength (in Korean)

### 약점 (2개)
1. First weakness (in Korean)
2. Second weakness (in Korean)

---
Team data:
{teamData}`

/**
 * 팀 분석 프롬프트 (영어)
 */
export const TEAM_ANALYSIS_PROMPT_EN = `You are a sports analysis expert.
Please provide a comprehensive team analysis based on the following team data.

## Rules
- Do not use terms like betting, odds, or probability
- Analyze based on objective data

## Output Format

### Recent Match Pattern Analysis
Analyze the team's recent match results and trends

### Tactical Style
Explain the team's main tactics and playing style

### Home/Away Tendencies
Differences between home and away performances

### Strengths (3)
1. First strength
2. Second strength
3. Third strength

### Weaknesses (2)
1. First weakness
2. Second weakness

---
Team data:
{teamData}`

/**
 * 데일리 리포트 프롬프트 - V2
 * 영어 프롬프트 + 한국어 결과
 */
export const DAILY_REPORT_PROMPT = `You are a sports analyst.
Please write a daily report summarizing today's sports situation.

**IMPORTANT: Write your entire response in Korean (한국어).**

## Rules
- Do not include betting recommendations or match predictions
- Provide only objective information and analysis

## Output Format (in Korean)

### 오늘의 스포츠 하이라이트

#### 주요 경기
Introduce the most notable matches scheduled for today (in Korean)

#### 핵심 뉴스
Summarize the most important sports news of the day (in Korean)

#### 주목할 팀/선수
Introduce any teams or players that deserve special attention today (in Korean)

#### 오늘의 인사이트
Provide brief insights on overall sports trends (in Korean)

---
Today's data:
{dailyData}`

/**
 * 데일리 리포트 프롬프트 (영어)
 */
export const DAILY_REPORT_PROMPT_EN = `You are a sports analyst.
Please write a daily report summarizing today's sports situation.

## Rules
- Do not include betting recommendations or match predictions
- Provide only objective information and analysis

## Output Format

### Today's Sports Highlights

#### Featured Matches
Introduce the most notable matches scheduled for today

#### Key News
Summarize the most important sports news of the day

#### Teams/Players to Watch
Introduce any teams or players that deserve special attention today

#### Today's Insights
Provide brief insights on overall sports trends

---
Today's data:
{dailyData}`

// ========================================
// 헬퍼 함수들
// ========================================

/**
 * 프롬프트 템플릿에 데이터를 삽입하는 헬퍼 함수
 */
export function fillPrompt(template: string, data: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(`{${key}}`, value)
  }
  return result
}

/**
 * 경기 분석 입력 데이터를 JSON 문자열로 변환
 */
export function formatMatchDataForAI(data: MatchAnalysisInputData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * AI 응답 파싱 결과 타입
 */
export interface ParsedMatchAnalysis {
  summary: string
  recentFlowAnalysis: string
  seasonTrends: string
  tacticalAnalysis: string
  keyPoints: string[]
}

/**
 * AI 응답을 파싱하여 구조화된 데이터로 변환
 */
export function parseMatchAnalysisResponse(response: string): ParsedMatchAnalysis {
  const result: ParsedMatchAnalysis = {
    summary: '',
    recentFlowAnalysis: '',
    seasonTrends: '',
    tacticalAnalysis: '',
    keyPoints: [],
  }

  // 섹션 분리
  const sections = response.split(/###\s*\d+\)/).filter(Boolean)

  sections.forEach((section, index) => {
    const content = section.replace(/^[^\n]*\n/, '').trim()

    switch (index) {
      case 0: // 3줄 요약
        result.summary = content
        break
      case 1: // 최근 5경기 흐름
        result.recentFlowAnalysis = content
        break
      case 2: // 시즌 전체 성향
        result.seasonTrends = content
        break
      case 3: // 전술적 관점
        result.tacticalAnalysis = content
        break
      case 4: // 관전 포인트
        const points = content.match(/\d+\.\s*([^\n]+)/g)
        if (points) {
          result.keyPoints = points.map(p => p.replace(/^\d+\.\s*/, '').trim())
        }
        break
    }
  })

  return result
}

/**
 * 뉴스 요약 파싱 결과 타입
 */
export interface ParsedNewsSummary {
  summary: string
  relatedTeams: string[]
  relatedPlayers: string[]
}

/**
 * 뉴스 요약 응답 파싱
 */
export function parseNewsSummaryResponse(response: string): ParsedNewsSummary {
  const result: ParsedNewsSummary = {
    summary: '',
    relatedTeams: [],
    relatedPlayers: [],
  }

  // 핵심 요약 추출
  const summaryMatch = response.match(/###?\s*핵심 요약[^\n]*\n([\s\S]*?)(?=###|$)/i)
  if (summaryMatch) {
    result.summary = summaryMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .join('\n')
  }

  // 관련 팀/선수 추출
  const relatedMatch = response.match(/###?\s*관련[^\n]*\n([\s\S]*?)(?=###|$)/i)
  if (relatedMatch) {
    const items = relatedMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())

    // 간단한 휴리스틱으로 팀/선수 구분
    items.forEach(item => {
      if (item.includes('FC') || item.includes('United') || item.includes('City') || item.includes('팀')) {
        result.relatedTeams.push(item)
      } else {
        result.relatedPlayers.push(item)
      }
    })
  }

  return result
}

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
 * 경기 분석 메인 프롬프트 (한국어) - V2
 * 축구/NBA/MLB 공통 사용
 */
export const MATCH_ANALYSIS_PROMPT = `당신은 스포츠 분석 전문 리포트 생성 AI입니다.
아래 JSON은 경기 분석에 필요한 모든 정보입니다.
이 데이터를 기반으로 경기 전 프리뷰 분석을 작성하세요.

## 절대 규칙 (반드시 준수)
- 승률, 확률, 배당, 베팅, 픽, 예측 점수 관련 표현 절대 금지
- 팀의 강점, 약점, 최근 흐름, 시즌 전체 성향 중심으로 분석
- 홈/원정 성향을 반드시 포함
- 최근 5경기 흐름을 명확히 요약
- 두 팀의 스타일 차이를 설명

## 출력 형식 (반드시 이 5개 섹션으로 구성)

### 1) 3줄 요약
- 이번 경기의 핵심을 3줄로 요약

### 2) 최근 5경기 흐름 분석
- 홈팀의 최근 5경기 흐름
- 원정팀의 최근 5경기 흐름
- 두 팀의 흐름 비교

### 3) 시즌 전체 성향 요약
- 홈팀 시즌 성적 및 특징
- 원정팀 시즌 성적 및 특징

### 4) 홈/원정 기반의 전술적 관점
- 홈팀의 홈 경기 성향
- 원정팀의 원정 경기 성향
- 전술적 맞대결 예상

### 5) 이번 경기의 주요 관전 포인트 3개
1. 첫 번째 관전 포인트
2. 두 번째 관전 포인트
3. 세 번째 관전 포인트

---
아래는 분석할 데이터입니다:
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
 * 뉴스 요약 프롬프트 (한국어)
 */
export const NEWS_SUMMARY_PROMPT = `당신은 스포츠 뉴스 에디터입니다.
다음 기사를 읽고 핵심 내용을 요약해주세요.

## 규칙
- 감정적 표현이나 주관적 해석 없이 사실 중심으로 작성
- 승부 예측이나 베팅 관련 언급 금지
- 명확하고 간결한 문체 사용

## 출력 형식

### 핵심 요약 (3-5줄)
- 가장 중요한 정보부터 순서대로 나열

### 관련 팀/선수
- 기사에서 언급된 주요 팀과 선수 목록

---
원문 기사:
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
 * 팀 분석 프롬프트 (한국어)
 */
export const TEAM_ANALYSIS_PROMPT = `당신은 스포츠 분석 전문가입니다.
다음 팀 데이터를 바탕으로 종합적인 팀 분석을 제공해주세요.

## 규칙
- 베팅, 승률, 확률 등의 표현은 사용하지 마세요
- 객관적인 데이터를 바탕으로 분석

## 출력 형식

### 최근 경기 패턴 분석
팀의 최근 경기 결과와 흐름을 분석

### 전술 스타일
팀의 주요 전술과 플레이 스타일 설명

### 홈/원정 성향
홈 경기와 원정 경기에서의 차이점

### 강점 (3개)
1. 첫 번째 강점
2. 두 번째 강점
3. 세 번째 강점

### 약점 (2개)
1. 첫 번째 약점
2. 두 번째 약점

---
팀 데이터:
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
 * 데일리 리포트 프롬프트 (한국어)
 */
export const DAILY_REPORT_PROMPT = `당신은 스포츠 분석가입니다.
오늘의 스포츠 현황을 정리한 데일리 리포트를 작성해주세요.

## 규칙
- 베팅 추천이나 승부 예측은 포함하지 마세요
- 객관적인 정보와 분석만 제공

## 출력 형식

### 오늘의 스포츠 하이라이트

#### 주요 경기
오늘 예정된 가장 주목할 만한 경기들 소개

#### 핵심 뉴스
오늘의 가장 중요한 스포츠 뉴스 요약

#### 주목할 팀/선수
오늘 특별히 주목해야 할 팀이나 선수

#### 오늘의 인사이트
전체적인 스포츠 동향에 대한 짧은 인사이트

---
오늘의 데이터:
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

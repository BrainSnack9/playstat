import { Prisma } from '@prisma/client'

export interface TeamTrend {
  teamId: string
  teamName: string
  trendType: 'winning_streak' | 'losing_streak' | 'scoring_machine' | 'defense_leak' | 'clean_sheet_streak' | 'draw_streak'
  value: number
  description: string
  descriptionEn: string
}

export interface MatchTrend {
  matchId: string
  homeTrend?: TeamTrend
  awayTrend?: TeamTrend
  combinedTrend?: {
    type: 'high_scoring_match' | 'defensive_battle' | 'mismatch'
    description: string
    descriptionEn: string
  }
}

/**
 * 팀의 최근 경기 데이터를 분석하여 트렌드를 추출합니다.
 */
export function analyzeTeamTrend(
  teamName: string,
  teamId: string,
  recentMatchesJson: any,
  seasonStats: any
): TeamTrend[] {
  const trends: TeamTrend[] = []
  if (!recentMatchesJson || !Array.isArray(recentMatchesJson)) return trends

  const matches = recentMatchesJson.slice(0, 5) // 최근 5경기 기준
  if (matches.length < 3) return trends

  // 1. 연승/연패 계산
  let winningStreak = 0
  let losingStreak = 0
  let drawStreak = 0

  for (const m of matches) {
    if (m.result === 'W') {
      if (losingStreak > 0 || drawStreak > 0) break
      winningStreak++
    } else if (m.result === 'L') {
      if (winningStreak > 0 || drawStreak > 0) break
      losingStreak++
    } else if (m.result === 'D') {
      if (winningStreak > 0 || losingStreak > 0) break
      drawStreak++
    } else {
      break
    }
  }

  if (winningStreak >= 2) {
    trends.push({
      teamId,
      teamName,
      trendType: 'winning_streak',
      value: winningStreak,
      description: `${winningStreak}연승 중`,
      descriptionEn: `${winningStreak} match winning streak`,
    })
  } else if (losingStreak >= 2) {
    trends.push({
      teamId,
      teamName,
      trendType: 'losing_streak',
      value: losingStreak,
      description: `${losingStreak}연패 중`,
      descriptionEn: `${losingStreak} match losing streak`,
    })
  }

  // 2. 득점력/실점력 분석
  const totalGoalsFor = matches.reduce((sum, m) => {
    const scores = m.score.split('-').map(Number)
    const goals = m.isHome ? scores[0] : scores[1]
    return sum + (isNaN(goals) ? 0 : goals)
  }, 0)

  const totalGoalsAgainst = matches.reduce((sum, m) => {
    const scores = m.score.split('-').map(Number)
    const goals = m.isHome ? scores[1] : scores[0]
    return sum + (isNaN(goals) ? 0 : goals)
  }, 0)

  if (totalGoalsFor >= 10) {
    trends.push({
      teamId,
      teamName,
      trendType: 'scoring_machine',
      value: totalGoalsFor,
      description: `최근 5경기 ${totalGoalsFor}득점 (폭발적 화력)`,
      descriptionEn: `${totalGoalsFor} goals in last 5 matches (Explosive offense)`,
    })
  }

  if (totalGoalsAgainst >= 10) {
    trends.push({
      teamId,
      teamName,
      trendType: 'defense_leak',
      value: totalGoalsAgainst,
      description: `최근 5경기 ${totalGoalsAgainst}실점 (수비 불안)`,
      descriptionEn: `${totalGoalsAgainst} goals conceded in last 5 matches (Defensive leak)`,
    })
  }

  return trends
}

/**
 * 두 팀의 트렌드를 비교하여 경기의 전체적인 특징을 추출합니다.
 */
export function getMatchCombinedTrend(homeTrends: TeamTrend[], awayTrends: TeamTrend[]): MatchTrend['combinedTrend'] | undefined {
  const homeWinStreak = homeTrends.find(t => t.trendType === 'winning_streak')?.value || 0
  const awayLossStreak = awayTrends.find(t => t.trendType === 'losing_streak')?.value || 0

  if (homeWinStreak >= 2 && awayLossStreak >= 2) {
    return {
      type: 'mismatch',
      description: '최상의 기세 vs 최악의 슬럼프',
      descriptionEn: 'Peak form vs Deep slump',
    }
  }

  const homeScoring = homeTrends.find(t => t.trendType === 'scoring_machine')
  const awayDefense = awayTrends.find(t => t.trendType === 'defense_leak')

  if (homeScoring && awayDefense) {
    return {
      type: 'high_scoring_match',
      description: '창과 방패: 화력 대결 예상',
      descriptionEn: 'Spear vs Shield: High scoring expected',
    }
  }

  return undefined
}

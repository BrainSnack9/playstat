import { PrismaClient } from '@prisma/client'
import { openai, AI_MODELS, TOKEN_LIMITS } from '../src/lib/openai'
import {
  fillPrompt,
  formatMatchDataForAI,
  parseMatchAnalysisResponse,
  MATCH_ANALYSIS_PROMPT,
  type MatchAnalysisInputData,
} from '../src/lib/ai/prompts'
import { analyzeTeamTrend, getMatchCombinedTrend } from '../src/lib/ai/trend-engine'

const prisma = new PrismaClient()

async function main() {
  if (!openai) {
    console.error('OpenAI not configured!')
    process.exit(1)
  }

  console.log('=== Testing Basketball AI Analysis (One Match) ===\n')

  // Get one match without analysis
  const match = await prisma.match.findFirst({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: { gte: new Date() },
      matchAnalysis: null,
    },
    include: {
      league: true,
      homeTeam: { include: { seasonStats: true, recentMatches: true } },
      awayTeam: { include: { seasonStats: true, recentMatches: true } },
    },
  })

  if (!match) {
    console.log('No matches found without analysis')
    return
  }

  if (!match.homeTeam.seasonStats || !match.awayTeam.seasonStats) {
    console.log('Missing team stats')
    return
  }

  console.log(`Testing: ${match.homeTeam.name} vs ${match.awayTeam.name}`)

  // Build AI input data
  const homeStats = match.homeTeam.seasonStats
  const awayStats = match.awayTeam.seasonStats
  const homeRecent = (match.homeTeam.recentMatches?.matchesJson as Array<{
    date: string
    opponent: string
    result: 'W' | 'D' | 'L'
    score: string
    isHome: boolean
  }>) || []
  const awayRecent = (match.awayTeam.recentMatches?.matchesJson as Array<{
    date: string
    opponent: string
    result: 'W' | 'D' | 'L'
    score: string
    isHome: boolean
  }>) || []

  // Trend analysis
  const homeTrends = analyzeTeamTrend(
    match.homeTeam.name,
    match.homeTeam.id,
    match.homeTeam.recentMatches?.matchesJson
  )
  const awayTrends = analyzeTeamTrend(
    match.awayTeam.name,
    match.awayTeam.id,
    match.awayTeam.recentMatches?.matchesJson
  )
  const combinedTrend = getMatchCombinedTrend(homeTrends, awayTrends)

  const getTrendDescEn = (t: { trendType: string; value: number }) => {
    switch (t.trendType) {
      case 'winning_streak': return `${t.value} match winning streak`
      case 'losing_streak': return `${t.value} match losing streak`
      case 'scoring_machine': return `${t.value} points in last 5 matches (Explosive offense)`
      case 'defense_leak': return `${t.value} points conceded in last 5 matches (Defensive leak)`
      default: return ''
    }
  }

  const getCombinedTrendDescEn = (ct: { type: string }) => {
    switch (ct.type) {
      case 'mismatch': return 'Peak form vs Deep slump'
      case 'high_scoring_match': return 'Spear vs Shield: High scoring expected'
      default: return ''
    }
  }

  const inputData: MatchAnalysisInputData = {
    match: {
      sport_type: 'basketball',
      league: match.league.name,
      kickoff_at: match.kickoffAt.toISOString(),
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
    },
    trends: {
      home: homeTrends.map(t => getTrendDescEn(t)),
      away: awayTrends.map(t => getTrendDescEn(t)),
      combined: combinedTrend ? getCombinedTrendDescEn(combinedTrend) : undefined,
    },
    home: {
      recent_5: homeRecent.slice(0, 5).map((m) => ({
        date: m.date,
        opponent: m.opponent,
        result: m.result,
        score: m.score,
        is_home: m.isHome,
      })),
      season: {
        games_played: homeStats.gamesPlayed,
        wins: homeStats.wins,
        losses: homeStats.losses,
        avg_scored: homeStats.goalsFor ? homeStats.goalsFor / homeStats.gamesPlayed : 0,
        avg_allowed: homeStats.goalsAgainst ? homeStats.goalsAgainst / homeStats.gamesPlayed : 0,
        home_avg_scored: homeStats.homeAvgFor ?? undefined,
        home_avg_allowed: homeStats.homeAvgAgainst ?? undefined,
      },
    },
    away: {
      recent_5: awayRecent.slice(0, 5).map((m) => ({
        date: m.date,
        opponent: m.opponent,
        result: m.result,
        score: m.score,
        is_home: m.isHome,
      })),
      season: {
        games_played: awayStats.gamesPlayed,
        wins: awayStats.wins,
        losses: awayStats.losses,
        avg_scored: awayStats.goalsFor ? awayStats.goalsFor / awayStats.gamesPlayed : 0,
        avg_allowed: awayStats.goalsAgainst ? awayStats.goalsAgainst / awayStats.gamesPlayed : 0,
        away_avg_scored: awayStats.awayAvgFor ?? undefined,
        away_avg_allowed: awayStats.awayAvgAgainst ?? undefined,
      },
    },
    h2h: [],
  }

  console.log('\n📊 Input Data:')
  console.log(JSON.stringify(inputData, null, 2))

  const prompt = fillPrompt(MATCH_ANALYSIS_PROMPT, {
    matchData: formatMatchDataForAI(inputData),
  })

  console.log('\n📝 Prompt preview (first 500 chars):')
  console.log(prompt.substring(0, 500) + '...')

  console.log('\n🤖 Calling OpenAI API...')
  const response = await openai.chat.completions.create({
    model: AI_MODELS.ANALYSIS,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: TOKEN_LIMITS.ANALYSIS,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  console.log('\n✅ OpenAI Response:')
  console.log(content)

  console.log('\n📋 Parsed result:')
  const parsed = parseMatchAnalysisResponse(content)
  console.log(JSON.stringify(parsed, null, 2))

  console.log('\n✅ Test completed successfully!')
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

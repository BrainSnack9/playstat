import { PrismaClient } from '@prisma/client'
import { openai, AI_MODELS, TOKEN_LIMITS } from '../src/lib/openai'
import {
  fillPrompt,
  formatMatchDataForAI,
  parseMatchAnalysisResponse,
  MATCH_ANALYSIS_PROMPT,
  type MatchAnalysisInputData,
} from '../src/lib/ai/prompts'
import { addHours } from 'date-fns'
import { analyzeTeamTrend, getMatchCombinedTrend } from '../src/lib/ai/trend-engine'

const prisma = new PrismaClient()

async function main() {
  if (!openai) {
    console.error('OpenAI not configured!')
    process.exit(1)
  }

  console.log('=== Generating Basketball AI Analysis ===\n')

  // 48시간 이내 경기 조회
  const now = new Date()
  const in48Hours = addHours(now, 48)

  const matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: { gte: now, lte: in48Hours },
      status: { in: ['SCHEDULED', 'TIMED'] },
      matchAnalysis: null, // AI 분석이 없는 경기만
    },
    include: {
      league: true,
      homeTeam: { include: { seasonStats: true, recentMatches: true } },
      awayTeam: { include: { seasonStats: true, recentMatches: true } },
    },
    take: 10,
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`Found ${matches.length} matches without AI analysis\n`)

  let successCount = 0
  let errorCount = 0

  for (const match of matches) {
    try {
      console.log(`Processing: ${match.homeTeam.name} vs ${match.awayTeam.name}`)

      const matchData = formatMatchDataForAI(match)
      const prompt = fillPrompt(matchData, 'basketball')

      console.log('  Calling OpenAI API...')
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

      const parsed = parseMatchAnalysisResponse(content)

      await prisma.matchAnalysis.create({
        data: {
          matchId: match.id,
          sportType: 'BASKETBALL',
          keyPoints: parsed.keyPoints,
          homeTeamAnalysis: parsed.homeTeamAnalysis,
          awayTeamAnalysis: parsed.awayTeamAnalysis,
          headToHead: parsed.headToHead,
          prediction: parsed.prediction,
          aiGenerated: true,
        },
      })

      console.log('  ✅ AI analysis created successfully\n')
      successCount++
    } catch (error) {
      console.error(`  ❌ Error: ${error}\n`)
      errorCount++
    }
  }

  console.log(`\nSummary:`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

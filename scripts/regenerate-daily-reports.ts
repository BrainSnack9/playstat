/**
 * 데일리 리포트 재생성 스크립트
 * 1월 19-21일 축구/농구 데일리 리포트를 재생성합니다.
 *
 * 사용법: npx tsx scripts/regenerate-daily-reports.ts
 */

import { PrismaClient, SportType } from '@prisma/client'
import { openai, AI_MODELS, TOKEN_LIMITS } from '../src/lib/openai'
import { fillPrompt, DAILY_REPORT_PROMPT_EN } from '../src/lib/ai/prompts'
import { format, startOfDay, endOfDay } from 'date-fns'

const prisma = new PrismaClient({
  log: ['warn', 'error'],
})

// 타겟 날짜들 (KST 기준)
const TARGET_DATES = ['2026-01-19', '2026-01-20', '2026-01-21']

// 스포츠 타입 (축구, 농구)
const SPORT_TYPES: SportType[] = ['FOOTBALL', 'BASKETBALL']

async function generateDailyReports() {
  console.log('\n' + '='.repeat(50))
  console.log(' 📊 Daily Reports Regeneration')
  console.log('='.repeat(50) + '\n')

  if (!openai) {
    console.error('❌ OpenAI not configured!')
    return
  }

  for (const sportType of SPORT_TYPES) {
    console.log(`\n--- ${sportType} ---`)
    const sportName = sportType === 'FOOTBALL' ? 'football' : 'basketball'

    for (const dateStr of TARGET_DATES) {
      try {
        process.stdout.write(`  ${dateStr}... `)

        const date = new Date(dateStr + 'T00:00:00+09:00')
        const dayStart = startOfDay(date)
        const dayEnd = endOfDay(date)

        // 기존 리포트 삭제
        await prisma.dailyReport.deleteMany({
          where: {
            sportType,
            date: { gte: dayStart, lte: dayEnd },
          },
        })

        // 해당 날짜의 경기 조회
        const matches = await prisma.match.findMany({
          where: {
            sportType,
            kickoffAt: { gte: dayStart, lte: dayEnd },
          },
          include: {
            league: true,
            homeTeam: { include: { seasonStats: true } },
            awayTeam: { include: { seasonStats: true } },
            matchAnalysis: true,
          },
          orderBy: { kickoffAt: 'asc' },
        })

        if (matches.length === 0) {
          console.log('no matches, skipped')
          continue
        }

        // 경기 데이터를 AI 입력용으로 포맷
        const matchData = matches.map(m => ({
          id: m.id,
          league: m.league.name,
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          kickoff: format(new Date(m.kickoffAt), 'HH:mm'),
          homeRank: m.homeTeam.seasonStats?.rank,
          awayRank: m.awayTeam.seasonStats?.rank,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          hasAnalysis: !!m.matchAnalysis,
        }))

        const prompt = fillPrompt(DAILY_REPORT_PROMPT_EN, {
          sport: sportName,
          date: dateStr,
          matchData: JSON.stringify(matchData, null, 2),
        })

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

        const parsed = JSON.parse(content)

        // DB에 저장 (summary 필드 필수 포함)
        const newReport = await prisma.dailyReport.create({
          data: {
            date: dayStart,
            sportType,
            summary: parsed.summary || `${sportName.charAt(0).toUpperCase() + sportName.slice(1)} games and analysis for ${dateStr}`,
            summaryEn: parsed.summary || '',
            hotMatches: parsed.hotMatches || [],
            keyNews: [],
            insights: [],
            translations: {
              en: {
                title: parsed.title || `${sportName.charAt(0).toUpperCase() + sportName.slice(1)} Games - ${dateStr}`,
                metaDescription: parsed.metaDescription || `${sportName} games and analysis for ${dateStr}`,
                summary: parsed.summary || '',
                sections: parsed.sections || [],
                keywords: parsed.keywords || [],
                hotMatches: parsed.hotMatches || [],
              },
            },
          },
        })

        // 다국어 번역 수행
        try {
          const { ensureDailyReportTranslations } = await import('../src/lib/ai/translate')
          await ensureDailyReportTranslations(newReport)
          console.log('✅ (with translations)')
        } catch (translateError) {
          console.log('✅ (translation failed, EN only)')
        }

        // API 레이트 리밋 대기 (5초)
        await sleep(5000)
      } catch (error) {
        console.log(`❌ Error: ${String(error).substring(0, 80)}`)
        await sleep(3000)
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log(' 📊 Daily Reports Regeneration Script')
  console.log('='.repeat(60))
  console.log(`\n Target dates: ${TARGET_DATES.join(', ')}`)
  console.log(` Sports: ${SPORT_TYPES.join(', ')}`)
  console.log('\n' + '='.repeat(60))

  const startTime = Date.now()

  try {
    await generateDailyReports()

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log('\n' + '='.repeat(60))
    console.log(` ✅ Completed in ${duration} seconds!`)
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

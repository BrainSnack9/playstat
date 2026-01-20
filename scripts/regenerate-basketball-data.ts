/**
 * 농구 데이터 재생성 스크립트
 * 1월 19-21일 경기 데이터, AI 분석, 데일리 리포트를 재생성합니다.
 *
 * 사용법: npx ts-node scripts/regenerate-basketball-data.ts
 */

import { PrismaClient, SportType } from '@prisma/client'
import { openai, AI_MODELS, TOKEN_LIMITS } from '../src/lib/openai'
import {
  fillPrompt,
  formatMatchDataForAI,
  parseMatchAnalysisResponse,
  MATCH_ANALYSIS_PROMPT_EN,
  DAILY_REPORT_PROMPT_EN,
  type MatchAnalysisInputData,
} from '../src/lib/ai/prompts'
import { analyzeTeamTrend, getMatchCombinedTrend } from '../src/lib/ai/trend-engine'
import { format, startOfDay, endOfDay, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

// 타겟 날짜들 (KST 기준)
const TARGET_DATES = ['2026-01-19', '2026-01-20', '2026-01-21']
const TIMEZONE = 'Asia/Seoul'

interface RecentMatch {
  date: string
  opponent: string
  result: 'W' | 'D' | 'L'
  score: string
  isHome: boolean
}

async function deleteExistingData() {
  console.log('\n=== Step 1: Deleting existing data ===\n')

  for (const dateStr of TARGET_DATES) {
    const date = new Date(dateStr + 'T00:00:00+09:00')
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // 해당 날짜의 경기 ID 조회
    const matches = await prisma.match.findMany({
      where: {
        sportType: 'BASKETBALL',
        kickoffAt: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    })

    const matchIds = matches.map(m => m.id)
    console.log(`${dateStr}: Found ${matchIds.length} matches`)

    if (matchIds.length > 0) {
      // 분석 데이터 삭제
      const deletedAnalysis = await prisma.matchAnalysis.deleteMany({
        where: { matchId: { in: matchIds } },
      })
      console.log(`  - Deleted ${deletedAnalysis.count} match analyses`)
    }

    // 데일리 리포트 삭제
    const deletedReports = await prisma.dailyReport.deleteMany({
      where: {
        sportType: 'BASKETBALL',
        date: { gte: dayStart, lte: dayEnd },
      },
    })
    console.log(`  - Deleted ${deletedReports.count} daily reports`)
  }
}

async function updateMatchStatuses() {
  console.log('\n=== Step 2: Updating match statuses ===\n')

  const now = new Date()

  for (const dateStr of TARGET_DATES) {
    const date = new Date(dateStr + 'T00:00:00+09:00')
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // 과거 경기는 FINISHED로, 미래 경기는 SCHEDULED로 업데이트
    if (dayEnd < now) {
      const updated = await prisma.match.updateMany({
        where: {
          sportType: 'BASKETBALL',
          kickoffAt: { gte: dayStart, lte: dayEnd },
          status: { not: 'FINISHED' },
        },
        data: { status: 'FINISHED' },
      })
      console.log(`${dateStr}: Updated ${updated.count} matches to FINISHED`)
    } else {
      const updated = await prisma.match.updateMany({
        where: {
          sportType: 'BASKETBALL',
          kickoffAt: { gte: dayStart, lte: dayEnd },
          status: 'LIVE',
        },
        data: { status: 'SCHEDULED' },
      })
      if (updated.count > 0) {
        console.log(`${dateStr}: Updated ${updated.count} matches to SCHEDULED`)
      }
    }
  }
}

async function generateMatchAnalyses() {
  console.log('\n=== Step 3: Generating AI match analyses ===\n')

  if (!openai) {
    console.error('OpenAI not configured!')
    return
  }

  // 오늘과 내일 경기만 분석 생성 (과거 경기는 스킵)
  const now = new Date()
  const todayStr = format(toZonedTime(now, TIMEZONE), 'yyyy-MM-dd')
  const futureDates = TARGET_DATES.filter(d => d >= todayStr)

  if (futureDates.length === 0) {
    console.log('No future dates to generate analyses for')
    return
  }

  for (const dateStr of futureDates) {
    const date = new Date(dateStr + 'T00:00:00+09:00')
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    const matches = await prisma.match.findMany({
      where: {
        sportType: 'BASKETBALL',
        kickoffAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'TIMED'] },
        matchAnalysis: null,
      },
      include: {
        league: true,
        homeTeam: { include: { seasonStats: true, recentMatches: true } },
        awayTeam: { include: { seasonStats: true, recentMatches: true } },
      },
      orderBy: { kickoffAt: 'asc' },
    })

    console.log(`${dateStr}: Found ${matches.length} matches to analyze`)

    for (const match of matches) {
      try {
        console.log(`  Processing: ${match.homeTeam.name} vs ${match.awayTeam.name}`)

        if (!match.homeTeam.seasonStats || !match.awayTeam.seasonStats) {
          console.log('    ⚠️ Missing team stats, skipping')
          continue
        }

        // AI 입력 데이터 구성
        const inputData = buildAnalysisInput(match)

        // 영어 분석 생성
        const prompt = fillPrompt(MATCH_ANALYSIS_PROMPT_EN, {
          matchData: formatMatchDataForAI(inputData),
        })

        const response = await openai.chat.completions.create({
          model: AI_MODELS.ANALYSIS,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: TOKEN_LIMITS.ANALYSIS,
          temperature: 0.7,
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error('No response from OpenAI')
        }

        const parsed = parseMatchAnalysisResponse(content)

        // DB에 저장
        await prisma.matchAnalysis.create({
          data: {
            matchId: match.id,
            translations: {
              en: {
                summary: parsed.summary,
                recentFlowAnalysis: parsed.recentFlowAnalysis,
                seasonTrends: parsed.seasonTrends,
                tacticalAnalysis: parsed.tacticalAnalysis,
                keyPoints: parsed.keyPoints,
              },
            },
            inputDataSnapshot: JSON.parse(JSON.stringify(inputData)),
          },
        })

        // 다국어 번역 수행
        const { ensureMatchAnalysisTranslations } = await import('../src/lib/ai/translate')
        const newAnalysis = await prisma.matchAnalysis.findFirst({
          where: { matchId: match.id },
        })
        if (newAnalysis) {
          await ensureMatchAnalysisTranslations(newAnalysis)
        }

        console.log('    ✅ Analysis created')

        // API 레이트 리밋 대기
        await sleep(2000)
      } catch (error) {
        console.error(`    ❌ Error: ${error}`)
      }
    }
  }
}

async function generateDailyReports() {
  console.log('\n=== Step 4: Generating daily reports ===\n')

  if (!openai) {
    console.error('OpenAI not configured!')
    return
  }

  for (const dateStr of TARGET_DATES) {
    try {
      console.log(`Generating report for ${dateStr}...`)

      const date = new Date(dateStr + 'T00:00:00+09:00')
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)

      // 해당 날짜의 경기 조회
      const matches = await prisma.match.findMany({
        where: {
          sportType: 'BASKETBALL',
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
        console.log(`  No matches found for ${dateStr}, skipping`)
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
        hasAnalysis: !!m.matchAnalysis,
      }))

      const prompt = fillPrompt(DAILY_REPORT_PROMPT_EN, {
        sport: 'basketball',
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

      // DB에 저장
      await prisma.dailyReport.create({
        data: {
          date: dayStart,
          sportType: 'BASKETBALL',
          translations: {
            en: {
              title: parsed.title || `NBA Games - ${dateStr}`,
              metaDescription: parsed.metaDescription || `NBA basketball games and analysis for ${dateStr}`,
              summary: parsed.summary || '',
              sections: parsed.sections || [],
              keywords: parsed.keywords || [],
              hotMatches: parsed.hotMatches || [],
            },
          },
        },
      })

      // 다국어 번역 수행
      const { ensureDailyReportTranslations } = await import('../src/lib/ai/translate')
      const newReport = await prisma.dailyReport.findFirst({
        where: {
          date: dayStart,
          sportType: 'BASKETBALL',
        },
      })
      if (newReport) {
        await ensureDailyReportTranslations(newReport)
      }

      console.log(`  ✅ Daily report created for ${dateStr}`)

      // API 레이트 리밋 대기
      await sleep(3000)
    } catch (error) {
      console.error(`  ❌ Error for ${dateStr}: ${error}`)
    }
  }
}

function buildAnalysisInput(match: {
  league: { name: string }
  kickoffAt: Date
  homeTeam: {
    name: string
    seasonStats: {
      rank: number | null
      points: number | null
      gamesPlayed: number
      wins: number
      draws: number | null
      losses: number
      goalsFor: number | null
      goalsAgainst: number | null
      form: string | null
      homeAvgFor: number | null
      homeAvgAgainst: number | null
    } | null
    recentMatches: {
      matchesJson: unknown
    } | null
  }
  awayTeam: {
    name: string
    seasonStats: {
      rank: number | null
      points: number | null
      gamesPlayed: number
      wins: number
      draws: number | null
      losses: number
      goalsFor: number | null
      goalsAgainst: number | null
      form: string | null
      awayAvgFor: number | null
      awayAvgAgainst: number | null
    } | null
    recentMatches: {
      matchesJson: unknown
    } | null
  }
}): MatchAnalysisInputData {
  const homeStats = match.homeTeam.seasonStats!
  const awayStats = match.awayTeam.seasonStats!
  const homeRecent = (match.homeTeam.recentMatches?.matchesJson as RecentMatch[]) || []
  const awayRecent = (match.awayTeam.recentMatches?.matchesJson as RecentMatch[]) || []

  // 트렌드 분석
  const homeTrends = analyzeTeamTrend(
    match.homeTeam.name,
    '',
    match.homeTeam.recentMatches?.matchesJson
  )
  const awayTrends = analyzeTeamTrend(
    match.awayTeam.name,
    '',
    match.awayTeam.recentMatches?.matchesJson
  )
  const combinedTrend = getMatchCombinedTrend(homeTrends, awayTrends)

  const getTrendDescEn = (t: { trendType: string; value: number }) => {
    switch (t.trendType) {
      case 'winning_streak': return `${t.value} game winning streak`
      case 'losing_streak': return `${t.value} game losing streak`
      case 'scoring_machine': return `${t.value} points in last 5 games (Explosive offense)`
      case 'defense_leak': return `${t.value} points allowed in last 5 games (Defensive issues)`
      default: return ''
    }
  }

  const getCombinedTrendDescEn = (ct: { type: string }) => {
    switch (ct.type) {
      case 'mismatch': return 'Peak form vs Deep slump'
      case 'high_scoring_match': return 'High scoring game expected'
      default: return ''
    }
  }

  return {
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
      recent_5: homeRecent.slice(0, 5).map(m => ({
        date: m.date,
        opponent: m.opponent,
        result: m.result,
        score: m.score,
        is_home: m.isHome,
      })),
      season: {
        rank: homeStats.rank ?? undefined,
        points: homeStats.points ?? undefined,
        games_played: homeStats.gamesPlayed,
        wins: homeStats.wins,
        draws: homeStats.draws ?? undefined,
        losses: homeStats.losses,
        avg_scored: homeStats.goalsFor ? homeStats.goalsFor / homeStats.gamesPlayed : 0,
        avg_allowed: homeStats.goalsAgainst ? homeStats.goalsAgainst / homeStats.gamesPlayed : 0,
        home_avg_scored: homeStats.homeAvgFor ?? undefined,
        home_avg_allowed: homeStats.homeAvgAgainst ?? undefined,
      },
    },
    away: {
      recent_5: awayRecent.slice(0, 5).map(m => ({
        date: m.date,
        opponent: m.opponent,
        result: m.result,
        score: m.score,
        is_home: m.isHome,
      })),
      season: {
        rank: awayStats.rank ?? undefined,
        points: awayStats.points ?? undefined,
        games_played: awayStats.gamesPlayed,
        wins: awayStats.wins,
        draws: awayStats.draws ?? undefined,
        losses: awayStats.losses,
        avg_scored: awayStats.goalsFor ? awayStats.goalsFor / awayStats.gamesPlayed : 0,
        avg_allowed: awayStats.goalsAgainst ? awayStats.goalsAgainst / awayStats.gamesPlayed : 0,
        away_avg_scored: awayStats.awayAvgFor ?? undefined,
        away_avg_allowed: awayStats.awayAvgAgainst ?? undefined,
      },
    },
    h2h: [],
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('========================================')
  console.log(' Basketball Data Regeneration Script')
  console.log(' Target dates:', TARGET_DATES.join(', '))
  console.log('========================================')

  try {
    await deleteExistingData()
    await updateMatchStatuses()
    await generateMatchAnalyses()
    await generateDailyReports()

    console.log('\n========================================')
    console.log(' ✅ All tasks completed!')
    console.log('========================================\n')
  } catch (error) {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

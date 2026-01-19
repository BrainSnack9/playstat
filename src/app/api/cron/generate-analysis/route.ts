import { NextResponse } from 'next/server'
import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import {
  fillPrompt,
  formatMatchDataForAI,
  parseMatchAnalysisResponse,
  type MatchAnalysisInputData,
} from '@/lib/ai/prompts'
import { addHours } from 'date-fns'
import { type PrismaClient, Prisma, SportType } from '@prisma/client'
import { analyzeTeamTrend, getMatchCombinedTrend } from '@/lib/ai/trend-engine'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'

import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/generate-analysis
 * 크론: 경기 48시간 전 AI 분석 생성
 * 실행: 매일 여러 번
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI not configured' },
      { status: 500 }
    )
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { matchId: string; success: boolean; error?: string }[] = []

  // sport 파라미터로 스포츠 타입 필터 (기본값: 전체)
  const sportType = getSportFromRequest(request)
  const sportTypeEnum = sportIdToEnum(sportType) as SportType

  try {
    const now = new Date()
    const in48Hours = addHours(now, 48)

    // 48시간 이내 경기 중 아직 분석이 없는 것들 또는 다국어 번역이 누락된 것들 조회
    const matchesNeedingAnalysis = await prisma.match.findMany({
      where: {
        sportType: sportTypeEnum,
        kickoffAt: {
          gte: now,
          lte: in48Hours,
        },
        status: { in: ['SCHEDULED', 'TIMED'] },
        OR: [
          { matchAnalysis: { is: null } },
          { matchAnalysis: { translations: { equals: Prisma.AnyNull } } }
        ]
      } as unknown as Prisma.MatchWhereInput,
      include: {
        league: true,
        matchAnalysis: true,
        homeTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
        awayTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
      },
      take: 5,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const match of (matchesNeedingAnalysis as any[])) {
      try {
        // 이미 분석이 있지만 다국어 번역이 없는 경우 번역 수행
        if (match.matchAnalysis && !match.matchAnalysis.translations) {
          const { ensureMatchAnalysisTranslations } = await import('@/lib/ai/translate')
          await ensureMatchAnalysisTranslations(match.matchAnalysis)
          results.push({ matchId: match.id, success: true })
          continue
        }

        // 팀 스탯이 없으면 스킵
        if (!match.homeTeam.seasonStats || !match.homeTeam.recentMatches) {
          results.push({
            matchId: match.id,
            success: false,
            error: 'Home team stats not available',
          })
          continue
        }

        if (!match.awayTeam.seasonStats || !match.awayTeam.recentMatches) {
          results.push({
            matchId: match.id,
            success: false,
            error: 'Away team stats not available',
          })
          continue
        }
        
        // 상대전적 조회
        const h2h = await prisma.headToHead.findFirst({
          where: {
            OR: [
              { teamAId: match.homeTeamId, teamBId: match.awayTeamId },
              { teamAId: match.awayTeamId, teamBId: match.homeTeamId },
            ],
          },
        })

        // AI 입력 데이터 구성
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputData = buildAnalysisInput(match as any, h2h)

        // 영어 분석 생성 (English First)
        console.log(`[Cron] Generating English analysis for match ${match.id}...`)
        const { MATCH_ANALYSIS_PROMPT_EN } = await import('@/lib/ai/prompts')
        const englishPrompt = fillPrompt(MATCH_ANALYSIS_PROMPT_EN, {
          matchData: formatMatchDataForAI(inputData),
        })

        const englishResponse = await openai.chat.completions.create({
          model: AI_MODELS.ANALYSIS,
          messages: [{ role: 'user', content: englishPrompt }],
          max_tokens: TOKEN_LIMITS.ANALYSIS,
          temperature: 0.7,
        })

        const englishContent = englishResponse.choices[0]?.message?.content
        if (!englishContent) {
          throw new Error('No response from OpenAI')
        }

        const parsedEnglish = parseMatchAnalysisResponse(englishContent)

        // DB에 저장 (영어를 원본으로)
        const newAnalysis = await prisma.matchAnalysis.create({
          data: {
            matchId: match.id,
            translations: {
              en: {
                summary: parsedEnglish.summary,
                recentFlowAnalysis: parsedEnglish.recentFlowAnalysis,
                seasonTrends: parsedEnglish.seasonTrends,
                tacticalAnalysis: parsedEnglish.tacticalAnalysis,
                keyPoints: parsedEnglish.keyPoints,
              }
            },
            inputDataSnapshot: JSON.parse(JSON.stringify(inputData)),
          },
        })

        // 즉시 다국어 번역 수행 (KO, ES, JA, AR)
        const { ensureMatchAnalysisTranslations } = await import('@/lib/ai/translate')
        await ensureMatchAnalysisTranslations(newAnalysis)

        results.push({ matchId: match.id, success: true })
      } catch (error) {
        console.error(`Analysis generation failed for match ${match.id}:`, error)
        results.push({
          matchId: match.id,
          success: false,
          error: String(error),
        })
      }
    }

    const duration = Date.now() - startTime
    
    // 캐시 무효화: 분석이 생성되었을 때
    if (results.some(r => r.success)) {
      console.log('[Cron] Revalidating match analysis tags...')
      revalidateTag('match-detail')
      revalidateTag('matches')
      revalidateTag('daily-report')
    }

    await prisma.schedulerLog.create({
      data: {
        jobName: 'generate-analysis',
        result: results.every((r) => r.success) ? 'success' : 'partial',
        details: results,
        duration,
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      analysesGenerated: results.filter((r) => r.success).length,
      results,
    })
  } catch (error) {
    console.error('Cron generate-analysis error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'generate-analysis',
        result: 'failed',
        details: { error: String(error) },
        duration: Date.now() - startTime,
      },
    })

    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// H2H 데이터 구조 (새로운 Football-Data.org 형식)
interface H2HData {
  matches?: Array<{
    date: string
    score: string
    winner: string
    homeTeam: string
    awayTeam: string
  }>
  aggregates?: {
    numberOfMatches: number
    totalGoals: number
    homeTeam: { id: number; name: string; wins: number; draws: number; losses: number }
    awayTeam: { id: number; name: string; wins: number; draws: number; losses: number }
  }
}

function buildAnalysisInput(
  match: {
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
        goalDifference: number | null
        form: string | null
        homeAvgFor: number | null
        homeAvgAgainst: number | null
        homeGoalsFor: number | null
        homeGoalsAgainst: number | null
      } | null
      recentMatches: {
        matchesJson: unknown
        recentForm: string | null
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
        goalDifference: number | null
        form: string | null
        awayAvgFor: number | null
        awayAvgAgainst: number | null
        awayGoalsFor: number | null
        awayGoalsAgainst: number | null
      } | null
      recentMatches: {
        matchesJson: unknown
        recentForm: string | null
      } | null
    }
  },
  h2h: { matchesJson: unknown } | null
): MatchAnalysisInputData {
  const homeStats = match.homeTeam.seasonStats!
  const awayStats = match.awayTeam.seasonStats!
  const homeRecent = match.homeTeam.recentMatches?.matchesJson as Array<{
    date: string
    opponent: string
    result: 'W' | 'D' | 'L'
    score: string
    isHome: boolean
    competition?: string
  }> || []
  const awayRecent = match.awayTeam.recentMatches?.matchesJson as Array<{
    date: string
    opponent: string
    result: 'W' | 'D' | 'L'
    score: string
    isHome: boolean
    competition?: string
  }> || []

  // H2H 데이터 파싱 (새 형식 지원)
  const h2hData = h2h?.matchesJson as H2HData | null
  const h2hMatches = h2hData?.matches || (Array.isArray(h2hData) ? h2hData : [])

  // 트렌드 분석 추가
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

  // AI 분석용 영문 텍스트 생성
  const getTrendDescEn = (t: { trendType: string; value: number }) => {
    switch (t.trendType) {
      case 'winning_streak': return `${t.value} match winning streak`
      case 'losing_streak': return `${t.value} match losing streak`
      case 'scoring_machine': return `${t.value} goals in last 5 matches (Explosive offense)`
      case 'defense_leak': return `${t.value} goals conceded in last 5 matches (Defensive leak)`
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

  return {
    match: {
      sport_type: 'football',
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
        rank: homeStats.rank ?? undefined,
        points: homeStats.points ?? undefined,
        games_played: homeStats.gamesPlayed,
        wins: homeStats.wins,
        draws: homeStats.draws ?? undefined,
        losses: homeStats.losses,
        avg_scored: homeStats.goalsFor
          ? homeStats.goalsFor / homeStats.gamesPlayed
          : 0,
        avg_allowed: homeStats.goalsAgainst
          ? homeStats.goalsAgainst / homeStats.gamesPlayed
          : 0,
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
        rank: awayStats.rank ?? undefined,
        points: awayStats.points ?? undefined,
        games_played: awayStats.gamesPlayed,
        wins: awayStats.wins,
        draws: awayStats.draws ?? undefined,
        losses: awayStats.losses,
        avg_scored: awayStats.goalsFor
          ? awayStats.goalsFor / awayStats.gamesPlayed
          : 0,
        avg_allowed: awayStats.goalsAgainst
          ? awayStats.goalsAgainst / awayStats.gamesPlayed
          : 0,
        away_avg_scored: awayStats.awayAvgFor ?? undefined,
        away_avg_allowed: awayStats.awayAvgAgainst ?? undefined,
      },
    },
    h2h: h2hMatches.map((m) => ({
      date: m.date,
      result: `${m.homeTeam} ${m.score} ${m.awayTeam}`,
      winner: m.winner,
    })),
  }
}

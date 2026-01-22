import { NextResponse } from 'next/server'
import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import type { PrismaClient, SportType } from '@prisma/client'
import { format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 특정 날짜의 데일리 리포트 생성
 */
async function generateReportForDate(
  prisma: PrismaClient,
  dateStr: string,
  sportTypeEnum: SportType,
  sportLabel: string,
  sportLabelEn: string
): Promise<{ success: boolean; reportId?: string; matchCount: number; message?: string }> {
  // UTC 기준 날짜 범위 (전세계 일관성)
  const dateOnly = new Date(dateStr + 'T00:00:00Z')
  const dayStart = dateOnly
  const dayEnd = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000 - 1)

  // 표시용 날짜
  const displayDate = new Date(dateStr + 'T00:00:00')
  const dateKo = format(displayDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
  const dateEn = format(displayDate, 'EEEE, MMMM do, yyyy')

  // 이미 리포트가 있는지 확인 (date 컬럼은 @db.Date 타입)
  const existingReport = await prisma.dailyReport.findFirst({
    where: { date: dateOnly, sportType: sportTypeEnum },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existingReport && (existingReport as any).translations) {
    return {
      success: true,
      message: `Report already exists for ${dateStr}`,
      reportId: existingReport.id,
      matchCount: 0,
    }
  }

  // 해당 날짜의 경기 조회 (팀 통계 포함)
  const matches = await prisma.match.findMany({
    where: {
      sportType: sportTypeEnum,
      kickoffAt: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: { in: ['SCHEDULED', 'TIMED'] },
    },
    include: {
      league: true,
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
      matchAnalysis: true,
    },
    orderBy: { kickoffAt: 'asc' },
  })

  // NBA Advanced Stats 조회 (농구인 경우만)
  const advancedStatsMap = new Map<string, {
    offRating: number | null
    defRating: number | null
    netRating: number | null
    pace: number | null
    fgPct: number | null
    fg3Pct: number | null
    avgPts: number | null
    avgReb: number | null
    avgAst: number | null
  }>()

  if (sportTypeEnum === 'BASKETBALL') {
    const teamIds = [...new Set(matches.flatMap(m => [m.homeTeamId, m.awayTeamId]))]
    if (teamIds.length > 0) {
      const advancedStats = await prisma.teamAdvancedStats.findMany({
        where: {
          teamId: { in: teamIds },
          sportType: 'BASKETBALL',
        },
        orderBy: { updatedAt: 'desc' },
      })
      for (const stat of advancedStats) {
        if (!advancedStatsMap.has(stat.teamId)) {
          advancedStatsMap.set(stat.teamId, {
            offRating: stat.offRating,
            defRating: stat.defRating,
            netRating: stat.netRating,
            pace: stat.pace,
            fgPct: stat.fgPct,
            fg3Pct: stat.fg3Pct,
            avgPts: stat.avgPts,
            avgReb: stat.avgReb,
            avgAst: stat.avgAst,
          })
        }
      }
    }
  }

  // H2H 데이터 조회 (각 경기별)
  const h2hMap = new Map<string, { teamAWins: number; teamBWins: number; draws: number; recentResults: string[] }>()
  for (const match of matches) {
    const h2h = await prisma.headToHead.findFirst({
      where: {
        OR: [
          { teamAId: match.homeTeamId, teamBId: match.awayTeamId },
          { teamAId: match.awayTeamId, teamBId: match.homeTeamId },
        ],
      },
    })
    if (h2h) {
      const matchesJson = h2h.matchesJson as Array<{ homeScore: number; awayScore: number; homeTeamId: string }>
      let homeWins = 0, awayWins = 0, draws = 0
      const recentResults: string[] = []

      for (const m of matchesJson.slice(0, 5)) {
        const isHomeTeamA = m.homeTeamId === match.homeTeamId
        if (m.homeScore === m.awayScore) {
          draws++
          recentResults.push('D')
        } else if ((m.homeScore > m.awayScore && isHomeTeamA) || (m.homeScore < m.awayScore && !isHomeTeamA)) {
          homeWins++
          recentResults.push('H')
        } else {
          awayWins++
          recentResults.push('A')
        }
      }
      h2hMap.set(match.id, { teamAWins: homeWins, teamBWins: awayWins, draws, recentResults })
    }
  }

  if (matches.length === 0) {
    // 경기가 없으면 간단한 리포트 생성 (날짜 제외 - 타임존 독립적)
    const emptyReportKo = {
      title: `${sportLabel} 경기 일정`,
      summary: `${sportLabel} 경기가 예정되어 있지 않습니다.`,
      sections: [],
      hotMatches: [],
      matchIds: [],
    }
    const emptyReportEn = {
      title: `${sportLabelEn} Schedule`,
      summary: `No ${sportLabelEn} matches scheduled.`,
      sections: [],
      hotMatches: [],
      matchIds: [],
    }

    await prisma.dailyReport.create({
      data: {
        date: dateOnly,
        sportType: sportTypeEnum,
        translations: {
          ko: emptyReportKo,
          en: emptyReportEn,
        },
      },
    })

    return {
      success: true,
      message: `No matches for ${dateStr}, created empty report`,
      matchCount: 0,
    }
  }

  // 연승/연패 계산 헬퍼
  const calculateStreak = (form: string | null | undefined): string => {
    if (!form) return '-'
    const matches = form.split('')
    let streak = 0
    const firstResult = matches[0]
    for (const result of matches) {
      if (result === firstResult) streak++
      else break
    }
    const label = firstResult === 'W' ? 'W' : firstResult === 'L' ? 'L' : 'D'
    return `${label}${streak}`
  }

  // AI 입력 데이터 구성 (보강된 버전 + Advanced Stats)
  const matchData = matches.map((match) => {
    const homeStats = match.homeTeam.seasonStats
    const awayStats = match.awayTeam.seasonStats
    const h2h = h2hMap.get(match.id)
    const homeAdvanced = advancedStatsMap.get(match.homeTeamId)
    const awayAdvanced = advancedStatsMap.get(match.awayTeamId)

    return {
      id: match.id,
      league: match.league.name,
      leagueCode: match.league.code,
      kickoffAt: format(match.kickoffAt, 'HH:mm'),
      homeTeam: {
        name: match.homeTeam.name,
        rank: homeStats?.rank,
        form: homeStats?.form,
        streak: calculateStreak(homeStats?.form),
        record: homeStats ? `${homeStats.wins}-${homeStats.losses}${homeStats.draws != null ? `-${homeStats.draws}` : ''}` : null,
        // 득실점 (농구: pointsScored/Allowed, 축구: goalsFor/Against)
        avgScored: homeStats?.pointsScored ?? (homeStats?.goalsFor && homeStats.gamesPlayed ? (homeStats.goalsFor / homeStats.gamesPlayed).toFixed(1) : null),
        avgAllowed: homeStats?.pointsAllowed ?? (homeStats?.goalsAgainst && homeStats.gamesPlayed ? (homeStats.goalsAgainst / homeStats.gamesPlayed).toFixed(1) : null),
        // 홈 성적
        homeRecord: homeStats ? `${homeStats.homeWins}-${homeStats.homeLosses ?? 0}${homeStats.homeDraws != null ? `-${homeStats.homeDraws}` : ''}` : null,
        homeAvgScored: homeStats?.homeAvgFor,
        homeAvgAllowed: homeStats?.homeAvgAgainst,
        // NBA Advanced Stats (농구 전용)
        ...(homeAdvanced ? {
          offRating: homeAdvanced.offRating,
          defRating: homeAdvanced.defRating,
          netRating: homeAdvanced.netRating,
          pace: homeAdvanced.pace,
          fgPct: homeAdvanced.fgPct ? (homeAdvanced.fgPct * 100).toFixed(1) : null,
          fg3Pct: homeAdvanced.fg3Pct ? (homeAdvanced.fg3Pct * 100).toFixed(1) : null,
          ppg: homeAdvanced.avgPts,
          rpg: homeAdvanced.avgReb,
          apg: homeAdvanced.avgAst,
        } : {}),
      },
      awayTeam: {
        name: match.awayTeam.name,
        rank: awayStats?.rank,
        form: awayStats?.form,
        streak: calculateStreak(awayStats?.form),
        record: awayStats ? `${awayStats.wins}-${awayStats.losses}${awayStats.draws != null ? `-${awayStats.draws}` : ''}` : null,
        avgScored: awayStats?.pointsScored ?? (awayStats?.goalsFor && awayStats.gamesPlayed ? (awayStats.goalsFor / awayStats.gamesPlayed).toFixed(1) : null),
        avgAllowed: awayStats?.pointsAllowed ?? (awayStats?.goalsAgainst && awayStats.gamesPlayed ? (awayStats.goalsAgainst / awayStats.gamesPlayed).toFixed(1) : null),
        // 원정 성적
        awayRecord: awayStats ? `${awayStats.awayWins}-${awayStats.awayLosses ?? 0}${awayStats.awayDraws != null ? `-${awayStats.awayDraws}` : ''}` : null,
        awayAvgScored: awayStats?.awayAvgFor,
        awayAvgAllowed: awayStats?.awayAvgAgainst,
        // NBA Advanced Stats (농구 전용)
        ...(awayAdvanced ? {
          offRating: awayAdvanced.offRating,
          defRating: awayAdvanced.defRating,
          netRating: awayAdvanced.netRating,
          pace: awayAdvanced.pace,
          fgPct: awayAdvanced.fgPct ? (awayAdvanced.fgPct * 100).toFixed(1) : null,
          fg3Pct: awayAdvanced.fg3Pct ? (awayAdvanced.fg3Pct * 100).toFixed(1) : null,
          ppg: awayAdvanced.avgPts,
          rpg: awayAdvanced.avgReb,
          apg: awayAdvanced.avgAst,
        } : {}),
      },
      // 상대전적
      h2h: h2h ? {
        homeWins: h2h.teamAWins,
        awayWins: h2h.teamBWins,
        draws: h2h.draws,
        recentResults: h2h.recentResults.join(''), // "HHADH" 형식
      } : null,
      hasAnalysis: !!match.matchAnalysis,
      matchday: match.matchday,
    }
  })

  // 리그별 그룹핑
  const matchesByLeague: Record<string, typeof matchData> = {}
  for (const match of matchData) {
    if (!matchesByLeague[match.league]) {
      matchesByLeague[match.league] = []
    }
    matchesByLeague[match.league].push(match)
  }

  const { DAILY_REPORT_PROMPT_EN } = await import('@/lib/ai/prompts')
  const prompt = DAILY_REPORT_PROMPT_EN
    .replace(/{sport}/g, sportLabelEn)
    .replace('{date}', dateEn)
    .replace('{matchData}', JSON.stringify({
      totalMatches: matchData.length,
      matchesByLeague,
      allMatches: matchData,
    }, null, 2))

  console.log(`[Cron] Generating report for ${dateStr}...`)
  const response = await openai!.chat.completions.create({
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

  // DB에 저장 (경기 ID 목록 포함)
  const matchIds = matches.map((m) => m.id)
  const reportData = {
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    summary: parsed.summary,
    sections: parsed.sections,
    keywords: parsed.keywords,
    hotMatches: parsed.hotMatches || [],
    matchIds, // 리포트 생성에 사용된 경기 ID 목록
  }

  let report
  if (existingReport) {
    report = await prisma.dailyReport.update({
      where: { id: existingReport.id },
      data: {
        translations: { en: reportData },
      },
    })
  } else {
    report = await prisma.dailyReport.create({
      data: {
        date: dateOnly,
        sportType: sportTypeEnum,
        translations: { en: reportData },
      },
    })
  }

  // 다국어 번역 수행
  const { ensureDailyReportTranslations } = await import('@/lib/ai/translate')
  await ensureDailyReportTranslations(report)

  return {
    success: true,
    reportId: report.id,
    matchCount: matches.length,
  }
}

/**
 * GET /api/cron/generate-daily-report
 * 오늘 + 내일 데일리 리포트 생성
 * - 오늘 리포트가 없으면 오늘 + 내일 생성
 * - 오늘 리포트가 있으면 내일만 생성
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

  // sport 파라미터로 스포츠 타입 결정 (기본값: football)
  const sportId = getSportFromRequest(request)
  const sportTypeEnum = sportIdToEnum(sportId) as SportType
  const sportLabel = sportId === 'basketball' ? 'NBA' : sportId === 'baseball' ? 'MLB' : '축구'
  const sportLabelEn = sportId === 'basketball' ? 'NBA' : sportId === 'baseball' ? 'MLB' : 'Football'

  try {
    // UTC 기준 오늘/내일 날짜 계산 (전세계 일관성)
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd')

    const results = []

    // 오늘 리포트 확인 (UTC 날짜 기준)
    const todayDateOnly = new Date(todayStr + 'T00:00:00Z')
    const todayReport = await prisma.dailyReport.findFirst({
      where: { date: todayDateOnly, sportType: sportTypeEnum },
    })

    // 오늘 리포트가 없으면 생성
    if (!todayReport) {
      console.log(`[Cron] Generating today's report (${todayStr})...`)
      const todayResult = await generateReportForDate(
        prisma,
        todayStr,
        sportTypeEnum,
        sportLabel,
        sportLabelEn
      )
      results.push({ date: todayStr, ...todayResult })
    } else {
      console.log(`[Cron] Today's report (${todayStr}) already exists`)
      results.push({ date: todayStr, success: true, message: 'Already exists', matchCount: 0 })
    }

    // 내일 리포트 생성
    console.log(`[Cron] Generating tomorrow's report (${tomorrowStr})...`)
    const tomorrowResult = await generateReportForDate(
      prisma,
      tomorrowStr,
      sportTypeEnum,
      sportLabel,
      sportLabelEn
    )
    results.push({ date: tomorrowStr, ...tomorrowResult })

    const duration = Date.now() - startTime

    // 캐시 무효화
    console.log('[Cron] Revalidating daily report tag...')
    revalidateTag('daily-report')

    await prisma.schedulerLog.create({
      data: {
        jobName: 'generate-daily-report',
        result: 'success',
        details: {
          sportType: sportId,
          results,
        },
        duration,
      },
    })

    return NextResponse.json({
      success: true,
      results,
      duration,
    })
  } catch (error) {
    console.error('Cron generate-daily-report error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'generate-daily-report',
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

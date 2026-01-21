import { NextResponse } from 'next/server'
import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import type { PrismaClient, SportType } from '@prisma/client'
import { format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getDayRangeInTimezone } from '@/lib/timezone'
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
  timezone: string,
  sportTypeEnum: SportType,
  sportLabel: string,
  sportLabelEn: string
): Promise<{ success: boolean; reportId?: string; matchCount: number; message?: string }> {
  const { start: dayStart, end: dayEnd } = getDayRangeInTimezone(dateStr, timezone)

  // 표시용 날짜 (타임존 기준)
  const displayDate = new Date(dateStr + 'T00:00:00')
  const dateKo = format(displayDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
  const dateEn = format(displayDate, 'EEEE, MMMM do, yyyy')

  // 이미 리포트가 있는지 확인
  const existingReport = await prisma.dailyReport.findFirst({
    where: { date: dayStart, sportType: sportTypeEnum },
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

  // 해당 날짜의 경기 조회
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
        include: { seasonStats: true },
      },
      awayTeam: {
        include: { seasonStats: true },
      },
      matchAnalysis: true,
    },
    orderBy: { kickoffAt: 'asc' },
  })

  if (matches.length === 0) {
    // 경기가 없으면 간단한 리포트 생성 (translations만 사용)
    const emptyReportKo = {
      title: `${dateKo} ${sportLabel} 경기 일정`,
      summary: `오늘은 ${sportLabel} 경기가 예정되어 있지 않습니다.`,
      sections: [],
      hotMatches: [],
    }
    const emptyReportEn = {
      title: `${dateEn} ${sportLabelEn} Schedule`,
      summary: `No ${sportLabelEn} matches scheduled for today.`,
      sections: [],
      hotMatches: [],
    }

    await prisma.dailyReport.create({
      data: {
        date: dayStart,
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

  // AI 입력 데이터 구성
  const matchData = matches.map((match) => ({
    id: match.id,
    league: match.league.name,
    leagueCode: match.league.code,
    kickoffAt: format(match.kickoffAt, 'HH:mm'),
    homeTeam: {
      name: match.homeTeam.name,
      rank: match.homeTeam.seasonStats?.rank,
      form: match.homeTeam.seasonStats?.form,
      points: match.homeTeam.seasonStats?.points,
    },
    awayTeam: {
      name: match.awayTeam.name,
      rank: match.awayTeam.seasonStats?.rank,
      form: match.awayTeam.seasonStats?.form,
      points: match.awayTeam.seasonStats?.points,
    },
    hasAnalysis: !!match.matchAnalysis,
    matchday: match.matchday,
  }))

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

  // DB에 저장
  const reportData = {
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    summary: parsed.summary,
    sections: parsed.sections,
    keywords: parsed.keywords,
    hotMatches: parsed.hotMatches || [],
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
        date: dayStart,
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
    const url = new URL(request.url)
    const timezone = url.searchParams.get('timezone') || 'Asia/Seoul'

    // 오늘과 내일 날짜 계산 (타임존 기준)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')

    const results = []

    // 오늘 리포트 확인
    const { start: todayStart } = getDayRangeInTimezone(todayStr, timezone)
    const todayReport = await prisma.dailyReport.findFirst({
      where: { date: todayStart, sportType: sportTypeEnum },
    })

    // 오늘 리포트가 없으면 생성
    if (!todayReport) {
      console.log(`[Cron] Generating today's report (${todayStr})...`)
      const todayResult = await generateReportForDate(
        prisma,
        todayStr,
        timezone,
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
      timezone,
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
          timezone,
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

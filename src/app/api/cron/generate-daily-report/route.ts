import { NextResponse } from 'next/server'
import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import type { PrismaClient, SportType } from '@prisma/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getUTCDayRange } from '@/lib/timezone'
import { getSportFromRequest, sportIdToEnum } from '@/lib/sport'

import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * GET /api/cron/generate-daily-report
 * 매일 새벽에 당일 데일리 리포트 생성
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
    // 날짜 파라미터 확인 (기본값: 오늘 UTC)
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date') // YYYY-MM-DD format

    // UTC 기준으로 날짜 계산
    const { start: todayStart, end: todayEnd, utcDate } = dateParam
      ? getUTCDayRange(dateParam)
      : getUTCDayRange()

    const dateStr = format(utcDate, 'yyyy-MM-dd')
    const dateKo = format(utcDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
    const dateEn = format(utcDate, 'EEEE, MMMM do, yyyy')

    // 이미 오늘 리포트가 있는지 확인 (스포츠 타입별)
    const existingReport = await prisma.dailyReport.findFirst({
      where: { date: todayStart, sportType: sportTypeEnum },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (existingReport && (existingReport as any).translations) {
      return NextResponse.json({
        success: true,
        message: `Daily report already exists with translations for ${sportId}`,
        reportId: existingReport.id,
      })
    }

    // 오늘 경기 조회 (스포츠 타입 필터)
    const todayMatches = await prisma.match.findMany({
      where: {
        sportType: sportTypeEnum,
        kickoffAt: {
          gte: todayStart,
          lte: todayEnd,
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

    if (todayMatches.length === 0) {
      // 경기가 없으면 간단한 리포트 생성
      await prisma.dailyReport.create({
        data: {
          date: todayStart,
          sportType: sportTypeEnum,
          summary: `${dateKo} - 오늘은 ${sportLabel} 경기가 예정되어 있지 않습니다.`,
          hotMatches: [],
          keyNews: [],
          insights: [],
        },
      })

      return NextResponse.json({
        success: true,
        message: `No ${sportId} matches today, created empty report`,
      })
    }

    // AI 입력 데이터 구성
    const matchData = todayMatches.map((match) => ({
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

    console.log('[Cron] Generating English daily report...')
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

    // DB에 저장 (영어를 원본 translations.en에 저장)
    const reportData = {
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      summary: parsed.summary,
      sections: parsed.sections,
      keywords: parsed.keywords,
      hotMatches: parsed.hotMatches || [],
    }

    // 스포츠 타입별로 리포트 저장 (findFirst + create/update 패턴)
    const existingForSport = await prisma.dailyReport.findFirst({
      where: { date: todayStart, sportType: sportTypeEnum },
    })

    let report
    if (existingForSport) {
      report = await prisma.dailyReport.update({
        where: { id: existingForSport.id },
        data: {
          translations: { en: reportData },
          summary: JSON.stringify(reportData),
        },
      })
    } else {
      report = await prisma.dailyReport.create({
        data: {
          date: todayStart,
          sportType: sportTypeEnum,
          translations: { en: reportData },
          summary: JSON.stringify(reportData),
          hotMatches: parsed.hotMatches || [],
          keyNews: [],
          insights: parsed.sections?.find((s: { type: string }) => s.type === 'key_storylines')?.content || null,
        },
      })
    }

    // 즉시 다국어 번역 수행 (KO, ES, JA, AR)
    const { ensureDailyReportTranslations } = await import('@/lib/ai/translate')
    await ensureDailyReportTranslations(report)

    const duration = Date.now() - startTime

    // 캐시 무효화: 리포트가 생성되었을 때
    console.log('[Cron] Revalidating daily report tag...')
    revalidateTag('daily-report')

    await prisma.schedulerLog.create({
      data: {
        jobName: 'generate-daily-report',
        result: 'success',
        details: {
          reportId: report.id,
          matchCount: todayMatches.length,
          date: dateStr,
        },
        duration,
      },
    })

    return NextResponse.json({
      success: true,
      reportId: report.id,
      matchCount: todayMatches.length,
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

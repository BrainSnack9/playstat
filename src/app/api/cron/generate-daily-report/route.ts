import { NextResponse } from 'next/server'
import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import type { PrismaClient } from '@prisma/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

import { revalidateTag } from 'next/cache'

// KST (UTC+9) 오프셋 (밀리초)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 현재 시간을 KST 기준 날짜로 변환하여 시작/끝 시간을 UTC로 반환
 */
function getKSTDayRange(): { start: Date; end: Date; kstDate: Date } {
  const now = new Date()
  // KST 시간 계산
  const kstTime = new Date(now.getTime() + KST_OFFSET_MS)

  // KST 기준 오늘 00:00:00 (UTC 시간으로는 전날 15:00)
  const kstDateStart = new Date(Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 0, 0, 0))
  const utcStart = new Date(kstDateStart.getTime() - KST_OFFSET_MS)

  // KST 기준 오늘 23:59:59 (UTC 시간으로는 오늘 14:59:59)
  const kstDateEnd = new Date(Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 23, 59, 59))
  const utcEnd = new Date(kstDateEnd.getTime() - KST_OFFSET_MS)

  return { start: utcStart, end: utcEnd, kstDate: kstTime }
}

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

  try {
    // 한국 시간(KST) 기준으로 오늘 날짜 계산
    const { start: todayStart, end: todayEnd, kstDate } = getKSTDayRange()

    const dateStr = format(kstDate, 'yyyy-MM-dd')
    const dateKo = format(kstDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
    const dateEn = format(kstDate, 'EEEE, MMMM do, yyyy')

    // 이미 오늘 리포트가 있는지 확인
    const existingReport = await prisma.dailyReport.findUnique({
      where: { date: todayStart },
    })

    if (existingReport && (existingReport as any).translations) {
      return NextResponse.json({
        success: true,
        message: 'Daily report already exists with translations',
        reportId: existingReport.id,
      })
    }

    // 오늘 경기 조회
    const todayMatches = await prisma.match.findMany({
      where: {
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
          sportType: 'FOOTBALL',
          summary: `${dateKo} - 오늘은 주요 리그 경기가 예정되어 있지 않습니다.`,
          hotMatches: [],
          keyNews: [],
          insights: [],
        },
      })

      return NextResponse.json({
        success: true,
        message: 'No matches today, created empty report',
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

    const report = await prisma.dailyReport.upsert({
      where: { date: todayStart },
      update: {
        translations: { en: reportData },
        summary: JSON.stringify(reportData), // 하위 호환성
      },
      create: {
        date: todayStart,
        sportType: 'FOOTBALL',
        translations: { en: reportData },
        summary: JSON.stringify(reportData),
        hotMatches: parsed.hotMatches || [],
        keyNews: [],
        insights: parsed.sections?.find((s: { type: string }) => s.type === 'key_storylines')?.content || null,
      },
    })

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

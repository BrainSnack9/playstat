import { PrismaClient } from '@prisma/client'
import { ensureMatchAnalysisTranslations, ensureDailyReportTranslations } from '../src/lib/ai/translate'

const prisma = new PrismaClient()

async function fillMissingTranslations() {
  console.log('=== 누락된 번역 채우기 시작 ===\n')

  // 1. MatchAnalysis 번역 누락 찾기
  const analyses = await prisma.matchAnalysis.findMany({
    select: {
      id: true,
      matchId: true,
      translations: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  let analysisFixed = 0
  let analysisFailed = 0

  for (const analysis of analyses) {
    const trans = (analysis.translations || {}) as Record<string, unknown>
    const hasKo = trans.ko && typeof trans.ko === 'object' && Object.keys(trans.ko as object).length > 0
    const hasEn = trans.en && typeof trans.en === 'object' && Object.keys(trans.en as object).length > 0

    // EN이 있고 KO가 없는 경우만 번역
    if (hasEn && !hasKo) {
      console.log(`[MatchAnalysis] 번역 중: ${analysis.id.slice(0, 8)}...`)
      try {
        await ensureMatchAnalysisTranslations(analysis)
        analysisFixed++
        console.log(`  ✓ 완료`)
      } catch (error) {
        analysisFailed++
        console.error(`  ✗ 실패:`, error)
      }
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n[MatchAnalysis] 완료: ${analysisFixed}개 번역, ${analysisFailed}개 실패\n`)

  // 2. DailyReport 번역 누락 찾기
  const reports = await prisma.dailyReport.findMany({
    select: {
      id: true,
      date: true,
      sportType: true,
      translations: true,
      createdAt: true,
    },
    orderBy: { date: 'desc' },
  })

  let reportFixed = 0
  let reportFailed = 0

  for (const report of reports) {
    const trans = (report.translations || {}) as Record<string, unknown>
    const hasKo = trans.ko && typeof trans.ko === 'object' && Object.keys(trans.ko as object).length > 0
    const hasEn = trans.en && typeof trans.en === 'object' && Object.keys(trans.en as object).length > 0

    // EN이 있고 KO가 없는 경우
    if (hasEn && !hasKo) {
      const dateStr = report.date.toISOString().split('T')[0]
      console.log(`[DailyReport] 번역 중: ${dateStr} (${report.sportType})`)
      try {
        await ensureDailyReportTranslations(report)
        reportFixed++
        console.log(`  ✓ 완료`)
      } catch (error) {
        reportFailed++
        console.error(`  ✗ 실패:`, error)
      }
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n[DailyReport] 완료: ${reportFixed}개 번역, ${reportFailed}개 실패`)

  // 요약
  console.log('\n=== 요약 ===')
  console.log(`MatchAnalysis: ${analysisFixed}개 번역 완료, ${analysisFailed}개 실패`)
  console.log(`DailyReport: ${reportFixed}개 번역 완료, ${reportFailed}개 실패`)

  await prisma.$disconnect()
}

fillMissingTranslations().catch(console.error)

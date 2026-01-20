import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTranslations() {
  // 1. MatchAnalysis 번역 상태 확인
  const analyses = await prisma.matchAnalysis.findMany({
    select: {
      id: true,
      matchId: true,
      translations: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  console.log('=== MatchAnalysis 번역 상태 ===')
  let missingKo = 0
  let missingEn = 0
  const missingAnalyses: string[] = []

  for (const a of analyses) {
    const trans = (a.translations || {}) as Record<string, unknown>
    const hasKo = trans.ko && typeof trans.ko === 'object' && Object.keys(trans.ko as object).length > 0
    const hasEn = trans.en && typeof trans.en === 'object' && Object.keys(trans.en as object).length > 0

    if (!hasKo || !hasEn) {
      const dateStr = a.createdAt.toISOString().split('T')[0]
      console.log(`ID: ${a.id.slice(0,8)}... | KO: ${hasKo ? '✓' : '✗'} | EN: ${hasEn ? '✓' : '✗'} | Created: ${dateStr}`)
      if (!hasKo) missingKo++
      if (!hasEn) missingEn++
      missingAnalyses.push(a.matchId)
    }
  }

  console.log(`\n총 ${analyses.length}개 중 KO 누락: ${missingKo}, EN 누락: ${missingEn}`)

  // 2. DailyReport 번역 상태 확인
  const reports = await prisma.dailyReport.findMany({
    select: {
      id: true,
      date: true,
      sportType: true,
      translations: true,
      createdAt: true,
    },
    orderBy: { date: 'desc' },
    take: 50
  })

  console.log('\n=== DailyReport 번역 상태 ===')
  let reportMissingKo = 0
  let reportMissingEn = 0
  const missingReports: { date: string; sport: string }[] = []

  for (const r of reports) {
    const trans = (r.translations || {}) as Record<string, unknown>
    const hasKo = trans.ko && typeof trans.ko === 'object' && Object.keys(trans.ko as object).length > 0
    const hasEn = trans.en && typeof trans.en === 'object' && Object.keys(trans.en as object).length > 0

    if (!hasKo || !hasEn) {
      const dateStr = r.date.toISOString().split('T')[0]
      console.log(`Date: ${dateStr} | Sport: ${r.sportType.padEnd(10)} | KO: ${hasKo ? '✓' : '✗'} | EN: ${hasEn ? '✓' : '✗'}`)
      if (!hasKo) reportMissingKo++
      if (!hasEn) reportMissingEn++
      missingReports.push({ date: dateStr, sport: r.sportType })
    }
  }

  console.log(`\n총 ${reports.length}개 중 KO 누락: ${reportMissingKo}, EN 누락: ${reportMissingEn}`)

  // 3. 요약
  console.log('\n=== 요약 ===')
  console.log(`MatchAnalysis: ${missingAnalyses.length}개 번역 필요`)
  console.log(`DailyReport: ${missingReports.length}개 번역 필요`)

  await prisma.$disconnect()
}

checkTranslations().catch(console.error)

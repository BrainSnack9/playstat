import { PrismaClient } from '@prisma/client'
import { format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Basketball Matches Analysis ===\n')

  // 화면에 보이는 경기: KST 09:00~13:00 = UTC 00:00~04:00
  const matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
    },
    include: {
      matchAnalysis: { select: { id: true, createdAt: true } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`Found ${matches.length} basketball matches:\n`)

  matches.forEach((match) => {
    const hasAnalysis = !!match.matchAnalysis
    console.log(`${format(match.kickoffAt, 'yyyy-MM-dd HH:mm')} UTC`)
    console.log(`  ${match.homeTeamName} vs ${match.awayTeamName}`)
    console.log(`  AI Analysis: ${hasAnalysis ? '✅ YES' : '❌ NO'}`)
    if (hasAnalysis && match.matchAnalysis) {
      console.log(`  Created: ${match.matchAnalysis.createdAt.toISOString()}`)
    }
    console.log()
  })

  const withAnalysis = matches.filter(m => m.matchAnalysis).length
  const withoutAnalysis = matches.filter(m => !m.matchAnalysis).length

  console.log(`Summary:`)
  console.log(`  With AI Analysis: ${withAnalysis}`)
  console.log(`  Without AI Analysis: ${withoutAnalysis}`)

  // 최근 분석 생성 로그 확인
  console.log('\n=== Recent Scheduler Logs (analysis) ===')
  const logs = await prisma.schedulerLog.findMany({
    where: { jobName: { contains: 'analysis' } },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  for (const log of logs) {
    console.log(`${log.createdAt.toISOString().slice(0, 19)} | ${log.jobName} | ${log.result}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

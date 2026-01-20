import { PrismaClient } from '@prisma/client'
import { format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Basketball Matches Analysis ===\n')

  // 20일 경기 확인
  const matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: {
        gte: new Date('2026-01-20T00:00:00Z'),
        lt: new Date('2026-01-21T00:00:00Z'),
      },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      matchAnalysis: { select: { id: true } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`Found ${matches.length} basketball matches on 2026-01-20:\n`)

  matches.forEach((match) => {
    const hasAnalysis = !!match.matchAnalysis
    console.log(`${format(match.kickoffAt, 'yyyy-MM-dd HH:mm')} UTC`)
    console.log(`  ${match.homeTeam.name} vs ${match.awayTeam.name}`)
    console.log(`  AI Analysis: ${hasAnalysis ? '✅ YES' : '❌ NO'}`)
    console.log(`  Match ID: ${match.id}`)
    console.log()
  })

  const withAnalysis = matches.filter(m => m.matchAnalysis).length
  const withoutAnalysis = matches.filter(m => !m.matchAnalysis).length

  console.log(`Summary:`)
  console.log(`  With AI Analysis: ${withAnalysis}`)
  console.log(`  Without AI Analysis: ${withoutAnalysis}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

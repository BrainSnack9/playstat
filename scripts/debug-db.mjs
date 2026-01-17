import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const now = new Date()
  const start = new Date(now.setHours(0,0,0,0))
  const end = new Date(now.setHours(23,59,59,999))
  
  const count = await prisma.match.count({
    where: {
      kickoffAt: {
        gte: start,
        lte: end
      }
    }
  })
  
  const allMatches = await prisma.match.findMany({
    take: 5,
    orderBy: { kickoffAt: 'desc' },
    select: { kickoffAt: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } }
  })

  console.log(`\n📊 [DB Check]`)
  console.log(`Current Server Time: ${new Date().toISOString()}`)
  console.log(`Today Range (UTC): ${start.toISOString()} ~ ${end.toISOString()}`)
  console.log(`Matches found for this range: ${count}`)
  console.log(`\nRecent 5 matches in DB:`)
  allMatches.forEach(m => {
    console.log(`- ${m.kickoffAt.toISOString()}: ${m.homeTeam.name} vs ${m.awayTeam.name}`)
  })
}

check().catch(console.error).finally(() => prisma.$disconnect())

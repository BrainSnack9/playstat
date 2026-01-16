import { Link } from '@/i18n/routing'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import { MatchCard } from '@/components/match-card'

// KST (UTC+9) 오프셋 (밀리초)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function getKSTDayRange(): { start: Date; end: Date } {
  const now = new Date()
  const kstTime = new Date(now.getTime() + KST_OFFSET_MS)

  const kstDateStart = new Date(
    Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 0, 0, 0)
  )
  const utcStart = new Date(kstDateStart.getTime() - KST_OFFSET_MS)

  const kstDateEnd = new Date(
    Date.UTC(kstTime.getUTCFullYear(), kstTime.getUTCMonth(), kstTime.getUTCDate(), 23, 59, 59)
  )
  const utcEnd = new Date(kstDateEnd.getTime() - KST_OFFSET_MS)

  return { start: utcStart, end: utcEnd }
}

async function getTodayMatches() {
  const { start, end } = getKSTDayRange()

  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      homeTeam: {
        select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
      },
      awayTeam: {
        select: { id: true, name: true, shortName: true, tla: true, logoUrl: true },
      },
      league: {
        select: { name: true, code: true, logoUrl: true },
      },
      matchAnalysis: {
        select: { id: true },
      },
    },
    orderBy: { kickoffAt: 'asc' },
    take: 6,
  })

  return matches
}

interface TodayMatchesProps {
  locale: string
}

export async function TodayMatches({ locale }: TodayMatchesProps) {
  const matches = await getTodayMatches()
  const home = await getTranslations('home')

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{home('no_matches_today')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match as any} locale={locale} />
      ))}
    </div>
  )
}

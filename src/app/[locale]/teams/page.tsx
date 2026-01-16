import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Trophy } from 'lucide-react'
import { Link } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '팀 목록',
    description: '축구 팀 목록과 분석',
  }
}

// Demo teams data (Football only)
const teams = [
  { id: '1', name: 'Arsenal', shortName: 'ARS', league: 'Premier League', country: 'England' },
  { id: '2', name: 'Chelsea', shortName: 'CHE', league: 'Premier League', country: 'England' },
  { id: '3', name: 'Liverpool', shortName: 'LIV', league: 'Premier League', country: 'England' },
  { id: '4', name: 'Manchester City', shortName: 'MCI', league: 'Premier League', country: 'England' },
  { id: '5', name: 'Manchester United', shortName: 'MUN', league: 'Premier League', country: 'England' },
  { id: '6', name: 'Tottenham', shortName: 'TOT', league: 'Premier League', country: 'England' },
  { id: '7', name: 'Real Madrid', shortName: 'RMA', league: 'La Liga', country: 'Spain' },
  { id: '8', name: 'Barcelona', shortName: 'BAR', league: 'La Liga', country: 'Spain' },
  { id: '9', name: 'Atletico Madrid', shortName: 'ATM', league: 'La Liga', country: 'Spain' },
  { id: '10', name: 'Bayern Munich', shortName: 'BAY', league: 'Bundesliga', country: 'Germany' },
  { id: '11', name: 'Borussia Dortmund', shortName: 'BVB', league: 'Bundesliga', country: 'Germany' },
  { id: '12', name: 'Inter Milan', shortName: 'INT', league: 'Serie A', country: 'Italy' },
  { id: '13', name: 'AC Milan', shortName: 'ACM', league: 'Serie A', country: 'Italy' },
  { id: '14', name: 'Juventus', shortName: 'JUV', league: 'Serie A', country: 'Italy' },
  { id: '15', name: 'Paris Saint-Germain', shortName: 'PSG', league: 'Ligue 1', country: 'France' },
]

function TeamCard({ team }: { team: (typeof teams)[0] }) {
  return (
    <Link href={`/team/${team.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center p-4">
          <div className="mr-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <span className="text-lg font-bold text-primary">{team.shortName}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{team.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-3 w-3" />
              {team.league}
            </div>
          </div>
          <Badge variant="outline">{team.country}</Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function TeamsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Users className="mr-3 h-8 w-8" />
          팀 목록
        </h1>
        <p className="text-muted-foreground">
          전 세계 주요 축구 팀들의 분석과 정보를 확인하세요
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  )
}

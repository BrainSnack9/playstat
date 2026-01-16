import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Trophy } from 'lucide-react'
import { Link } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '팀 목록',
    description: '축구, NBA, MLB 팀 목록과 분석',
  }
}

// Demo teams data
const teams = {
  football: [
    { id: '1', name: 'Arsenal', shortName: 'ARS', league: 'Premier League', country: 'England' },
    { id: '2', name: 'Chelsea', shortName: 'CHE', league: 'Premier League', country: 'England' },
    { id: '3', name: 'Liverpool', shortName: 'LIV', league: 'Premier League', country: 'England' },
    { id: '4', name: 'Manchester City', shortName: 'MCI', league: 'Premier League', country: 'England' },
    { id: '5', name: 'Real Madrid', shortName: 'RMA', league: 'La Liga', country: 'Spain' },
    { id: '6', name: 'Barcelona', shortName: 'BAR', league: 'La Liga', country: 'Spain' },
    { id: '7', name: 'Tottenham', shortName: 'TOT', league: 'Premier League', country: 'England' },
    { id: '8', name: 'Bayern Munich', shortName: 'BAY', league: 'Bundesliga', country: 'Germany' },
  ],
  basketball: [
    { id: '101', name: 'LA Lakers', shortName: 'LAL', league: 'NBA', country: 'USA' },
    { id: '102', name: 'Boston Celtics', shortName: 'BOS', league: 'NBA', country: 'USA' },
    { id: '103', name: 'Golden State Warriors', shortName: 'GSW', league: 'NBA', country: 'USA' },
    { id: '104', name: 'Miami Heat', shortName: 'MIA', league: 'NBA', country: 'USA' },
  ],
  baseball: [
    { id: '201', name: 'LA Dodgers', shortName: 'LAD', league: 'MLB', country: 'USA' },
    { id: '202', name: 'NY Yankees', shortName: 'NYY', league: 'MLB', country: 'USA' },
    { id: '203', name: 'Boston Red Sox', shortName: 'BOS', league: 'MLB', country: 'USA' },
    { id: '204', name: 'Chicago Cubs', shortName: 'CHC', league: 'MLB', country: 'USA' },
  ],
}

function TeamCard({ team }: { team: (typeof teams.football)[0] }) {
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
          전 세계 주요 팀들의 분석과 정보를 확인하세요
        </p>
      </div>

      <Tabs defaultValue="football" className="space-y-6">
        <TabsList>
          <TabsTrigger value="football">축구 ({teams.football.length})</TabsTrigger>
          <TabsTrigger value="basketball">농구 ({teams.basketball.length})</TabsTrigger>
          <TabsTrigger value="baseball">야구 ({teams.baseball.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="football">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.football.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="basketball">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.basketball.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="baseball">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.baseball.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

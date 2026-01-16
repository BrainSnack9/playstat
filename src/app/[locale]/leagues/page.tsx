import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Globe } from 'lucide-react'
import { Link } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return {
    title: t('leagues'),
    description: 'Browse football, NBA, and MLB leagues with AI-powered analysis',
  }
}

const leagues = {
  football: [
    { name: 'Premier League', slug: 'epl', country: 'England', teams: 20 },
    { name: 'La Liga', slug: 'laliga', country: 'Spain', teams: 20 },
    { name: 'Serie A', slug: 'serie-a', country: 'Italy', teams: 20 },
    { name: 'Bundesliga', slug: 'bundesliga', country: 'Germany', teams: 18 },
    { name: 'Ligue 1', slug: 'ligue-1', country: 'France', teams: 18 },
    { name: 'Champions League', slug: 'ucl', country: 'Europe', teams: 32 },
    { name: 'Europa League', slug: 'uel', country: 'Europe', teams: 32 },
    { name: 'K League 1', slug: 'k-league', country: 'Korea', teams: 12 },
  ],
  basketball: [
    { name: 'NBA', slug: 'nba', country: 'USA', teams: 30 },
    { name: 'KBL', slug: 'kbl', country: 'Korea', teams: 10 },
  ],
  baseball: [
    { name: 'MLB', slug: 'mlb', country: 'USA', teams: 30 },
    { name: 'KBO', slug: 'kbo', country: 'Korea', teams: 10 },
    { name: 'NPB', slug: 'npb', country: 'Japan', teams: 12 },
  ],
}

function LeagueCard({ league }: { league: typeof leagues.football[0] }) {
  return (
    <Link href={`/league/${league.slug}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center p-4">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{league.name}</h3>
            <div className="flex items-center text-sm text-muted-foreground">
              <Globe className="mr-1 h-3 w-3" />
              {league.country}
            </div>
          </div>
          <Badge variant="outline">{league.teams} teams</Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function LeaguesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">리그</h1>
        <p className="text-muted-foreground">
          전 세계 주요 리그의 경기와 분석을 확인하세요
        </p>
      </div>

      <Tabs defaultValue="football" className="space-y-6">
        <TabsList>
          <TabsTrigger value="football">축구</TabsTrigger>
          <TabsTrigger value="basketball">농구</TabsTrigger>
          <TabsTrigger value="baseball">야구</TabsTrigger>
        </TabsList>

        <TabsContent value="football">
          <div className="grid gap-4 md:grid-cols-2">
            {leagues.football.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="basketball">
          <div className="grid gap-4 md:grid-cols-2">
            {leagues.basketball.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="baseball">
          <div className="grid gap-4 md:grid-cols-2">
            {leagues.baseball.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

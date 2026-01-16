import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Trophy,
  Calendar,
  Users,
  MapPin,
  TrendingUp,
  TrendingDown,
  Building,
  Clock
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

// Demo team data
const teamData: Record<string, {
  id: string
  name: string
  shortName: string
  league: { name: string; slug: string }
  founded: number
  venue: string
  city: string
  country: string
  recentForm: string
  players: Array<{ id: string; name: string; position: string; number: number; nationality: string }>
  fixtures: Array<{ id: string; opponent: string; isHome: boolean; kickoffAt: string; status: string; score?: string; slug: string }>
  analysis: {
    overview: string
    tactics: string
    strengths: string[]
    weaknesses: string[]
  }
}> = {
  '1': {
    id: '1',
    name: 'Arsenal',
    shortName: 'ARS',
    league: { name: 'Premier League', slug: 'epl' },
    founded: 1886,
    venue: 'Emirates Stadium',
    city: 'London',
    country: 'England',
    recentForm: 'WWWDW',
    players: [
      { id: '101', name: 'Bukayo Saka', position: 'RW', number: 7, nationality: 'England' },
      { id: '102', name: 'Martin Odegaard', position: 'CAM', number: 8, nationality: 'Norway' },
      { id: '103', name: 'Gabriel Jesus', position: 'ST', number: 9, nationality: 'Brazil' },
      { id: '104', name: 'William Saliba', position: 'CB', number: 12, nationality: 'France' },
      { id: '105', name: 'Declan Rice', position: 'CDM', number: 41, nationality: 'England' },
    ],
    fixtures: [
      { id: '1', opponent: 'Chelsea', isHome: true, kickoffAt: new Date().toISOString(), status: 'SCHEDULED', slug: 'arsenal-vs-chelsea' },
      { id: '2', opponent: 'Liverpool', isHome: false, kickoffAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'SCHEDULED', slug: 'liverpool-vs-arsenal' },
    ],
    analysis: {
      overview: `아스널은 미켈 아르테타 감독 하에서 프리미어리그 우승 경쟁팀으로 부상했습니다. 젊고 재능 있는 선수들과 체계적인 팀 전술로 공격과 수비 양면에서 뛰어난 모습을 보여주고 있습니다.`,
      tactics: `아스널은 주로 4-3-3 포메이션을 사용하며, 높은 프레싱과 빠른 전환 플레이가 특징입니다. 양쪽 윙어의 활발한 활동과 풀백의 오버래핑이 공격의 핵심이며, 중앙에서는 탄탄한 빌드업을 통해 경기를 지배합니다.`,
      strengths: [
        '탄탄한 수비 조직력',
        '젊고 재능 있는 선수단',
        '홈 경기 강력한 성적',
        '세트피스 득점력',
      ],
      weaknesses: [
        '주축 선수 부상 시 대체 인력 부족',
        '원정 경기에서의 불안정성',
      ],
    },
  },
  '2': {
    id: '2',
    name: 'Chelsea',
    shortName: 'CHE',
    league: { name: 'Premier League', slug: 'epl' },
    founded: 1905,
    venue: 'Stamford Bridge',
    city: 'London',
    country: 'England',
    recentForm: 'WDWLW',
    players: [
      { id: '201', name: 'Cole Palmer', position: 'CAM', number: 20, nationality: 'England' },
      { id: '202', name: 'Enzo Fernandez', position: 'CM', number: 8, nationality: 'Argentina' },
      { id: '203', name: 'Nicolas Jackson', position: 'ST', number: 15, nationality: 'Senegal' },
    ],
    fixtures: [
      { id: '1', opponent: 'Arsenal', isHome: false, kickoffAt: new Date().toISOString(), status: 'SCHEDULED', slug: 'arsenal-vs-chelsea' },
    ],
    analysis: {
      overview: `첼시는 재건기를 거치며 젊은 선수들을 중심으로 팀을 구성하고 있습니다.`,
      tactics: `점유율 기반의 축구를 구사하며, 패스 플레이를 통한 공격 전개가 특징입니다.`,
      strengths: ['젊은 선수단의 성장 가능성', '풍부한 자원'],
      weaknesses: ['경험 부족', '수비 불안정'],
    },
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const team = teamData[id]

  if (!team) {
    return { title: 'Team Not Found' }
  }

  return {
    title: `${team.name} - ${team.league.name}`,
    description: `${team.name} team analysis, squad, fixtures and statistics`,
  }
}

function FormBadge({ form }: { form: string }) {
  return (
    <div className="flex gap-1">
      {form.split('').map((result, i) => (
        <span
          key={i}
          className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${
            result === 'W' ? 'bg-green-500' :
            result === 'D' ? 'bg-gray-400' :
            'bg-red-500'
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  )
}

export default async function TeamPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const team = teamData[id]

  if (!team) {
    notFound()
  }

  return (
    <div className="container py-8">
      {/* Team Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <span className="text-3xl font-bold">{team.shortName}</span>
            </div>

            <div className="flex-1 text-center md:text-left">
              <Link href={`/league/${team.league.slug}`} className="text-sm text-muted-foreground hover:text-primary">
                <Trophy className="mr-1 inline h-4 w-4" />
                {team.league.name}
              </Link>
              <h1 className="text-3xl font-bold">{team.name}</h1>

              <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                <div className="flex items-center">
                  <Building className="mr-1 h-4 w-4" />
                  {team.founded}년 창단
                </div>
                <div className="flex items-center">
                  <MapPin className="mr-1 h-4 w-4" />
                  {team.venue}
                </div>
                <div className="flex items-center">
                  <MapPin className="mr-1 h-4 w-4" />
                  {team.city}, {team.country}
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="mb-2 text-sm text-muted-foreground">최근 폼</p>
              <FormBadge form={team.recentForm} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="squad">스쿼드</TabsTrigger>
          <TabsTrigger value="fixtures">경기 일정</TabsTrigger>
          <TabsTrigger value="analysis">분석</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>팀 개요</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{team.analysis.overview}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Squad */}
        <TabsContent value="squad">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                선수단
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {team.players.map((player) => (
                  <Link key={player.id} href={`/player/${player.id}`}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="flex items-center p-4">
                        <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-lg font-bold text-primary">{player.number}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{player.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{player.position}</Badge>
                            <span>{player.nationality}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                경기 일정
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {team.fixtures.map((fixture) => (
                  <Link key={fixture.id} href={`/match/${fixture.slug}`}>
                    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted">
                      <div className="flex items-center gap-4">
                        <Badge variant={fixture.isHome ? 'default' : 'outline'}>
                          {fixture.isHome ? '홈' : '원정'}
                        </Badge>
                        <span className="font-medium">
                          {fixture.isHome ? `${team.name} vs ${fixture.opponent}` : `${fixture.opponent} vs ${team.name}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="mr-1 h-4 w-4" />
                          {format(new Date(fixture.kickoffAt), 'MM/dd HH:mm')}
                        </div>
                        <Badge className={fixture.status === 'SCHEDULED' ? 'bg-blue-500' : 'bg-gray-500'}>
                          {fixture.status === 'SCHEDULED' ? '예정' : '종료'}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>전술 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{team.analysis.tactics}</p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                  강점
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {team.analysis.strengths.map((strength, i) => (
                    <li key={i} className="flex items-center">
                      <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingDown className="mr-2 h-5 w-5 text-red-500" />
                  약점
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {team.analysis.weaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-center">
                      <span className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

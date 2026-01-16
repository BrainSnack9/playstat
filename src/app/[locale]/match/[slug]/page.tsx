import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChartBar
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'

// Demo match data
const matchData: Record<string, {
  id: string
  homeTeam: { id: string; name: string; shortName: string; recentForm: string }
  awayTeam: { id: string; name: string; shortName: string; recentForm: string }
  league: { name: string; slug: string }
  kickoffAt: string
  status: MatchStatus
  venue: string
  round: string
  homeScore?: number
  awayScore?: number
  analysis: {
    summary: string
    tactics: string
    keyPoints: string[]
    riskFactors: string[]
    positiveFactors: string[]
    expectedFlow: string
  }
  headToHead: Array<{ result: string; date: string }>
}> = {
  'arsenal-vs-chelsea': {
    id: '1',
    homeTeam: {
      id: '1',
      name: 'Arsenal',
      shortName: 'ARS',
      recentForm: 'WWWDW',
    },
    awayTeam: {
      id: '2',
      name: 'Chelsea',
      shortName: 'CHE',
      recentForm: 'WDWLW',
    },
    league: { name: 'Premier League', slug: 'epl' },
    kickoffAt: new Date(new Date().setHours(20, 0)).toISOString(),
    status: 'SCHEDULED',
    venue: 'Emirates Stadium',
    round: 'Round 20',
    analysis: {
      summary: `아스널과 첼시의 런던 더비는 항상 긴장감 넘치는 경기입니다.
아스널은 홈에서 강력한 모습을 보여주고 있으며, 최근 5경기 중 4승을 기록했습니다.
첼시는 원정에서 다소 불안한 모습을 보이고 있지만, 최근 폼이 살아나고 있습니다.`,
      tactics: `아스널은 아르테타 감독 하에 높은 압박과 빠른 전환 플레이를 기반으로 합니다.
첼시는 포체티노 감독의 지휘 아래 점유율 기반의 축구를 구사하며, 윙어 활용이 핵심입니다.
두 팀 모두 4-3-3 포메이션을 선호하며, 중원 싸움이 승패를 가를 것으로 예상됩니다.`,
      keyPoints: [
        '아스널의 홈 경기 연승 행진 지속 여부',
        '첼시 공격진의 골 결정력',
        '중원에서의 볼 지배권 경쟁',
      ],
      riskFactors: [
        '아스널 주축 선수의 체력 부담',
        '첼시의 수비 불안정성',
      ],
      positiveFactors: [
        '아스널의 탄탄한 홈 경기력',
        '첼시의 상승세와 젊은 선수들의 활약',
      ],
      expectedFlow: `경기 초반에는 아스널이 홈의 이점을 살려 적극적인 공세를 펼칠 것으로 보입니다. 첼시는 단단한 수비 조직력으로 아스널의 공격을 막으면서 역습 기회를 노릴 것입니다. 후반으로 갈수록 체력 소모가 커지면서 교체 선수들의 역할이 중요해질 것이며, 세트피스 상황이 결정적인 기회가 될 수 있습니다.`,
    },
    headToHead: [
      { result: 'Arsenal 2 - 0 Chelsea', date: '2024-10-15' },
      { result: 'Chelsea 1 - 1 Arsenal', date: '2024-04-20' },
      { result: 'Arsenal 3 - 1 Chelsea', date: '2023-10-28' },
    ],
  },
  'liverpool-vs-manchester-city': {
    id: '2',
    homeTeam: {
      id: '3',
      name: 'Liverpool',
      shortName: 'LIV',
      recentForm: 'WWWWW',
    },
    awayTeam: {
      id: '4',
      name: 'Manchester City',
      shortName: 'MCI',
      recentForm: 'WDWWW',
    },
    league: { name: 'Premier League', slug: 'epl' },
    kickoffAt: new Date(new Date().setHours(17, 30)).toISOString(),
    status: 'LIVE',
    homeScore: 2,
    awayScore: 1,
    venue: 'Anfield',
    round: 'Round 20',
    analysis: {
      summary: `프리미어리그 최고의 빅매치입니다.
리버풀은 안필드에서 무패 행진을 이어가고 있습니다.
맨시티는 최근 몇 시즌 동안 안정적인 성적을 유지하고 있습니다.`,
      tactics: `리버풀은 높은 프레싱과 빠른 역습을 기반으로 합니다.
맨시티는 점유율 축구와 정교한 패스 플레이가 특징입니다.`,
      keyPoints: [
        '중원 지배력 경쟁',
        '수비 라인의 안정성',
        '세트피스 활용',
      ],
      riskFactors: [
        '부상 선수 복귀 여부',
        '레드카드 리스크',
      ],
      positiveFactors: [
        '양 팀 모두 최상의 컨디션',
        '팬들의 열정적인 응원',
      ],
      expectedFlow: `치열한 중원 싸움이 예상되며, 두 팀 모두 수비적으로 신중하게 접근할 것입니다.`,
    },
    headToHead: [],
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const match = matchData[slug as keyof typeof matchData]

  if (!match) {
    return { title: 'Match Not Found' }
  }

  return {
    title: `${match.homeTeam.name} vs ${match.awayTeam.name} - ${match.league.name}`,
    description: `AI analysis for ${match.homeTeam.name} vs ${match.awayTeam.name} match in ${match.league.name}`,
    openGraph: {
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      description: match.analysis.summary.split('\n')[0],
    },
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

export default async function MatchPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const match = matchData[slug as keyof typeof matchData]

  if (!match) {
    notFound()
  }

  const kickoffDate = format(new Date(match.kickoffAt), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })
  const kickoffTime = format(new Date(match.kickoffAt), 'HH:mm')

  return (
    <div className="container py-8">
      {/* Match Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <Link href={`/league/${match.league.slug}`} className="text-sm text-muted-foreground hover:text-primary">
              <Trophy className="mr-1 inline h-4 w-4" />
              {match.league.name}
            </Link>
            <Badge className={match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}>
              {match.status === 'LIVE' ? '진행중' : match.status === 'FINISHED' ? '종료' : '예정'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            {/* Home Team */}
            <div className="flex flex-1 flex-col items-center">
              <Link href={`/team/${match.homeTeam.id}`} className="flex flex-col items-center hover:opacity-80">
                <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <span className="text-xl font-bold">{match.homeTeam.shortName}</span>
                </div>
                <h2 className="text-xl font-bold">{match.homeTeam.name}</h2>
              </Link>
              <FormBadge form={match.homeTeam.recentForm} />
            </div>

            {/* Score / Time */}
            <div className="flex flex-col items-center px-8">
              {match.status === 'SCHEDULED' ? (
                <>
                  <span className="text-4xl font-bold">VS</span>
                  <div className="mt-2 flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-1 h-4 w-4" />
                    {kickoffTime}
                  </div>
                </>
              ) : (
                <span className="text-5xl font-bold">
                  {match.homeScore} - {match.awayScore}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-1 flex-col items-center">
              <Link href={`/team/${match.awayTeam.id}`} className="flex flex-col items-center hover:opacity-80">
                <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <span className="text-xl font-bold">{match.awayTeam.shortName}</span>
                </div>
                <h2 className="text-xl font-bold">{match.awayTeam.name}</h2>
              </Link>
              <FormBadge form={match.awayTeam.recentForm} />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="mr-1 h-4 w-4" />
              {kickoffDate}
            </div>
            <div className="flex items-center">
              <MapPin className="mr-1 h-4 w-4" />
              {match.venue}
            </div>
            <div className="flex items-center">
              <Trophy className="mr-1 h-4 w-4" />
              {match.round}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Tabs */}
      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analysis">AI 분석</TabsTrigger>
          <TabsTrigger value="tactics">전술 분석</TabsTrigger>
          <TabsTrigger value="h2h">상대 전적</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        {/* AI Analysis */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ChartBar className="mr-2 h-5 w-5" />
                경기 분석 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground">{match.analysis.summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                  핵심 포인트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {match.analysis.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start">
                      <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                    위험 변수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {match.analysis.riskFactors.map((factor, i) => (
                      <li key={i} className="flex items-center text-sm">
                        <span className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                    긍정적 요소
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {match.analysis.positiveFactors.map((factor, i) => (
                      <li key={i} className="flex items-center text-sm">
                        <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>예상 경기 흐름</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{match.analysis.expectedFlow}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tactics */}
        <TabsContent value="tactics">
          <Card>
            <CardHeader>
              <CardTitle>전술 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground">{match.analysis.tactics}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Head to Head */}
        <TabsContent value="h2h">
          <Card>
            <CardHeader>
              <CardTitle>상대 전적</CardTitle>
            </CardHeader>
            <CardContent>
              {match.headToHead.length > 0 ? (
                <div className="space-y-2">
                  {match.headToHead.map((record, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted p-3">
                      <span className="font-medium">{record.result}</span>
                      <span className="text-sm text-muted-foreground">{record.date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">상대 전적 데이터가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>경기 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">경기 시작 후 통계가 업데이트됩니다.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

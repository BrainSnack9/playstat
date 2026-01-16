import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '축구 뉴스',
    description: 'AI가 요약한 최신 축구 뉴스',
  }
}

// Demo news data (Football only)
const demoNews = [
  {
    id: '1',
    title: '손흥민, 시즌 10호골 기록하며 토트넘 승리 이끌어',
    summary:
      '손흥민이 웨스트햄과의 경기에서 멀티골을 기록하며 토트넘의 3-1 승리를 이끌었다. 이번 골로 손흥민은 리그 10호골을 달성했으며, 팀 내 득점 1위 자리를 유지하고 있다.',
    source: 'Sports News',
    relatedTeams: ['Tottenham'],
    publishedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: '맨시티, 부상 여파로 UCL 출전 불투명',
    summary:
      '맨체스터 시티의 주축 선수들이 잇따라 부상을 당하면서 다가오는 챔피언스리그 경기 출전이 불투명해졌다. 과르디올라 감독은 선수 관리에 신중을 기할 것이라고 밝혔다.',
    source: 'Football Daily',
    relatedTeams: ['Manchester City'],
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    title: '레알 마드리드, 엘클라시코 앞두고 전력 보강 완료',
    summary:
      '레알 마드리드가 바르셀로나와의 엘클라시코를 앞두고 부상 선수들의 복귀와 함께 전력 보강을 완료했다. 안첼로티 감독은 최상의 컨디션으로 경기에 임할 것이라고 밝혔다.',
    source: 'La Liga News',
    relatedTeams: ['Real Madrid', 'Barcelona'],
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '4',
    title: '프리미어리그 득점왕 경쟁 치열, 홀란드 vs 살라',
    summary:
      '프리미어리그 득점왕 경쟁이 뜨겁다. 맨시티의 홀란드와 리버풀의 살라가 치열한 경쟁을 펼치고 있으며, 두 선수 모두 12골로 공동 선두를 달리고 있다.',
    source: 'Premier League',
    relatedTeams: ['Manchester City', 'Liverpool'],
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: '5',
    title: '분데스리가, 바이에른과 도르트문트의 더비 예고',
    summary:
      '분데스리가 더비인 바이에른 뮌헨과 보루시아 도르트문트의 경기가 다가오면서 양 팀 모두 최고의 컨디션을 끌어올리고 있다.',
    source: 'Bundesliga Weekly',
    relatedTeams: ['Bayern Munich', 'Borussia Dortmund'],
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: '6',
    title: 'K리그, 전북 현대 vs 울산 현대 빅매치 예고',
    summary:
      'K리그1의 빅매치인 전북 현대와 울산 현대의 경기가 이번 주말 펼쳐진다. 양 팀 모두 우승 경쟁에서 뒤처지지 않기 위해 총력전을 예고했다.',
    source: 'K League',
    relatedTeams: ['전북 현대', '울산 현대'],
    publishedAt: new Date(Date.now() - 18000000).toISOString(),
  },
]

function NewsCard({ news }: { news: (typeof demoNews)[0] }) {
  const publishedDate = format(new Date(news.publishedAt), 'MM월 dd일 HH:mm', {
    locale: ko,
  })

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <Badge className="bg-green-500 text-white">축구</Badge>
          <span className="text-xs text-muted-foreground">{publishedDate}</span>
        </div>

        <h3 className="mb-2 text-lg font-semibold line-clamp-2">{news.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
          {news.summary}
        </p>

        {news.relatedTeams && news.relatedTeams.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {news.relatedTeams.map((team) => (
              <Badge key={team} variant="outline" className="text-xs">
                {team}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{news.source}</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function NewsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Newspaper className="mr-3 h-8 w-8" />
          축구 뉴스
        </h1>
        <p className="text-muted-foreground">
          AI가 요약한 최신 축구 뉴스를 확인하세요
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demoNews.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>
    </div>
  )
}

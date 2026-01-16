import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Newspaper, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '스포츠 뉴스',
    description: 'AI가 요약한 최신 축구, NBA, MLB 뉴스',
  }
}

// Demo news data
const demoNews = [
  {
    id: '1',
    title: '손흥민, 시즌 10호골 기록하며 토트넘 승리 이끌어',
    summary:
      '손흥민이 웨스트햄과의 경기에서 멀티골을 기록하며 토트넘의 3-1 승리를 이끌었다. 이번 골로 손흥민은 리그 10호골을 달성했으며, 팀 내 득점 1위 자리를 유지하고 있다.',
    sportType: 'FOOTBALL',
    source: 'Sports News',
    relatedTeams: ['Tottenham'],
    publishedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: '맨시티, 부상 여파로 UCL 출전 불투명',
    summary:
      '맨체스터 시티의 주축 선수들이 잇따라 부상을 당하면서 다가오는 챔피언스리그 경기 출전이 불투명해졌다. 과르디올라 감독은 선수 관리에 신중을 기할 것이라고 밝혔다.',
    sportType: 'FOOTBALL',
    source: 'Football Daily',
    relatedTeams: ['Manchester City'],
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    title: 'LA 레이커스, 르브론 트리플더블로 셀틱스 격파',
    summary:
      'LA 레이커스의 르브론 제임스가 트리플더블을 기록하며 보스턴 셀틱스를 상대로 112-108 승리를 거뒀다.',
    sportType: 'BASKETBALL',
    source: 'NBA News',
    relatedTeams: ['LA Lakers', 'Boston Celtics'],
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '4',
    title: 'LA 다저스, 오타니 선발 등판으로 양키스 격파',
    summary:
      '오타니 쇼헤이가 7이닝 1실점 호투를 펼치며 LA 다저스의 뉴욕 양키스 원정 승리에 기여했다.',
    sportType: 'BASEBALL',
    source: 'MLB Today',
    relatedTeams: ['LA Dodgers', 'NY Yankees'],
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
  },
]

function NewsCard({ news }: { news: (typeof demoNews)[0] }) {
  const publishedDate = format(new Date(news.publishedAt), 'MM월 dd일 HH:mm', {
    locale: ko,
  })

  const sportBadgeClass = {
    FOOTBALL: 'bg-green-500',
    BASKETBALL: 'bg-orange-500',
    BASEBALL: 'bg-blue-500',
  }[news.sportType]

  const sportLabel = {
    FOOTBALL: '축구',
    BASKETBALL: '농구',
    BASEBALL: '야구',
  }[news.sportType]

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <Badge className={`${sportBadgeClass} text-white`}>{sportLabel}</Badge>
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

  const allNews = demoNews
  const footballNews = demoNews.filter((n) => n.sportType === 'FOOTBALL')
  const basketballNews = demoNews.filter((n) => n.sportType === 'BASKETBALL')
  const baseballNews = demoNews.filter((n) => n.sportType === 'BASEBALL')

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Newspaper className="mr-3 h-8 w-8" />
          스포츠 뉴스
        </h1>
        <p className="text-muted-foreground">
          AI가 요약한 최신 스포츠 뉴스를 확인하세요
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">전체 ({allNews.length})</TabsTrigger>
          <TabsTrigger value="football">축구 ({footballNews.length})</TabsTrigger>
          <TabsTrigger value="basketball">농구 ({basketballNews.length})</TabsTrigger>
          <TabsTrigger value="baseball">야구 ({baseballNews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="football">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {footballNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="basketball">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {basketballNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="baseball">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {baseballNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

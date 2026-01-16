import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Link } from '@/i18n/routing'
import {
  ChartBar,
  Calendar,
  Trophy,
  Newspaper,
  TrendingUp,
  Lightbulb,
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const today = format(new Date(), 'yyyy년 MM월 dd일', { locale: ko })
  return {
    title: `데일리 리포트 - ${today}`,
    description: '오늘의 스포츠 하이라이트와 AI 분석',
  }
}

// Demo daily report data
const demoReport = {
  date: new Date().toISOString(),
  summary: `오늘은 프리미어리그와 라리가에서 흥미로운 경기들이 예정되어 있습니다.
특히 아스널 vs 첼시 런던 더비와 바르셀로나 vs 레알 마드리드 엘 클라시코가 팬들의 관심을 집중시키고 있습니다.
NBA에서는 레이커스와 셀틱스의 빅매치가 예정되어 있습니다.`,
  hotMatches: [
    {
      id: '1',
      title: '아스널 vs 첼시',
      description: '런던 더비. 아스널 홈에서 치열한 경쟁 예상',
      league: 'Premier League',
      time: '20:00',
      slug: 'arsenal-vs-chelsea',
    },
    {
      id: '2',
      title: '바르셀로나 vs 레알 마드리드',
      description: '엘 클라시코. 라리가 우승 경쟁의 향방을 가를 경기',
      league: 'La Liga',
      time: '22:00',
      slug: 'barcelona-vs-real-madrid',
    },
    {
      id: '3',
      title: 'LA 레이커스 vs 보스턴 셀틱스',
      description: 'NBA 클래식 라이벌전',
      league: 'NBA',
      time: '11:00',
      slug: 'lakers-vs-celtics',
    },
  ],
  keyNews: [
    {
      title: '손흥민, 토트넘 주장 완장 차고 첫 시즌',
      summary: '손흥민이 주장으로서 리더십을 발휘하며 팀을 이끌고 있다.',
    },
    {
      title: '맨시티, 홀란드 부상 복귀 임박',
      summary: '엘링 홀란드가 부상에서 회복되어 이번 주말 경기 출전이 유력하다.',
    },
    {
      title: 'NBA 트레이드 마감 임박, 빅딜 예고',
      summary: '트레이드 데드라인이 다가오면서 여러 팀들의 움직임이 활발하다.',
    },
  ],
  insights: [
    '프리미어리그 상위권 경쟁이 더욱 치열해지고 있으며, 4~5위 팀들의 UCL 진출 경쟁이 주목됩니다.',
    'NBA 플레이오프 시드 싸움이 본격화되면서 경기 강도가 높아지고 있습니다.',
    '이번 주는 유럽 주요 리그의 빅매치가 많아 팬들에게 황금 주말이 될 것입니다.',
  ],
}

export default async function DailyReportPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const reportDate = format(new Date(demoReport.date), 'yyyy년 MM월 dd일 (EEEE)', {
    locale: ko,
  })

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <ChartBar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">데일리 리포트</h1>
            <p className="flex items-center text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              {reportDate}
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>오늘의 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-muted-foreground">
            {demoReport.summary}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Hot Matches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="mr-2 h-5 w-5 text-primary" />
                주목 경기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoReport.hotMatches.map((match, index) => (
                <div key={match.id}>
                  <Link href={`/match/${match.slug}`}>
                    <div className="rounded-lg border p-4 transition-colors hover:bg-muted">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold">{match.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{match.league}</Badge>
                          <Badge>{match.time}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {match.description}
                      </p>
                    </div>
                  </Link>
                  {index < demoReport.hotMatches.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Key News */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Newspaper className="mr-2 h-5 w-5 text-primary" />
                핵심 뉴스
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoReport.keyNews.map((news, index) => (
                <div key={index}>
                  <h4 className="mb-1 font-medium">{news.title}</h4>
                  <p className="text-sm text-muted-foreground">{news.summary}</p>
                  {index < demoReport.keyNews.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
                오늘의 인사이트
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {demoReport.insights.map((insight, index) => (
                  <li key={index} className="flex items-start">
                    <TrendingUp className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

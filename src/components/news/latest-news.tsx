'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Newspaper, ExternalLink } from 'lucide-react'

interface NewsItem {
  id: string
  title: string
  summary: string
  link: string
  source?: string
  sportType: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'
  relatedTeams?: string[]
  imageUrl?: string
  publishedAt: string
}

// Demo data for initial display
const demoNews: NewsItem[] = [
  {
    id: '1',
    title: '손흥민, 토트넘 새 시즌 핵심 역할 기대',
    summary: '토트넘 홋스퍼의 손흥민이 새 시즌을 앞두고 팀의 핵심 선수로 활약할 것으로 기대를 모으고 있다.',
    link: '#',
    source: 'Sports News',
    sportType: 'FOOTBALL',
    relatedTeams: ['Tottenham'],
    publishedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: '레알 마드리드, 챔피언스리그 우승 도전',
    summary: '레알 마드리드가 이번 시즌 챔피언스리그에서 다시 한번 정상을 노린다.',
    link: '#',
    source: 'Football Daily',
    sportType: 'FOOTBALL',
    relatedTeams: ['Real Madrid'],
    publishedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: '프리미어리그 개막전 일정 발표',
    summary: '2024-25 시즌 프리미어리그 개막전 일정이 공식 발표되었다.',
    link: '#',
    source: 'Premier League',
    sportType: 'FOOTBALL',
    publishedAt: new Date().toISOString(),
  },
]

function SportBadge({ sportType }: { sportType: NewsItem['sportType'] }) {
  const t = useTranslations('sports')

  const sportConfig = {
    FOOTBALL: { label: t('football'), className: 'bg-green-500 text-white' },
    BASKETBALL: { label: t('basketball'), className: 'bg-orange-500 text-white' },
    BASEBALL: { label: t('baseball'), className: 'bg-blue-500 text-white' },
  }

  const config = sportConfig[sportType]

  return <Badge className={config.className}>{config.label}</Badge>
}

function NewsCard({ news }: { news: NewsItem }) {
  const publishedDate = format(new Date(news.publishedAt), 'MM월 dd일', { locale: ko })

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <SportBadge sportType={news.sportType} />
          <span className="text-xs text-muted-foreground">{publishedDate}</span>
        </div>

        <h3 className="mb-2 font-semibold line-clamp-2">{news.title}</h3>
        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{news.summary}</p>

        {news.relatedTeams && news.relatedTeams.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {news.relatedTeams.map((team) => (
              <Badge key={team} variant="outline" className="text-xs">
                {team}
              </Badge>
            ))}
          </div>
        )}

        {news.source && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{news.source}</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function LatestNews() {
  // TODO: Fetch from API
  const news = demoNews
  const isLoading = false

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-16" />
              <Skeleton className="mb-2 h-5 w-full" />
              <Skeleton className="mb-3 h-10 w-full" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (news.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Newspaper className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">최신 뉴스가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {news.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </div>
  )
}

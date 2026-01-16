import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import Image from 'next/image'
import { collectAllFootballNews, type NewsItem } from '@/lib/api/news-api'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '축구 뉴스',
    description: '최신 축구 뉴스',
  }
}

function NewsCard({ news }: { news: NewsItem }) {
  const timeAgo = formatDistanceToNow(new Date(news.pubDate), { addSuffix: true, locale: ko })

  return (
    <a href={news.link} target="_blank" rel="noopener noreferrer">
      <Card className="h-full transition-all hover:shadow-md hover:scale-[1.02]">
        <CardContent className="p-0">
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
            {news.imageUrl ? (
              <Image
                src={news.imageUrl}
                alt={news.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Newspaper className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="mb-2 font-semibold line-clamp-2 text-base leading-snug">
              {news.title}
            </h3>
            {news.description && (
              <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
                {news.description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {news.source}
              </Badge>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

function NewsCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <div className="h-48 w-full bg-muted animate-pulse rounded-t-lg" />
        <div className="p-4">
          <div className="h-5 w-full bg-muted animate-pulse rounded mb-2" />
          <div className="h-5 w-3/4 bg-muted animate-pulse rounded mb-3" />
          <div className="h-4 w-full bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded mb-3" />
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function NewsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  let news: NewsItem[] = []
  let error = false

  try {
    news = await collectAllFootballNews(12)
  } catch (e) {
    console.error('Failed to fetch news:', e)
    error = true
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Newspaper className="mr-3 h-8 w-8" />
          축구 뉴스
        </h1>
        <p className="text-muted-foreground">
          최신 축구 뉴스를 확인하세요
        </p>
      </div>

      {error || news.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Newspaper className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">뉴스를 불러올 수 없습니다.</p>
            <p className="text-sm text-muted-foreground mt-1">
              잠시 후 다시 시도해주세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item, index) => (
            <NewsCard key={`${item.pubDate}-${index}`} news={item} />
          ))}
        </div>
      )}
    </div>
  )
}

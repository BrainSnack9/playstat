import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import { collectAllFootballNews, type NewsItem } from '@/lib/api/news-api'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { getDateLocale } from '@/lib/utils'

// 서버 공유 캐시 적용: 최신 뉴스 조회
const getCachedNews = (limit: number) => unstable_cache(
  async () => {
    return await collectAllFootballNews(limit)
  },
  [`latest-news-data-${limit}`],
  { revalidate: CACHE_REVALIDATE } // 1시간 캐시
)()

function NewsCard({ news, locale }: { news: NewsItem; locale: string }) {
  const timeAgo = formatDistanceToNow(new Date(news.pubDate), { 
    addSuffix: true, 
    locale: getDateLocale(locale) 
  })

  return (
    <a href={news.link} target="_blank" rel="noopener noreferrer">
      <Card className="h-full transition-all hover:shadow-md hover:scale-[1.02]">
        <CardContent className="p-0">
          <div className="relative h-40 w-full overflow-hidden rounded-t-lg bg-muted">
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
                <Newspaper className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="mb-2 font-semibold line-clamp-2 text-sm leading-snug">
              {news.title}
            </h3>
            {news.description && (
              <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                {news.description}
              </p>
            )}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                {news.source}
              </Badge>
              <span className="flex items-center gap-1 text-[10px]">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
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
        <div className="h-40 w-full bg-muted animate-pulse rounded-t-lg" />
        <div className="p-4">
          <div className="h-4 w-full bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-3" />
          <div className="h-3 w-full bg-muted animate-pulse rounded mb-2" />
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export async function LatestNews({ locale = 'ko' }: { locale?: string }) {
  let news: NewsItem[] = []
  let error = false

  try {
    news = await getCachedNews(6)
  } catch (e) {
    console.error('Failed to fetch news:', e)
    error = true
  }

  if (error || news.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Newspaper className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">최신 뉴스를 불러올 수 없습니다.</p>
          <p className="text-xs text-muted-foreground mt-1">
            잠시 후 다시 시도해주세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {news.map((item, index) => (
        <NewsCard key={`${item.pubDate}-${index}`} news={item} locale={locale} />
      ))}
    </div>
  )
}

// 클라이언트 Suspense용 로딩 컴포넌트
export function LatestNewsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  )
}

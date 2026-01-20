import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import { collectSportsNews, type NewsItem } from '@/lib/api/news-api'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { getDateLocale } from '@/lib/utils'
import { SPORT_COOKIE, getSportFromCookie, type SportId } from '@/lib/sport'

// 서버 공유 캐시 적용: 스포츠별 뉴스 데이터 조회
const getCachedNews = (sport: SportId, limit: number) => unstable_cache(
  async () => {
    return await collectSportsNews(sport, limit)
  },
  [`news-page-data-${sport}-${limit}`],
  { revalidate: CACHE_REVALIDATE }
)()

// 빌드 시 RSS fetch 방지 - 런타임에만 실행
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'news' })
  return {
    title: t('latest'),
    description: t('latest'),
  }
}

function NewsCard({ news, locale }: { news: NewsItem; locale: string }) {
  const timeAgo = formatDistanceToNow(new Date(news.pubDate), { 
    addSuffix: true, 
    locale: getDateLocale(locale) 
  })

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

export default async function NewsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'news' })

  // 쿠키에서 스포츠 타입 가져오기
  const cookieStore = await cookies()
  const sport = getSportFromCookie(cookieStore.get(SPORT_COOKIE)?.value)

  let news: NewsItem[] = []
  let error = false

  try {
    news = await getCachedNews(sport, 12)
  } catch (e) {
    console.error('Failed to fetch news:', e)
    error = true
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center text-3xl font-bold">
          <Newspaper className="mr-3 h-8 w-8" />
          {t('latest')}
        </h1>
        <p className="text-muted-foreground">
          {t('read_more')}
        </p>
      </div>

      {error || news.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Newspaper className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">{t('error')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item, index) => (
            <NewsCard key={`${item.pubDate}-${index}`} news={item} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}

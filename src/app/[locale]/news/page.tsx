import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import { collectSportsNews, type NewsItem } from '@/lib/api/news-api'
import { unstable_cache } from 'next/cache'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { getDateLocale } from '@/lib/utils'
import { Suspense } from 'react'

// 서버 공유 캐시 적용: 스포츠별 뉴스 데이터 조회
const getCachedNews = (sport: 'football' | 'basketball' | 'baseball', limit: number) => unstable_cache(
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
          <div className="p-3">
            <h3 className="mb-2 font-semibold line-clamp-2 text-sm leading-snug">
              {news.title}
            </h3>
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

// 스포츠별 뉴스 섹션
const SPORTS_CONFIG = [
  { id: 'football' as const, translationKey: 'football' },
  { id: 'basketball' as const, translationKey: 'basketball' },
  { id: 'baseball' as const, translationKey: 'baseball' },
]

async function SportNewsSection({
  sport,
  locale
}: {
  sport: typeof SPORTS_CONFIG[number]
  locale: string
}) {
  const t = await getTranslations({ locale, namespace: 'news' })
  const sports = await getTranslations({ locale, namespace: 'sports' })
  let news: NewsItem[] = []

  try {
    news = await getCachedNews(sport.id, 6)
  } catch (e) {
    console.error(`Failed to fetch ${sport.id} news:`, e)
  }

  return (
    <section className="mb-12">
      <h2 className="mb-6 text-xl font-bold">{sports(sport.translationKey)} {t('news_label')}</h2>

      {news.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8 text-center">
            <p className="text-muted-foreground">{t('error')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {news.map((item, index) => (
            <NewsCard key={`${sport.id}-${item.pubDate}-${index}`} news={item} locale={locale} />
          ))}
        </div>
      )}
    </section>
  )
}

function NewsSectionSkeleton() {
  return (
    <div className="mb-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-52 animate-pulse bg-muted" />
        ))}
      </div>
    </div>
  )
}

export default async function NewsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'news' })

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

      {/* 3개 스포츠 뉴스 섹션 */}
      {SPORTS_CONFIG.map((sport) => (
        <Suspense key={sport.id} fallback={<NewsSectionSkeleton />}>
          <SportNewsSection sport={sport} locale={locale} />
        </Suspense>
      ))}
    </div>
  )
}

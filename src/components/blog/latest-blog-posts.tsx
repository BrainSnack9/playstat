import { Link } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, ArrowRight, Eye } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'

interface Props {
  locale: string
}

const dateLocales: Record<string, DateLocale> = {
  ko,
  en: enUS,
  ja,
  de,
  es,
}

const categoryLabels: Record<string, Record<string, string>> = {
  ANALYSIS: { ko: '분석', en: 'Analysis', ja: '分析', de: 'Analyse', es: 'Análisis' },
  PREVIEW: { ko: '프리뷰', en: 'Preview', ja: 'プレビュー', de: 'Vorschau', es: 'Vista previa' },
  REVIEW: { ko: '리뷰', en: 'Review', ja: 'レビュー', de: 'Rezension', es: 'Reseña' },
}

const categoryStyles: Record<string, string> = {
  ANALYSIS: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  PREVIEW: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  REVIEW: 'bg-pink-500/15 text-pink-400 border border-pink-500/20',
}

const sportStyles: Record<string, { badge: string; label: Record<string, string> }> = {
  FOOTBALL: {
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    label: { ko: '축구', en: 'Football' },
  },
  BASKETBALL: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    label: { ko: '농구', en: 'Basketball' },
  },
  BASEBALL: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: { ko: '야구', en: 'Baseball' },
  },
}

// 최근 7일 내 조회수 높은 포스트 3개
const getPopularPosts = unstable_cache(
  async () => {
    const sevenDaysAgo = subDays(new Date(), 7)

    return prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { viewCount: 'desc' },
      take: 3,
    })
  },
  ['popular-blog-posts-7d'],
  { revalidate: 1800, tags: ['blog'] } // 30분마다 갱신
)

export async function LatestBlogPosts({ locale }: Props) {
  const posts = await getPopularPosts()

  if (posts.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {posts.map((post) => {
        const translations = post.translations as Record<string, { title: string; excerpt?: string }> | null
        const content = translations?.[locale] || translations?.ko || translations?.en
        const title = content?.title || '(제목 없음)'
        const excerpt = content?.excerpt || ''
        const style = post.sportType ? sportStyles[post.sportType] : null

        return (
          <Link key={post.id} href={`/blog/post/${post.slug}`} className="group">
            <Card className="h-full bg-card/50 border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`text-xs ${categoryStyles[post.category] || 'bg-blue-500/15 text-blue-400 border border-blue-500/20'}`}>
                    {categoryLabels[post.category]?.[locale] || categoryLabels[post.category]?.en}
                  </Badge>
                  {style && (
                    <Badge className={`text-xs ${style.badge}`}>
                      {style.label[locale as 'ko' | 'en'] || style.label.en}
                    </Badge>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {title}
                </h3>

                {excerpt && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {excerpt}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(
                        new Date(post.publishedAt || post.createdAt),
                        'MMM d',
                        { locale: dateLocales[locale] || enUS }
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {post.viewCount.toLocaleString()}
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export function LatestBlogPostsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-full bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex gap-2 mb-3">
              <div className="h-5 w-12 bg-muted rounded animate-pulse" />
              <div className="h-5 w-10 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-4 w-full bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-3" />
            <div className="h-3 w-full bg-muted rounded animate-pulse mb-1" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

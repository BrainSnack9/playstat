import { Link } from '@/i18n/routing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, BookOpen, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import { BlogPost } from '@prisma/client'

interface RelatedBlogPostsProps {
  posts: BlogPost[]
  locale: string
  title?: string
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

const defaultTitles: Record<string, string> = {
  ko: '관련 블로그',
  en: 'Related Posts',
  ja: '関連記事',
  de: 'Verwandte Beiträge',
  es: 'Posts Relacionados',
}

export function RelatedBlogPosts({ posts, locale, title }: RelatedBlogPostsProps) {
  if (!posts || posts.length === 0) {
    return null
  }

  const sectionTitle = title || defaultTitles[locale] || defaultTitles.en

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          {sectionTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {posts.map((post) => {
            const translations = post.translations as Record<string, { title: string; excerpt?: string }> | null
            const content = translations?.[locale] || translations?.ko || translations?.en
            const postTitle = content?.title || '(제목 없음)'
            const excerpt = content?.excerpt || ''

            return (
              <Link
                key={post.id}
                href={`/blog/post/${post.slug}`}
                className="group block p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] px-1.5 py-0 ${categoryStyles[post.category] || ''}`}>
                        {categoryLabels[post.category]?.[locale] || categoryLabels[post.category]?.en}
                      </Badge>
                      {post.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(
                            new Date(post.publishedAt),
                            'MMM d',
                            { locale: dateLocales[locale] || enUS }
                          )}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {postTitle}
                    </h4>
                    {excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {excerpt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {post.viewCount.toLocaleString()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

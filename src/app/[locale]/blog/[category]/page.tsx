import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, ArrowRight, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import { PostCategory } from '@prisma/client'

interface Props {
  params: Promise<{ locale: string; category: string }>
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

const validCategories = ['analysis', 'preview', 'review']

function getCategoryFromSlug(slug: string): PostCategory | null {
  const mapping: Record<string, PostCategory> = {
    analysis: 'ANALYSIS',
    preview: 'PREVIEW',
    review: 'REVIEW',
  }
  return mapping[slug.toLowerCase()] || null
}

const getPostsByCategory = unstable_cache(
  async (category: PostCategory) => {
    return prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', category },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    })
  },
  ['blog-posts-category'],
  { revalidate: 3600, tags: ['blog'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })

  const categoryKey = getCategoryFromSlug(category)
  if (!categoryKey) {
    return { title: 'Not Found' }
  }

  const categoryName = categoryLabels[categoryKey][locale] || categoryLabels[categoryKey].en

  return {
    title: `${categoryName} | ${t('pageTitle')}`,
    description: t('categoryDescription', { category: categoryName }),
  }
}

export default async function BlogCategoryPage({ params }: Props) {
  const { locale, category } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'blog' })

  const categoryKey = getCategoryFromSlug(category)
  if (!categoryKey) {
    notFound()
  }

  const posts = await getPostsByCategory(categoryKey)
  const categoryName = categoryLabels[categoryKey][locale] || categoryLabels[categoryKey].en

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToBlog')}
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">{categoryName}</h1>
        <p className="text-gray-400">{t('categoryPostCount', { count: posts.length })}</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href={`/${locale}/blog`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          {t('allPosts')}
        </Link>
        {validCategories.map((cat) => {
          const catKey = getCategoryFromSlug(cat)!
          const isActive = cat === category.toLowerCase()
          return (
            <Link
              key={cat}
              href={`/${locale}/blog/${cat}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {categoryLabels[catKey][locale] || categoryLabels[catKey].en}
            </Link>
          )
        })}
      </div>

      {/* 포스트 목록 */}
      {posts.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-16 text-center">
            <p className="text-gray-400">{t('noPosts')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => {
            const translations = post.translations as Record<string, { title: string; excerpt?: string }> | null
            const content = translations?.[locale] || translations?.ko || translations?.en
            const title = content?.title || '(제목 없음)'
            const excerpt = content?.excerpt || ''

            return (
              <Link key={post.id} href={`/${locale}/blog/post/${post.slug}`}>
                <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all h-full group">
                  {post.featuredImage && (
                    <div className="relative h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={post.featuredImage}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardContent className={post.featuredImage ? 'pt-4' : 'pt-6'}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="text-xs bg-blue-600 text-white">
                        {categoryLabels[post.category][locale] || categoryLabels[post.category].en}
                      </Badge>
                      {post.sportType && (
                        <Badge variant="outline" className="text-xs text-gray-400">
                          {post.sportType}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {title}
                    </h2>

                    {excerpt && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                        {excerpt}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(
                            new Date(post.publishedAt || post.createdAt),
                            'MMM d, yyyy',
                            { locale: dateLocales[locale] || enUS }
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {post.viewCount.toLocaleString()}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

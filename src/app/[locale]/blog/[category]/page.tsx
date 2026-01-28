import { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { notFound, redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, ArrowRight, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import { PostCategory, SportType } from '@prisma/client'
import { BlogSportFilter } from '@/components/blog/blog-sport-filter'
import { cookies } from 'next/headers'
import type { SportId } from '@/lib/sport'

interface Props {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<{ sport?: string }>
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

// 스포츠별 스타일 설정
const sportStyles = {
  FOOTBALL: {
    gradient: 'from-emerald-500/20 via-transparent to-transparent',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    label: { ko: '축구', en: 'Football' },
    color: 'emerald',
  },
  BASKETBALL: {
    gradient: 'from-orange-500/20 via-transparent to-transparent',
    border: 'border-l-orange-500',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    label: { ko: '농구', en: 'Basketball' },
    color: 'orange',
  },
  BASEBALL: {
    gradient: 'from-red-500/20 via-transparent to-transparent',
    border: 'border-l-red-500',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: { ko: '야구', en: 'Baseball' },
    color: 'red',
  },
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

function getSportTypeFilter(sport?: string): SportType | undefined {
  if (sport === 'football') return 'FOOTBALL'
  if (sport === 'basketball') return 'BASKETBALL'
  if (sport === 'baseball') return 'BASEBALL'
  return 'FOOTBALL' // 기본값
}

const getPostsByCategory = unstable_cache(
  async (category: PostCategory, sportType?: SportType) => {
    return prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        category,
        ...(sportType && { sportType }),
      },
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

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params
  const { sport } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'blog' })

  const categoryKey = getCategoryFromSlug(category)
  if (!categoryKey) {
    notFound()
  }

  // sport 파라미터가 없으면 쿠키에서 읽어서 리다이렉트
  if (!sport) {
    const cookieStore = await cookies()
    const preferredSport = cookieStore.get('ps_preferred_sport')?.value as SportId | undefined
    const defaultSport = preferredSport && ['football', 'basketball', 'baseball'].includes(preferredSport)
      ? preferredSport
      : 'football'
    redirect(`/${locale}/blog/${category}?sport=${defaultSport}`)
  }

  const currentSport = sport as 'football' | 'basketball' | 'baseball'
  const sportTypeFilter = getSportTypeFilter(currentSport)
  const posts = await getPostsByCategory(categoryKey, sportTypeFilter)
  const categoryName = categoryLabels[categoryKey][locale] || categoryLabels[categoryKey].en

  return (
    <div className="container mx-auto px-3 sm:px-4 pt-4 sm:pt-8 pb-20 sm:pb-32 max-w-6xl">
      {/* 헤더 */}
      <div className="mb-6 sm:mb-10">
        <Link
          href={`/blog?sport=${currentSport}`}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors group text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
          {t('backToBlog')}
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
       
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {categoryName}
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-lg">{t('categoryPostCount', { count: posts.length })}</p>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-x-6 mb-6 sm:mb-10 pb-4 sm:pb-6 border-b border-gray-800">
        {/* 스포츠 타입 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs sm:text-sm shrink-0">{locale === 'ko' ? '스포츠' : 'Sport'}</span>
          <BlogSportFilter
            currentSport={currentSport}
            basePath={`/blog/${category}`}
            locale={locale}
          />
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-700" />

        {/* 카테고리 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs sm:text-sm shrink-0">{locale === 'ko' ? '카테고리' : 'Category'}</span>
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
            <Link
              href={`/blog?sport=${currentSport}`}
              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs sm:text-sm text-gray-400 hover:text-white transition-all"
            >
              {t('allPosts')}
            </Link>
            {validCategories.map((cat) => {
              const catKey = getCategoryFromSlug(cat)!
              const isActive = cat === category.toLowerCase()
              const activeStyle = catKey === 'ANALYSIS'
                ? 'bg-purple-600/20 text-purple-400 font-medium'
                : catKey === 'PREVIEW'
                ? 'bg-cyan-600/20 text-cyan-400 font-medium'
                : 'bg-pink-600/20 text-pink-400 font-medium'
              const inactiveStyle = catKey === 'ANALYSIS'
                ? 'text-purple-400 hover:bg-purple-500/10'
                : catKey === 'PREVIEW'
                ? 'text-cyan-400 hover:bg-cyan-500/10'
                : 'text-pink-400 hover:bg-pink-500/10'
              return (
                <Link
                  key={cat}
                  href={`/blog/${cat}?sport=${currentSport}`}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs sm:text-sm transition-all ${isActive ? activeStyle : inactiveStyle}`}
                >
                  {categoryLabels[catKey][locale] || categoryLabels[catKey].en}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* 포스트 목록 */}
      {posts.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="py-20 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-lg">{t('noPosts')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => {
            const translations = post.translations as Record<string, { title: string; excerpt?: string }> | null
            const content = translations?.[locale] || translations?.ko || translations?.en
            const title = content?.title || '(제목 없음)'
            const excerpt = content?.excerpt || ''
            const style = post.sportType ? sportStyles[post.sportType] : null

            return (
              <Link key={post.id} href={`/blog/post/${post.slug}`} className="group">
                <Card className={`
                  relative h-full overflow-hidden bg-gray-900/70 border-gray-800
                  hover:border-gray-600 hover:bg-gray-900 transition-all duration-300
                  hover:shadow-xl hover:-translate-y-1
                  ${style ? `border-l-2 ${style.border}` : ''}
                `}>
                  {/* 미묘한 배경 그라데이션 */}
                  {style && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-30`} />
                  )}

                  {post.featuredImage && (
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={post.featuredImage}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <CardContent className={`relative h-full flex flex-col ${post.featuredImage ? 'pt-4' : 'p-5'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={`text-xs ${categoryStyles[post.category] || 'bg-blue-500/15 text-blue-400 border border-blue-500/20'}`}>
                        {categoryLabels[post.category][locale] || categoryLabels[post.category].en}
                      </Badge>
                      {style && (
                        <Badge className={`text-xs ${style.badge}`}>
                          {style.label[locale as 'ko' | 'en'] || style.label.en}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                      {title}
                    </h2>

                    {excerpt && (
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                        {excerpt}
                      </p>
                    )}

                    <div className="flex-grow" />

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(
                            new Date(post.publishedAt || post.createdAt),
                            'MMM d',
                            { locale: dateLocales[locale] || enUS }
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {post.viewCount.toLocaleString()}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
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

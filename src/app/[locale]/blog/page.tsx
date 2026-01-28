import { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, ArrowRight, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import { SportType } from '@prisma/client'
import { BlogSportFilter } from '@/components/blog/blog-sport-filter'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { SportId } from '@/lib/sport'

interface Props {
  params: Promise<{ locale: string }>
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

const categories = ['ANALYSIS', 'PREVIEW', 'REVIEW'] as const

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

function getSportTypeFilter(sport?: string): SportType | undefined {
  if (sport === 'football') return 'FOOTBALL'
  if (sport === 'basketball') return 'BASKETBALL'
  if (sport === 'baseball') return 'BASEBALL'
  return 'FOOTBALL' // 기본값
}

const getPublishedPosts = unstable_cache(
  async (sportType?: SportType) => {
    return prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        ...(sportType && { sportType }),
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    })
  },
  ['blog-posts'],
  { revalidate: 3600, tags: ['blog'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  }
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { sport } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'blog' })

  // sport 파라미터가 없으면 쿠키에서 읽어서 리다이렉트
  if (!sport) {
    const cookieStore = await cookies()
    const preferredSport = cookieStore.get('ps_preferred_sport')?.value as SportId | undefined
    const defaultSport = preferredSport && ['football', 'basketball', 'baseball'].includes(preferredSport)
      ? preferredSport
      : 'football'
    redirect(`/${locale}/blog?sport=${defaultSport}`)
  }

  const currentSport = sport as 'football' | 'basketball' | 'baseball'
  const sportTypeFilter = getSportTypeFilter(currentSport)
  const posts = await getPublishedPosts(sportTypeFilter)

  const featuredPost = posts[0]
  const regularPosts = posts.slice(1)

  return (
    <div className="container mx-auto px-3 sm:px-4 pt-4 sm:pt-8 pb-20 sm:pb-32 max-w-6xl">
      {/* 헤더 */}
      <div className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">{t('title')}</h1>
        <p className="text-gray-400 text-sm sm:text-base">{t('description')}</p>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-x-6 mb-6 sm:mb-10 pb-4 sm:pb-6 border-b border-gray-800">
        {/* 스포츠 타입 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs sm:text-sm shrink-0">{locale === 'ko' ? '스포츠' : 'Sport'}</span>
          <BlogSportFilter
            currentSport={currentSport}
            basePath="/blog"
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
              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs sm:text-sm bg-gray-700 text-white font-medium"
            >
              {t('allPosts')}
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/blog/${cat.toLowerCase()}?sport=${currentSport}`}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs sm:text-sm transition-all
                  ${cat === 'ANALYSIS' ? 'text-purple-400 hover:bg-purple-500/10' : ''}
                  ${cat === 'PREVIEW' ? 'text-cyan-400 hover:bg-cyan-500/10' : ''}
                  ${cat === 'REVIEW' ? 'text-pink-400 hover:bg-pink-500/10' : ''}
                `}
              >
                {categoryLabels[cat][locale] || categoryLabels[cat].en}
              </Link>
            ))}
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
        <div className="space-y-8">
          {/* 히어로 포스트 (첫 번째 포스트) */}
          {featuredPost && (
            <Link href={`/blog/post/${featuredPost.slug}`} className="block group">
              <Card className={`
                relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700/50
                hover:border-gray-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/5
                ${featuredPost.sportType ? `border-l-4 ${sportStyles[featuredPost.sportType]?.border || ''}` : ''}
              `}>
                {/* 배경 그라데이션 */}
                {featuredPost.sportType && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${sportStyles[featuredPost.sportType]?.gradient || ''} opacity-50`} />
                )}

                <CardContent className="relative p-4 sm:p-8">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 gap-1">
                      <Flame className="w-3 h-3" />
                      {locale === 'ko' ? '최신' : 'Latest'}
                    </Badge>
                    <Badge className={categoryStyles[featuredPost.category] || 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}>
                      {categoryLabels[featuredPost.category][locale] || categoryLabels[featuredPost.category].en}
                    </Badge>
                    {featuredPost.sportType && sportStyles[featuredPost.sportType] && (
                      <Badge className={sportStyles[featuredPost.sportType]?.badge || ''}>
                        {sportStyles[featuredPost.sportType]?.label[locale as 'ko' | 'en'] || sportStyles[featuredPost.sportType]?.label.en}
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-4 group-hover:text-blue-400 transition-colors line-clamp-2">
                    {(() => {
                      const translations = featuredPost.translations as Record<string, { title: string; excerpt?: string }> | null
                      return translations?.[locale]?.title || translations?.ko?.title || translations?.en?.title || '(제목 없음)'
                    })()}
                  </h2>

                  <p className="text-gray-400 text-sm sm:text-lg mb-4 sm:mb-6 line-clamp-2">
                    {(() => {
                      const translations = featuredPost.translations as Record<string, { title: string; excerpt?: string }> | null
                      return translations?.[locale]?.excerpt || translations?.ko?.excerpt || translations?.en?.excerpt || ''
                    })()}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-6 text-gray-500 text-xs sm:text-sm">
                      <span className="flex items-center gap-1.5 sm:gap-2">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {format(
                          new Date(featuredPost.publishedAt || featuredPost.createdAt),
                          'MMM d, yyyy',
                          { locale: dateLocales[locale] || enUS }
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 sm:gap-2">
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {featuredPost.viewCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-blue-400 group-hover:gap-3 sm:group-hover:gap-4 transition-all">
                      <span className="text-xs sm:text-sm font-medium">{locale === 'ko' ? '읽기' : 'Read'}</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* 나머지 포스트 그리드 */}
          {regularPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {regularPosts.map((post) => {
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

                      <CardContent className="relative p-5 h-full flex flex-col">
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

                        <h3 className="text-base font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                          {title}
                        </h3>

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
      )}
    </div>
  )
}

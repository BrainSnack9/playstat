import { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, ArrowLeft, User } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

const dateLocales: Record<string, DateLocale> = {
  ko,
  en: enUS,
  ja,
  de,
  es,
}

// 날짜를 ISO 문자열로 변환 (캐시에서 문자열로 올 수 있음)
function toISOString(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined
  if (typeof date === 'string') return date
  return date.toISOString()
}

const categoryLabels: Record<string, Record<string, string>> = {
  ANALYSIS: { ko: '분석', en: 'Analysis', ja: '分析', de: 'Analyse', es: 'Análisis' },
  PREVIEW: { ko: '프리뷰', en: 'Preview', ja: 'プレビュー', de: 'Vorschau', es: 'Vista previa' },
  REVIEW: { ko: '리뷰', en: 'Review', ja: 'レビュー', de: 'Rezension', es: 'Reseña' },
}

const getPostBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.blogPost.findUnique({
      where: { slug },
    })
  },
  ['blog-post'],
  { revalidate: 86400, tags: ['blog'] }
)

async function incrementViewCount(postId: string) {
  try {
    await prisma.blogPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    })
  } catch {
    // Silently fail - view count is not critical
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const post = await getPostBySlug(slug)

  if (!post || post.status !== 'PUBLISHED') {
    return { title: 'Not Found' }
  }

  const translations = post.translations as Record<string, { title: string; excerpt?: string; metaTitle?: string; metaDescription?: string }> | null
  const content = translations?.[locale] || translations?.ko || translations?.en
  const title = content?.metaTitle || content?.title || 'Blog Post'
  const description = content?.metaDescription || content?.excerpt || ''

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: toISOString(post.publishedAt),
      images: post.featuredImage ? [post.featuredImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'blog' })

  const post = await getPostBySlug(slug)

  if (!post || post.status !== 'PUBLISHED') {
    notFound()
  }

  // Increment view count (fire and forget)
  incrementViewCount(post.id)

  const translations = post.translations as Record<string, { title: string; excerpt?: string; content?: string }> | null
  const content = translations?.[locale] || translations?.ko || translations?.en
  const title = content?.title || '(제목 없음)'
  const excerpt = content?.excerpt || ''
  const bodyContent = content?.content || ''

  const categoryName = categoryLabels[post.category][locale] || categoryLabels[post.category].en

  // JSON-LD 구조화 데이터
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt,
    image: post.featuredImage || undefined,
    datePublished: toISOString(post.publishedAt),
    dateModified: toISOString(post.updatedAt),
    author: {
      '@type': 'Organization',
      name: 'PlayStat',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PlayStat',
      logo: {
        '@type': 'ImageObject',
        url: 'https://playstat.space/logo.png',
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="container mx-auto px-4 py-8 max-w-3xl">
        {/* 뒤로가기 */}
        <Link
          href={`/blog`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToBlog')}
        </Link>

        {/* 대표 이미지 */}
        {post.featuredImage && (
          <div className="relative h-64 md:h-96 mb-8 rounded-xl overflow-hidden">
            <img
              src={post.featuredImage}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* 헤더 */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Link href={`/blog/${post.category.toLowerCase()}`}>
              <Badge className="bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                {categoryName}
              </Badge>
            </Link>
            {post.sportType && (
              <Badge variant="outline" className="text-gray-400">
                {post.sportType}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            {title}
          </h1>

          {excerpt && (
            <p className="text-lg text-gray-400 mb-6">
              {excerpt}
            </p>
          )}

          <div className="flex items-center gap-6 text-sm text-gray-500 border-b border-gray-800 pb-6">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              PlayStat
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(
                new Date(post.publishedAt || post.createdAt),
                'MMMM d, yyyy',
                { locale: dateLocales[locale] || enUS }
              )}
            </span>
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {post.viewCount.toLocaleString()} {t('views')}
            </span>
          </div>
        </header>

        {/* 본문 */}
        <div className="prose prose-invert prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-8 mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-8 mb-4">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-bold text-white mt-6 mb-3">{children}</h3>,
              p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2">{children}</ol>,
              li: ({ children }) => <li className="text-gray-300">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-gray-900/50 text-gray-300 italic">
                  {children}
                </blockquote>
              ),
              code: ({ className, children }) => {
                const isInline = !className
                if (isInline) {
                  return <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-blue-300">{children}</code>
                }
                return (
                  <code className="block bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                    {children}
                  </code>
                )
              },
              pre: ({ children }) => <pre className="bg-gray-900 rounded-lg overflow-x-auto mb-4">{children}</pre>,
              a: ({ href, children }) => (
                <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                <img src={src} alt={alt || ''} className="rounded-lg my-6 w-full" />
              ),
              hr: () => (
                <hr className="my-8 border-t border-gray-700" />
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-white">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-gray-200">{children}</em>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-6">
                  <table className="w-full border-collapse border border-gray-700">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-gray-700 px-4 py-2 bg-gray-800 text-left font-semibold">{children}</th>,
              td: ({ children }) => <td className="border border-gray-700 px-4 py-2">{children}</td>,
            }}
          >
            {bodyContent}
          </ReactMarkdown>
        </div>
      </article>
    </>
  )
}

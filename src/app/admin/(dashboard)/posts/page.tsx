import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PenSquare, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { SportType, PostCategory } from '@prisma/client'
import { PostActionsMenu } from '@/components/admin/post-actions-menu'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    sport?: string
    category?: string
    page?: string
    sort?: string
    order?: string
  }>
}

const ITEMS_PER_PAGE = 20

const sportConfig = [
  { id: 'FOOTBALL', label: '축구', activeClass: 'bg-lime-500/20 text-lime-400 border-lime-500/50' },
  { id: 'BASKETBALL', label: '농구', activeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
  { id: 'BASEBALL', label: '야구', activeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
]

const categoryConfig = [
  { id: 'all', label: '전체' },
  { id: 'ANALYSIS', label: '분석', color: 'text-purple-400' },
  { id: 'PREVIEW', label: '프리뷰', color: 'text-cyan-400' },
  { id: 'REVIEW', label: '리뷰', color: 'text-pink-400' },
]

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '임시', className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' },
  PUBLISHED: { label: '게시', className: 'bg-green-500/15 text-green-500 border-green-500/30' },
  ARCHIVED: { label: '보관', className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

type SortField = 'createdAt' | 'viewCount' | 'title'
type SortOrder = 'asc' | 'desc'

async function getPosts(
  sportType: SportType,
  category: PostCategory | undefined,
  page: number,
  sortField: SortField,
  sortOrder: SortOrder
) {
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
        sportType,
        ...(category && { category }),
      },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.blogPost.count({
      where: {
        sportType,
        ...(category && { category }),
      },
    }),
  ])

  return { posts, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) }
}

async function getCounts() {
  const counts = await prisma.blogPost.groupBy({
    by: ['sportType', 'category'],
    _count: true,
  })
  return counts
}

export default async function AdminPostsPage({ searchParams }: Props) {
  const params = await searchParams
  const sport = (params.sport || 'FOOTBALL') as SportType
  const category = params.category === 'all' || !params.category ? undefined : params.category as PostCategory
  const page = Math.max(1, parseInt(params.page || '1'))
  const sortField = (params.sort || 'createdAt') as SortField
  const sortOrder = (params.order || 'desc') as SortOrder

  const [{ posts, total, totalPages }, counts] = await Promise.all([
    getPosts(sport, category, page, sortField, sortOrder),
    getCounts(),
  ])

  const sportCounts = sportConfig.reduce((acc, s) => {
    acc[s.id] = counts.filter(c => c.sportType === s.id).reduce((sum, c) => sum + c._count, 0)
    return acc
  }, {} as Record<string, number>)

  const categoryCounts = categoryConfig.reduce((acc, c) => {
    if (c.id === 'all') {
      acc[c.id] = counts.filter(cnt => cnt.sportType === sport).reduce((sum, cnt) => sum + cnt._count, 0)
    } else {
      acc[c.id] = counts.find(cnt => cnt.sportType === sport && cnt.category === c.id)?._count || 0
    }
    return acc
  }, {} as Record<string, number>)

  const buildUrl = (overrides: Record<string, string>) => {
    const base = { sport, category: params.category || 'all', page: '1', sort: sortField, order: sortOrder }
    const merged = { ...base, ...overrides }
    return `/admin/posts?${new URLSearchParams(merged).toString()}`
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      return buildUrl({ sort: field, order: sortOrder === 'desc' ? 'asc' : 'desc', page: '1' })
    }
    return buildUrl({ sort: field, order: 'desc', page: '1' })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
  }

  return (
    <div className="p-6">
      {/* 헤더 + 필터 한 줄 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-white">포스트</h1>

          {/* 스포츠 필터 */}
          <div className="flex items-center gap-1 pl-6 border-l border-gray-800">
            {sportConfig.map((s) => (
              <Link
                key={s.id}
                href={buildUrl({ sport: s.id, category: 'all', page: '1' })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                  sport === s.id ? s.activeClass : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {s.label}
                <span className="ml-1 opacity-60">{sportCounts[s.id] || 0}</span>
              </Link>
            ))}
          </div>

          {/* 카테고리 필터 */}
          <div className="flex items-center gap-1 pl-6 border-l border-gray-800">
            {categoryConfig.map((c) => (
              <Link
                key={c.id}
                href={buildUrl({ category: c.id, page: '1' })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  (params.category || 'all') === c.id
                    ? 'bg-gray-700 text-white'
                    : `${c.color || 'text-gray-500'} hover:bg-gray-800/50`
                }`}
              >
                {c.label}
                <span className="ml-1 opacity-60">{categoryCounts[c.id] || 0}</span>
              </Link>
            ))}
          </div>
        </div>

        <Link href="/admin/posts/new">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
            <PenSquare className="w-3.5 h-3.5 mr-1.5" />
            새 포스트
          </Button>
        </Link>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[1fr_72px_56px_80px_64px_40px] gap-3 px-4 py-2 bg-gray-800/40 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          <Link href={toggleSort('title')} className="flex items-center gap-1.5 hover:text-gray-300">
            제목 <SortIcon field="title" />
          </Link>
          <span className="text-center">카테고리</span>
          <span className="text-center">상태</span>
          <Link href={toggleSort('createdAt')} className="flex items-center gap-1.5 hover:text-gray-300">
            작성일 <SortIcon field="createdAt" />
          </Link>
          <Link href={toggleSort('viewCount')} className="flex items-center gap-1.5 justify-end hover:text-gray-300">
            조회 <SortIcon field="viewCount" />
          </Link>
          <span></span>
        </div>

        {/* 테이블 바디 */}
        {posts.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-500 text-sm">
            포스트가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {posts.map((post) => {
              const translations = post.translations as Record<string, { title: string }> | null
              const title = translations?.ko?.title || translations?.en?.title || '(제목 없음)'
              const catConfig = categoryConfig.find(c => c.id === post.category)
              const status = statusConfig[post.status]

              return (
                <div
                  key={post.id}
                  className="grid grid-cols-[1fr_72px_56px_80px_64px_40px] gap-3 px-4 py-2.5 text-sm items-center hover:bg-gray-800/20 transition-colors"
                >
                  <Link
                    href={`/admin/posts/${post.id}/edit`}
                    className="text-gray-200 truncate hover:text-blue-400 transition-colors"
                    title={title}
                  >
                    {title}
                  </Link>
                  <span className={`text-xs text-center ${catConfig?.color || 'text-gray-500'}`}>
                    {catConfig?.label || post.category}
                  </span>
                  <div className="flex justify-center">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-normal ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(post.createdAt), 'yy.MM.dd', { locale: ko })}
                  </span>
                  <span className="text-xs text-gray-500 text-right tabular-nums">
                    {post.viewCount.toLocaleString()}
                  </span>
                  <div className="flex justify-center">
                    <PostActionsMenu postId={post.id} currentStatus={post.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800 text-xs">
            <span className="text-gray-500">
              {total}개 중 {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, total)}
            </span>
            <div className="flex items-center gap-0.5">
              <Link
                href={buildUrl({ page: String(Math.max(1, page - 1)) })}
                className={`p-1 rounded hover:bg-gray-800 ${page <= 1 ? 'pointer-events-none opacity-30' : ''}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Link
                    key={pageNum}
                    href={buildUrl({ page: String(pageNum) })}
                    className={`min-w-[28px] h-7 flex items-center justify-center rounded text-xs ${
                      page === pageNum ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {pageNum}
                  </Link>
                )
              })}
              <Link
                href={buildUrl({ page: String(Math.min(totalPages, page + 1)) })}
                className={`p-1 rounded hover:bg-gray-800 ${page >= totalPages ? 'pointer-events-none opacity-30' : ''}`}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

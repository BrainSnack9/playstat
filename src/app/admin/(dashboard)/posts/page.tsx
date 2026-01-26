import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'

// 관리자 페이지는 항상 최신 데이터 표시
export const dynamic = 'force-dynamic'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PenSquare, Eye, Calendar, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { DeletePostButton } from '@/components/admin/delete-post-button'
import { ArchivePostButton } from '@/components/admin/archive-post-button'

const categoryLabels: Record<string, string> = {
  ANALYSIS: '분석',
  PREVIEW: '프리뷰',
  REVIEW: '리뷰',
  NEWS: '뉴스',
  GUIDE: '가이드',
  ANNOUNCEMENT: '공지',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '임시저장', color: 'bg-yellow-500/20 text-yellow-400' },
  PUBLISHED: { label: '게시됨', color: 'bg-green-500/20 text-green-400' },
  ARCHIVED: { label: '보관됨', color: 'bg-gray-500/20 text-gray-400' },
}

async function getPosts() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return posts
}

export default async function AdminPostsPage() {
  const posts = await getPosts()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">포스트 관리</h1>
        <Link href="/admin/posts/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <PenSquare className="w-4 h-4 mr-2" />
            새 포스트
          </Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PenSquare className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-4">아직 작성된 포스트가 없습니다.</p>
            <Link href="/admin/posts/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                첫 포스트 작성하기
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const translations = post.translations as Record<string, { title: string; excerpt?: string }> | null
            const title = translations?.ko?.title || translations?.en?.title || '(제목 없음)'
            const status = statusLabels[post.status]

            return (
              <Card key={post.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[post.category]}
                        </Badge>
                        <Badge className={`text-xs ${status.color}`}>
                          {status.label}
                        </Badge>
                        {post.sportType && (
                          <Badge variant="outline" className="text-xs text-gray-400">
                            {post.sportType}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-2 truncate">
                        {title}
                      </h3>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(post.createdAt), 'yyyy.MM.dd', { locale: ko })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {post.viewCount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/admin/posts/${post.id}/edit`}>
                        <Button variant="outline" size="sm" className="border-gray-700 hover:bg-gray-800">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <ArchivePostButton postId={post.id} currentStatus={post.status} />
                      <DeletePostButton postId={post.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

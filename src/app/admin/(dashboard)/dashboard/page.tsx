import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Eye, Clock, CheckCircle } from 'lucide-react'

// 관리자 페이지는 항상 최신 데이터 표시
export const dynamic = 'force-dynamic'

async function getDashboardStats() {
  try {
    const [totalPosts, publishedPosts, draftPosts, viewsResult] = await Promise.all([
      prisma.blogPost.count(),
      prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
      prisma.blogPost.count({ where: { status: 'DRAFT' } }),
      prisma.blogPost.aggregate({ _sum: { viewCount: true } }),
    ])

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalViews: viewsResult._sum.viewCount || 0,
    }
  } catch {
    return {
      totalPosts: 0,
      publishedPosts: 0,
      draftPosts: 0,
      totalViews: 0,
    }
  }
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()

  const statCards = [
    {
      title: '전체 포스트',
      value: stats.totalPosts,
      icon: FileText,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
    },
    {
      title: '게시됨',
      value: stats.publishedPosts,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
    },
    {
      title: '임시저장',
      value: stats.draftPosts,
      icon: Clock,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
    },
    {
      title: '총 조회수',
      value: stats.totalViews.toLocaleString(),
      icon: Eye,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
    },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 빠른 시작 */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">빠른 시작</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">
            블로그 포스트를 작성하여 사이트에 독창적인 콘텐츠를 추가하세요.
          </p>
          <div className="flex gap-4">
            <a
              href="/admin/posts/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              새 포스트 작성
            </a>
            <a
              href="/admin/posts"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              포스트 목록
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

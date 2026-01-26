'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  FileText,
  RefreshCw,
  Newspaper,
  Wrench
} from 'lucide-react'

interface CronJob {
  id: string
  name: string
  description: string
  endpoint: string
  icon: React.ReactNode
  category: 'data' | 'content' | 'blog' | 'maintenance'
}

const cronJobs: CronJob[] = [
  // 데이터 수집
  {
    id: 'collect-football',
    name: '⚽ 축구 데이터 수집',
    description: '유럽 5대 리그 경기 일정 및 결과 수집',
    endpoint: '/api/cron/collect-football',
    icon: <Database className="w-5 h-5" />,
    category: 'data',
  },
  {
    id: 'collect-basketball',
    name: '🏀 농구 데이터 수집',
    description: 'NBA 경기 일정 및 결과 수집',
    endpoint: '/api/cron/collect-basketball',
    icon: <Database className="w-5 h-5" />,
    category: 'data',
  },
  {
    id: 'collect-baseball',
    name: '⚾ 야구 데이터 수집',
    description: 'MLB/KBO 경기 일정 및 결과 수집',
    endpoint: '/api/cron/collect-baseball',
    icon: <Database className="w-5 h-5" />,
    category: 'data',
  },
  {
    id: 'collect-team-data',
    name: '팀 데이터 수집',
    description: '팀 통계, 순위, 최근 경기 데이터 수집',
    endpoint: '/api/cron/collect-team-data',
    icon: <Database className="w-5 h-5" />,
    category: 'data',
  },
  {
    id: 'update-live-matches',
    name: '실시간 점수 업데이트',
    description: '진행 중인 경기 점수 및 상태 업데이트',
    endpoint: '/api/cron/update-live-matches',
    icon: <RefreshCw className="w-5 h-5" />,
    category: 'data',
  },
  // 콘텐츠 생성
  {
    id: 'generate-analysis',
    name: 'AI 경기 분석 생성',
    description: '48시간 내 경기에 대한 AI 프리뷰 분석 생성',
    endpoint: '/api/cron/generate-analysis',
    icon: <FileText className="w-5 h-5" />,
    category: 'content',
  },
  {
    id: 'generate-daily-report',
    name: '데일리 리포트 생성',
    description: '오늘의 경기 요약 리포트 생성',
    endpoint: '/api/cron/generate-daily-report',
    icon: <Newspaper className="w-5 h-5" />,
    category: 'content',
  },
  // 블로그 - 축구
  {
    id: 'generate-blog-preview',
    name: '⚽ 축구 프리뷰 생성',
    description: '빅매치(상위 15위 내 팀) 블로그 프리뷰 자동 생성 (DRAFT)',
    endpoint: '/api/cron/generate-blog-preview',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  {
    id: 'generate-blog-review',
    name: '⚽ 축구 리뷰 생성',
    description: '최근 6시간 내 종료된 경기 리뷰 자동 생성 (DRAFT)',
    endpoint: '/api/cron/generate-blog-review',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  {
    id: 'generate-blog-analysis',
    name: '⚽ 축구 분석 생성',
    description: '팀 비교, 리그 점검 등 심층 분석 글 생성 (DRAFT)',
    endpoint: '/api/cron/generate-blog-analysis',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  // 블로그 - 농구
  {
    id: 'generate-blog-preview-basketball',
    name: '🏀 농구 프리뷰 생성',
    description: 'NBA 빅매치(상위 10위 내 팀) 프리뷰 자동 생성 (DRAFT)',
    endpoint: '/api/cron/generate-blog-preview-basketball',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  {
    id: 'generate-blog-review-basketball',
    name: '🏀 농구 리뷰 생성',
    description: 'NBA 최근 종료 경기 리뷰 자동 생성 (DRAFT)',
    endpoint: '/api/cron/generate-blog-review-basketball',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  {
    id: 'generate-blog-analysis-basketball',
    name: '🏀 농구 분석 생성',
    description: 'NBA 팀 비교, 컨퍼런스 점검 등 심층 분석 (DRAFT)',
    endpoint: '/api/cron/generate-blog-analysis-basketball',
    icon: <FileText className="w-5 h-5" />,
    category: 'blog',
  },
  // 유지보수
  {
    id: 'fix-blog-slugs',
    name: '블로그 슬러그 수정',
    description: '한글이 포함된 슬러그를 ASCII로 변환',
    endpoint: '/api/admin/posts/fix-slugs',
    icon: <Wrench className="w-5 h-5" />,
    category: 'maintenance',
  },
]

type JobStatus = 'idle' | 'running' | 'success' | 'error'

interface JobResult {
  status: JobStatus
  message?: string
  duration?: string
}

export default function CronPage() {
  const [jobResults, setJobResults] = useState<Record<string, JobResult>>({})

  const runCronJob = async (job: CronJob) => {
    setJobResults((prev) => ({
      ...prev,
      [job.id]: { status: 'running' },
    }))

    try {
      const response = await fetch('/api/admin/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: job.endpoint }),
      })

      const data = await response.json()

      if (response.ok) {
        setJobResults((prev) => ({
          ...prev,
          [job.id]: {
            status: 'success',
            message: data.message || '완료',
            duration: data.duration,
          },
        }))
      } else {
        setJobResults((prev) => ({
          ...prev,
          [job.id]: {
            status: 'error',
            message: data.error || '실행 실패',
          },
        }))
      }
    } catch (error) {
      setJobResults((prev) => ({
        ...prev,
        [job.id]: {
          status: 'error',
          message: error instanceof Error ? error.message : '네트워크 오류',
        },
      }))
    }
  }

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="outline" className="text-blue-400 border-blue-400">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            실행 중
          </Badge>
        )
      case 'success':
        return (
          <Badge variant="outline" className="text-green-400 border-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            완료
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="outline" className="text-red-400 border-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            실패
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-400 border-gray-600">
            <Clock className="w-3 h-3 mr-1" />
            대기
          </Badge>
        )
    }
  }

  const categories = [
    { id: 'data', label: '데이터 수집', description: '경기 데이터 및 통계 수집' },
    { id: 'content', label: 'AI 콘텐츠 생성', description: '경기 분석 및 리포트 생성' },
    { id: 'blog', label: '블로그 자동화', description: '블로그 포스트 자동 생성' },
    { id: 'maintenance', label: '유지보수', description: '데이터 정리 및 수정 작업' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">크론 작업 관리</h1>
        <p className="text-gray-400">
          데이터 수집 및 콘텐츠 생성 작업을 수동으로 실행할 수 있습니다.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category.id} className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{category.label}</h2>
            <p className="text-sm text-gray-500">{category.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cronJobs
              .filter((job) => job.category === category.id)
              .map((job) => {
                const result = jobResults[job.id]
                const isRunning = result?.status === 'running'

                return (
                  <Card key={job.id} className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-400">
                          {job.icon}
                          <CardTitle className="text-base text-white">
                            {job.name}
                          </CardTitle>
                        </div>
                        {result && getStatusBadge(result.status)}
                      </div>
                      <CardDescription className="text-gray-500">
                        {job.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result?.message && (
                        <p
                          className={`text-sm mb-3 ${
                            result.status === 'error'
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {result.message}
                          {result.duration && (
                            <span className="text-gray-500 ml-2">
                              ({result.duration})
                            </span>
                          )}
                        </p>
                      )}
                      <Button
                        onClick={() => runCronJob(job)}
                        disabled={isRunning}
                        size="sm"
                        className="w-full"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            실행 중...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            실행
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </div>
      ))}

      <Card className="bg-gray-900/50 border-gray-800 mt-8">
        <CardHeader>
          <CardTitle className="text-base text-gray-300">참고사항</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 space-y-2">
          <p>• 데이터 수집 작업은 외부 API 호출로 인해 시간이 걸릴 수 있습니다.</p>
          <p>• AI 콘텐츠 생성은 OpenAI API를 사용하며 비용이 발생합니다.</p>
          <p>• 블로그 프리뷰는 DRAFT 상태로 저장되며, 포스트 관리에서 확인 후 게시하세요.</p>
          <p>• 프로덕션에서는 Vercel Cron 또는 외부 크론 서비스를 사용하세요.</p>
        </CardContent>
      </Card>
    </div>
  )
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CRON_SECRET = process.env.CRON_SECRET

// 허용된 크론 엔드포인트 목록
const ALLOWED_ENDPOINTS = [
  '/api/cron/collect-football',
  '/api/cron/collect-basketball',
  '/api/cron/collect-baseball',
  '/api/cron/collect-team-data',
  '/api/cron/collect-matches',
  '/api/cron/update-live-matches',
  '/api/cron/generate-analysis',
  '/api/cron/generate-daily-report',
  '/api/cron/generate-blog-preview',
]

// 인증 확인
async function verifyAdmin() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return null
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

/**
 * POST /api/admin/cron/run
 * 어드민에서 크론 작업을 수동으로 실행
 */
export async function POST(request: Request) {
  // 인증 확인
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { endpoint } = body

    // 엔드포인트 검증
    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return NextResponse.json(
        { error: '허용되지 않은 엔드포인트입니다.' },
        { status: 400 }
      )
    }

    // 크론 작업 실행
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3030'
    const cronUrl = `${baseUrl}${endpoint}`

    console.log(`[Admin Cron] Running: ${cronUrl}`)

    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data.error || '크론 작업 실행 실패',
          details: data.details,
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: data.message || '크론 작업이 완료되었습니다.',
      duration: data.duration,
      results: data.results,
    })
  } catch (error) {
    console.error('[Admin Cron] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

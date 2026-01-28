import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 인증 확인 헬퍼
async function verifyAdmin() {
  // 환경 변수 체크
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return null
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      console.log('No access token found in cookies')
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error) {
      console.error('Supabase auth error:', error.message)
      return null
    }

    if (!user?.email) {
      console.log('No user email found')
      return null
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.error('ADMIN_EMAIL environment variable not set')
      return null
    }

    if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
      console.log('User email does not match admin email')
      return null
    }

    return user
  } catch (error) {
    console.error('verifyAdmin error:', error)
    return null
  }
}

// 번역 데이터 스키마
const translationSchema = z.object({
  title: z.string().default(''),
  excerpt: z.string().default(''),
  content: z.string().default(''),
})

// 포스트 생성 스키마
const createPostSchema = z.object({
  slug: z.string().min(1).max(200),
  category: z.enum(['ANALYSIS', 'PREVIEW', 'REVIEW']),
  sportType: z.enum(['FOOTBALL', 'BASKETBALL', 'BASEBALL']).nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  translations: z.record(z.string(), translationSchema),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
})

// POST: 새 포스트 생성
export async function POST(request: Request) {
  try {
    console.log('POST /api/admin/posts called')
    const user = await verifyAdmin()
    console.log('verifyAdmin result:', user ? 'authenticated' : 'not authenticated')
    if (!user) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body received')
    const data = createPostSchema.parse(body)
    console.log('Data validated')

    // 슬러그 중복 확인
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug: data.slug },
    })

    if (existingPost) {
      return NextResponse.json({ error: '이미 사용 중인 슬러그입니다.' }, { status: 400 })
    }

    console.log('Creating post...')
    const post = await prisma.blogPost.create({
      data: {
        slug: data.slug,
        category: data.category,
        sportType: data.sportType || null,
        featuredImage: data.featuredImage || null,
        authorId: user.id,
        status: data.status,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        translations: data.translations,
      },
    })
    console.log('Post created:', post.id)

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('POST /api/admin/posts error type:', typeof error)
    console.error('POST /api/admin/posts error constructor:', error?.constructor?.name)
    console.error('POST /api/admin/posts error:', error)

    if (error instanceof z.ZodError) {
      // ZodError uses .issues property
      const issues = error.issues || []
      console.log('ZodError detected, issues:', JSON.stringify(issues, null, 2))
      if (Array.isArray(issues) && issues.length > 0) {
        const errorMessages = issues.map(e => `${e.path?.join('.') || 'unknown'}: ${e.message}`).join(', ')
        return NextResponse.json({ error: `데이터 검증 실패: ${errorMessages}`, details: issues }, { status: 400 })
      }
      return NextResponse.json({ error: '데이터 검증 실패' }, { status: 400 })
    }

    // Prisma errors often have a 'code' property
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as { code: string }).code)
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `포스트 생성에 실패했습니다: ${errorMessage}` }, { status: 500 })
  }
}

// GET: 포스트 목록
export async function GET() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Post list error:', error)
    return NextResponse.json({ error: '포스트 목록 조회에 실패했습니다.' }, { status: 500 })
  }
}

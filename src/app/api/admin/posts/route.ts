import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 인증 확인 헬퍼
async function verifyAdmin() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value

  if (!accessToken) {
    return null
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user?.email) {
      return null
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (user.email.toLowerCase() !== adminEmail?.toLowerCase()) {
      return null
    }

    return user
  } catch {
    return null
  }
}

// 포스트 생성 스키마
const createPostSchema = z.object({
  slug: z.string().min(1).max(200),
  category: z.enum(['ANALYSIS', 'PREVIEW', 'REVIEW', 'NEWS', 'GUIDE', 'ANNOUNCEMENT']),
  sportType: z.enum(['FOOTBALL', 'BASKETBALL', 'BASEBALL']).nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  translations: z.record(z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
  })),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
})

// POST: 새 포스트 생성
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createPostSchema.parse(body)

    // 슬러그 중복 확인
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug: data.slug },
    })

    if (existingPost) {
      return NextResponse.json({ error: '이미 사용 중인 슬러그입니다.' }, { status: 400 })
    }

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

    return NextResponse.json({ success: true, post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '잘못된 데이터 형식입니다.', details: error.errors }, { status: 400 })
    }

    console.error('Post creation error:', error)
    return NextResponse.json({ error: '포스트 생성에 실패했습니다.' }, { status: 500 })
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

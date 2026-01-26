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

// 포스트 수정 스키마
const updatePostSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  category: z.enum(['ANALYSIS', 'PREVIEW', 'REVIEW', 'NEWS', 'GUIDE', 'ANNOUNCEMENT']).optional(),
  sportType: z.enum(['FOOTBALL', 'BASKETBALL', 'BASEBALL']).nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  translations: z.record(z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
  })).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

// GET: 포스트 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const { id } = await params

  try {
    const post = await prisma.blogPost.findUnique({
      where: { id },
    })

    if (!post) {
      return NextResponse.json({ error: '포스트를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Post get error:', error)
    return NextResponse.json({ error: '포스트 조회에 실패했습니다.' }, { status: 500 })
  }
}

// PUT: 포스트 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const data = updatePostSchema.parse(body)

    // 슬러그 중복 확인 (다른 포스트와)
    if (data.slug) {
      const existingPost = await prisma.blogPost.findFirst({
        where: {
          slug: data.slug,
          NOT: { id },
        },
      })

      if (existingPost) {
        return NextResponse.json({ error: '이미 사용 중인 슬러그입니다.' }, { status: 400 })
      }
    }

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    })

    if (!existingPost) {
      return NextResponse.json({ error: '포스트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 게시 상태로 변경되면 publishedAt 설정
    const publishedAt =
      data.status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED'
        ? new Date()
        : existingPost.publishedAt

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(data.slug && { slug: data.slug }),
        ...(data.category && { category: data.category }),
        ...(data.sportType !== undefined && { sportType: data.sportType }),
        ...(data.featuredImage !== undefined && { featuredImage: data.featuredImage }),
        ...(data.translations && { translations: data.translations }),
        ...(data.status && { status: data.status, publishedAt }),
      },
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '잘못된 데이터 형식입니다.', details: error.errors }, { status: 400 })
    }

    console.error('Post update error:', error)
    return NextResponse.json({ error: '포스트 수정에 실패했습니다.' }, { status: 500 })
  }
}

// DELETE: 포스트 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.blogPost.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Post delete error:', error)
    return NextResponse.json({ error: '포스트 삭제에 실패했습니다.' }, { status: 500 })
  }
}

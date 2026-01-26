import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * POST /api/admin/posts/force-delete
 * Raw SQL을 사용한 강제 삭제 (타임아웃 방지)
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Raw SQL로 삭제 시도 (더 빠를 수 있음)
    const result = await prisma.$executeRaw`DELETE FROM "BlogPost" WHERE id = ${id}`

    if (result === 0) {
      return NextResponse.json({ error: 'Post not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Deleted post with id: ${id}`,
      rowsAffected: result,
    })
  } catch (error) {
    console.error('Force delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete post' },
      { status: 500 }
    )
  }
}

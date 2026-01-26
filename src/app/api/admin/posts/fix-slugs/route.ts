import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'

/**
 * 슬러그 정규화 (ASCII만 허용)
 */
function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // ASCII 알파벳, 숫자, 공백, 하이픈만 허용
    .replace(/\s+/g, '-')           // 공백을 하이픈으로
    .replace(/-+/g, '-')            // 연속 하이픈 제거
    .replace(/^-|-$/g, '')          // 시작/끝 하이픈 제거
}

/**
 * POST /api/admin/posts/fix-slugs
 * 한글이 포함된 슬러그를 ASCII로 변환
 */
export async function POST() {
  try {
    // 모든 블로그 포스트 조회
    const posts = await prisma.blogPost.findMany({
      select: {
        id: true,
        slug: true,
      },
    })

    const results: { id: string; oldSlug: string; newSlug: string }[] = []
    const errors: { id: string; slug: string; error: string }[] = []

    for (const post of posts) {
      // ASCII가 아닌 문자가 있는지 확인
      // eslint-disable-next-line no-control-regex
      const hasNonAscii = /[^\x00-\x7F]/.test(post.slug)

      if (hasNonAscii) {
        const newSlug = normalizeSlug(post.slug)

        // 새 슬러그가 이미 존재하는지 확인
        const existing = await prisma.blogPost.findUnique({
          where: { slug: newSlug },
        })

        if (existing && existing.id !== post.id) {
          // 슬러그 충돌 - 타임스탬프 추가
          const uniqueSlug = `${newSlug}-${Date.now().toString(36)}`
          try {
            await prisma.blogPost.update({
              where: { id: post.id },
              data: { slug: uniqueSlug },
            })
            results.push({ id: post.id, oldSlug: post.slug, newSlug: uniqueSlug })
          } catch (err) {
            errors.push({
              id: post.id,
              slug: post.slug,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        } else {
          try {
            await prisma.blogPost.update({
              where: { id: post.id },
              data: { slug: newSlug },
            })
            results.push({ id: post.id, oldSlug: post.slug, newSlug })
          } catch (err) {
            errors.push({
              id: post.id,
              slug: post.slug,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }
      }
    }

    // 캐시 무효화
    if (results.length > 0) {
      revalidateTag('blog')
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${results.length} slugs`,
      results,
      errors,
    })
  } catch (error) {
    console.error('Fix slugs failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

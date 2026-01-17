import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET
const ALLOWED_TAGS = new Set(['daily-report', 'matches', 'match-detail'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag')
  const secret = searchParams.get('secret')

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!tag || !ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ error: 'Invalid tag' }, { status: 400 })
  }

  revalidateTag(tag)
  return NextResponse.json({ revalidated: true, tag })
}

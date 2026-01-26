import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_TRANSLATE_PROMPTS, fillPrompt } from '@/lib/ai/prompts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 인증 확인
async function verifyAdmin() {
  if (!supabaseUrl || !supabaseAnonKey) {
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

interface TranslationContent {
  title: string
  excerpt: string
  content: string
}

/**
 * AI 응답 파싱 (JSON)
 */
function parseTranslationResponse(response: string): TranslationContent | null {
  try {
    let jsonStr = response.trim()

    // ```json ... ``` 코드블록 제거
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim()
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim()
    }

    const parsed = JSON.parse(jsonStr)

    return {
      title: parsed.title || '',
      excerpt: parsed.excerpt || '',
      content: parsed.content || '',
    }
  } catch (error) {
    console.error('Failed to parse translation response:', error)
    return null
  }
}

/**
 * OpenAI를 사용해 블로그 콘텐츠를 해당 언어로 재작성
 */
async function translateWithOpenAI(
  content: TranslationContent,
  targetLang: string
): Promise<TranslationContent | null> {
  if (!openai) {
    console.error('OpenAI not configured')
    return null
  }

  const promptTemplate = BLOG_TRANSLATE_PROMPTS[targetLang]
  if (!promptTemplate) {
    console.error(`No translation prompt for language: ${targetLang}`)
    return null
  }

  // 한국어 원본 콘텐츠를 하나의 문자열로 구성
  const koreanContent = `
제목: ${content.title}

요약: ${content.excerpt}

본문:
${content.content}
`.trim()

  const prompt = fillPrompt(promptTemplate, { koreanContent })

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.ANALYSIS,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.8, // 더 창의적인 번역을 위해
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      console.error('Empty AI response for translation')
      return null
    }

    return parseTranslationResponse(aiResponse)
  } catch (error) {
    console.error(`Translation to ${targetLang} failed:`, error)
    return null
  }
}

/**
 * POST /api/admin/translate
 * 블로그 포스트 콘텐츠 번역 (OpenAI 사용)
 */
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { sourceLocale, targetLocales, content } = body as {
      sourceLocale: string
      targetLocales: string[]
      content: TranslationContent
    }

    if (!sourceLocale || !targetLocales || !content) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 현재는 한국어 → 다른 언어만 지원
    if (sourceLocale !== 'ko') {
      return NextResponse.json(
        { error: '현재는 한국어에서 다른 언어로의 번역만 지원합니다.' },
        { status: 400 }
      )
    }

    if (!content.title && !content.content) {
      return NextResponse.json(
        { error: '번역할 콘텐츠가 없습니다.' },
        { status: 400 }
      )
    }

    const translations: Record<string, TranslationContent> = {}
    const errors: string[] = []

    // 순차적으로 번역 (병렬 처리 시 Rate limit 문제 발생 가능)
    for (const targetLang of targetLocales) {
      if (targetLang === sourceLocale) continue
      if (targetLang === 'ko') continue // 한국어는 원본이므로 스킵

      console.log(`[Translate] Translating from ${sourceLocale} to ${targetLang} with OpenAI...`)

      const translated = await translateWithOpenAI(content, targetLang)

      if (translated) {
        translations[targetLang] = translated
      } else {
        errors.push(targetLang)
      }

      // Rate limit 방지를 위한 딜레이
      if (targetLocales.indexOf(targetLang) < targetLocales.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const successCount = Object.keys(translations).length

    if (successCount === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `번역 실패: ${errors.join(', ')}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${successCount}개 언어로 번역 완료${errors.length > 0 ? ` (실패: ${errors.join(', ')})` : ''}`,
      translations,
    })
  } catch (error) {
    console.error('[Admin Translate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

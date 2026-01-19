import { openai, AI_MODELS } from '@/lib/openai'
import { prisma } from '@/lib/prisma'
import { Locale, locales } from '@/i18n/config'

/**
 * 텍스트를 특정 언어로 번역합니다. (병렬 처리 지원을 위해 DB 저장은 하지 않음)
 */
export async function translateText(
  text: string,
  targetLang: Locale,
  context: string
): Promise<string> {
  if (!text || targetLang === 'en') return text // 영어는 번역할 필요 없음 (원본이 영어라고 가정)
  if (!openai) return text

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY, // gpt-4o-mini 사용
      messages: [
        {
          role: 'system',
          content: `You are a professional sports translator. Translate the following English ${context} into natural ${targetLang === 'ko' ? 'Korean' : targetLang === 'es' ? 'Spanish' : targetLang === 'ja' ? 'Japanese' : 'German'}. Keep the original meaning and technical terms. Use professional sports terminology.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content || text
  } catch (error) {
    console.error(`[Translate] Error translating to ${targetLang}:`, error)
    return text
  }
}

/**
 * 여러 언어로 한꺼번에 번역하여 객체로 반환합니다.
 */
export async function translateToAllLocales(
  text: string,
  context: string,
  exclude: Locale[] = ['en']
): Promise<Record<string, string>> {
  const targetLocales = locales.filter(l => !exclude.includes(l as Locale))
  
  const translations: Record<string, string> = {}
  
  // 병렬 번역 실행
  await Promise.all(
    targetLocales.map(async (lang) => {
      translations[lang] = await translateText(text, lang as Locale, context)
    })
  )
  
  return translations
}

/**
 * 경기 분석 데이터의 누락된 번역본을 채웁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureMatchAnalysisTranslations(analysis: any) {
  if (!analysis) return analysis

  // 영문 데이터(원본)가 있는지 확인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const englishData = (analysis.translations as any)?.en || {
    summary: analysis.summaryEn || analysis.summary,
    tacticalAnalysis: analysis.tacticalAnalysisEn || analysis.tacticalAnalysis,
    recentFlowAnalysis: analysis.recentFlowAnalysisEn || analysis.recentFlowAnalysis,
    seasonTrends: analysis.seasonTrendsEn || analysis.seasonTrends,
    keyPoints: analysis.keyPointsEn || analysis.keyPoints
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTranslations = (analysis.translations as any) || {}
  let hasChanges = false
  const updatedTranslations = { ...currentTranslations, en: englishData }

  // 모든 언어에 대해 번역이 있는지 확인
  for (const lang of locales) {
    if (lang === 'en') continue
    
    if (!currentTranslations[lang]) {
      hasChanges = true
      console.log(`[Translate] Translating analysis to ${lang}...`)
      
      const [summary, tactical, flow, trends, keyPointsRaw] = await Promise.all([
        translateText(englishData.summary, lang as Locale, 'match summary'),
        englishData.tacticalAnalysis ? translateText(englishData.tacticalAnalysis, lang as Locale, 'tactical analysis') : Promise.resolve(null),
        englishData.recentFlowAnalysis ? translateText(englishData.recentFlowAnalysis, lang as Locale, 'recent form analysis') : Promise.resolve(null),
        englishData.seasonTrends ? translateText(englishData.seasonTrends, lang as Locale, 'season trends') : Promise.resolve(null),
        englishData.keyPoints ? translateText(JSON.stringify(englishData.keyPoints), lang as Locale, 'key match points JSON') : Promise.resolve(null)
      ])

      let keyPoints = englishData.keyPoints
      if (keyPointsRaw) {
        try {
          keyPoints = JSON.parse(keyPointsRaw)
        } catch {
          keyPoints = keyPointsRaw.split('\n').filter(Boolean)
        }
      }

      updatedTranslations[lang] = {
        summary,
        tacticalAnalysis: tactical,
        recentFlowAnalysis: flow,
        seasonTrends: trends,
        keyPoints
      }
    }
  }

  if (hasChanges) {
    await prisma.matchAnalysis.update({
      where: { id: analysis.id },
      data: { translations: updatedTranslations },
    })
    return { ...analysis, translations: updatedTranslations }
  }

  return analysis
}

/**
 * 데일리 리포트의 누락된 번역본을 채웁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureDailyReportTranslations(report: any) {
  if (!report) return report

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTranslations = (report.translations as any) || {}
  
  // 영문 데이터 추출
  let englishData = currentTranslations.en
  if (!englishData) {
    try {
      // 기존 summaryEn이 있으면 사용, 없으면 한국어 요약을 영어로 번역하여 원본으로 삼음
      if (report.summaryEn) {
        englishData = JSON.parse(report.summaryEn)
      } else {
        // 한국어 -> 영어 번역 로직 (최초 1회만)
        console.log('[Translate] Converting KO report to EN base...')
        const response = await openai?.chat.completions.create({
          model: AI_MODELS.SUMMARY,
          messages: [
            {
              role: 'system',
              content: 'Translate the provided JSON content from Korean to natural English. Return ONLY the translated JSON.'
            },
            { role: 'user', content: report.summary }
          ],
          response_format: { type: 'json_object' }
        })
        englishData = JSON.parse(response?.choices[0]?.message?.content || '{}')
      }
      currentTranslations.en = englishData
    } catch (e) {
      console.error('[Translate] Failed to establish EN base for report', e)
      return report
    }
  }

  let hasChanges = false
  const updatedTranslations = { ...currentTranslations }

  for (const lang of locales) {
    if (lang === 'en') continue
    
    if (!currentTranslations[lang]) {
      hasChanges = true
      console.log(`[Translate] Translating daily report to ${lang}...`)
      
      try {
        const response = await openai?.chat.completions.create({
          model: AI_MODELS.SUMMARY,
          messages: [
            {
              role: 'system',
              content: `Translate the provided JSON content from English to natural ${lang === 'ko' ? 'Korean' : lang === 'es' ? 'Spanish' : lang === 'ja' ? 'Japanese' : 'German'}. Return ONLY the translated JSON.`
            },
            { role: 'user', content: JSON.stringify(englishData) }
          ],
          response_format: { type: 'json_object' }
        })
        updatedTranslations[lang] = JSON.parse(response?.choices[0]?.message?.content || '{}')
      } catch (e) {
        console.error(`[Translate] Daily report translation to ${lang} failed:`, e)
      }
    }
  }

  if (hasChanges) {
    await prisma.dailyReport.update({
      where: { id: report.id },
      data: { translations: updatedTranslations },
    })
    return { ...report, translations: updatedTranslations }
  }

  return report
}

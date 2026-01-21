import { prisma } from '@/lib/prisma'
import { Locale, locales } from '@/i18n/config'
import translate from 'google-translate-api-x'

// 언어 코드 매핑 (i18n locale -> Google Translate 언어 코드)
const LANG_MAP: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  es: 'es',
  ja: 'ja',
  de: 'de',
}

/**
 * Google Translate (비공식 무료 API)를 사용하여 텍스트를 번역합니다.
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text || sourceLang === targetLang) return text
  if (text.trim().length === 0) return text

  const source = LANG_MAP[sourceLang] || sourceLang
  const target = LANG_MAP[targetLang] || targetLang

  try {
    const result = await translate(text, {
      from: source,
      to: target,
      autoCorrect: false,
    })

    return result.text || text
  } catch (error) {
    console.error(`[Translate] Google Translate failed:`, error)
    return text
  }
}

/**
 * 텍스트를 특정 언어로 번역합니다.
 */
export async function translateText(
  text: string,
  targetLang: Locale,
  _context?: string // 하위 호환성을 위해 유지 (사용 안 함)
): Promise<string> {
  if (!text || targetLang === 'en') return text
  return translateWithGoogle(text, 'en', targetLang)
}

/**
 * 여러 언어로 한꺼번에 번역하여 객체로 반환합니다.
 */
export async function translateToAllLocales(
  text: string,
  _context?: string,
  exclude: Locale[] = ['en']
): Promise<Record<string, string>> {
  const targetLocales = locales.filter(l => !exclude.includes(l as Locale))

  const translations: Record<string, string> = {}

  // 순차 번역 (Rate limit 방지)
  for (const lang of targetLocales) {
    translations[lang] = await translateText(text, lang as Locale)
    // Rate limit 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return translations
}

/**
 * 경기 분석 데이터의 누락된 번역본을 채웁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureMatchAnalysisTranslations(analysis: any) {
  if (!analysis) return analysis

  // 영문 데이터(원본)가 있는지 확인 (translations.en에서만 가져옴)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const englishData = (analysis.translations as any)?.en

  // 영문 데이터가 없으면 번역 불가
  if (!englishData?.summary) {
    console.warn('[Translate] No English data available for analysis')
    return analysis
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
      console.log(`[Translate] Translating analysis to ${lang} using Google Translate...`)

      try {
        // 각 필드를 순차적으로 번역 (Rate limit 방지)
        const summary = await translateText(englishData.summary, lang as Locale)
        await new Promise(resolve => setTimeout(resolve, 500))

        const tactical = englishData.tacticalAnalysis
          ? await translateText(englishData.tacticalAnalysis, lang as Locale)
          : null
        await new Promise(resolve => setTimeout(resolve, 500))

        const flow = englishData.recentFlowAnalysis
          ? await translateText(englishData.recentFlowAnalysis, lang as Locale)
          : null
        await new Promise(resolve => setTimeout(resolve, 500))

        const trends = englishData.seasonTrends
          ? await translateText(englishData.seasonTrends, lang as Locale)
          : null

        // keyPoints 배열 번역
        let keyPoints = englishData.keyPoints
        if (Array.isArray(englishData.keyPoints) && englishData.keyPoints.length > 0) {
          keyPoints = []
          for (const point of englishData.keyPoints) {
            await new Promise(resolve => setTimeout(resolve, 500))
            const translatedPoint = await translateText(point, lang as Locale)
            keyPoints.push(translatedPoint)
          }
        }

        updatedTranslations[lang] = {
          summary,
          tacticalAnalysis: tactical,
          recentFlowAnalysis: flow,
          seasonTrends: trends,
          keyPoints
        }
      } catch (error) {
        console.error(`[Translate] Failed to translate analysis to ${lang}:`, error)
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

  // 영문 데이터 추출 (translations.en에서만 가져옴)
  const englishData = currentTranslations.en
  if (!englishData) {
    console.warn('[Translate] No English data available for daily report')
    return report
  }

  let hasChanges = false
  const updatedTranslations = { ...currentTranslations }

  for (const lang of locales) {
    if (lang === 'en') continue

    if (!currentTranslations[lang]) {
      hasChanges = true
      console.log(`[Translate] Translating daily report to ${lang} using Google Translate...`)

      try {
        // JSON 객체의 각 문자열 필드를 번역
        const translatedData = await translateJsonObject(englishData, lang as Locale)
        updatedTranslations[lang] = translatedData
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

/**
 * JSON 객체 내의 모든 문자열을 번역합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function translateJsonObject(obj: any, targetLang: Locale): Promise<any> {
  if (!obj) return obj

  if (typeof obj === 'string') {
    return translateText(obj, targetLang)
  }

  if (Array.isArray(obj)) {
    const result = []
    for (const item of obj) {
      await new Promise(resolve => setTimeout(resolve, 300))
      result.push(await translateJsonObject(item, targetLang))
    }
    return result
  }

  if (typeof obj === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      await new Promise(resolve => setTimeout(resolve, 300))
      result[key] = await translateJsonObject(value, targetLang)
    }
    return result
  }

  return obj
}

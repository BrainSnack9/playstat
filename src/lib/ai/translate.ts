import { openai, AI_MODELS } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

/**
 * 한국어 텍스트를 영문으로 번역하고 DB에 캐싱합니다.
 * @param text 번역할 한국어 텍스트
 * @param context 컨텍스트 (예: 'match summary', 'team analysis')
 * @returns 번역된 텍스트
 */
export async function translateAndCache(
  text: string,
  context: string,
  updateCallback: (translatedText: string) => Promise<void>
): Promise<string> {
  if (!text) return ''
  if (!openai) return text

  try {
    console.log(`[Translate] Translating: ${context}...`)
    
    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY, // gpt-4o-mini 사용 (저렴함)
      messages: [
        {
          role: 'system',
          content: `You are a professional sports translator. Translate the following Korean ${context} into natural English. Keep the original meaning and technical terms. Use professional sports terminology.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    })

    const translated = response.choices[0]?.message?.content || text
    
    // DB 업데이트 (백그라운드에서 실행하지 않고 기다림 - 데이터 무결성 위해)
    await updateCallback(translated)
    
    return translated
  } catch (error) {
    console.error(`[Translate] Error translating ${context}:`, error)
    return text // 에러 시 원본 반환
  }
}

/**
 * 분석 객체의 누락된 영문 필드들을 번역하여 채웁니다.
 */
export async function ensureMatchAnalysisEnglish(analysis: any) {
  if (!analysis) return analysis

  const updatedData: any = {}
  let hasMissingEnglish = false
  
  // 각 필드별로 영문이 있는지 꼼꼼하게 체크합니다
  if (analysis.summary && !analysis.summaryEn) {
    hasMissingEnglish = true
    updatedData.summaryEn = await translateAndCache(analysis.summary, 'match summary', async () => {})
  }

  if (analysis.tacticalAnalysis && !analysis.tacticalAnalysisEn) {
    hasMissingEnglish = true
    updatedData.tacticalAnalysisEn = await translateAndCache(analysis.tacticalAnalysis, 'tactical analysis', async () => {})
  }

  if (analysis.recentFlowAnalysis && !analysis.recentFlowAnalysisEn) {
    hasMissingEnglish = true
    updatedData.recentFlowAnalysisEn = await translateAndCache(analysis.recentFlowAnalysis, 'recent form analysis', async () => {})
  }

  if (analysis.seasonTrends && !analysis.seasonTrendsEn) {
    hasMissingEnglish = true
    updatedData.seasonTrendsEn = await translateAndCache(analysis.seasonTrends, 'season trends', async () => {})
  }

  if (analysis.keyPoints && !analysis.keyPointsEn) {
    hasMissingEnglish = true
    const keyPointsStr = (analysis.keyPoints as string[]).join('\n')
    const translatedPointsStr = await translateAndCache(keyPointsStr, 'key match points', async () => {})
    updatedData.keyPointsEn = translatedPointsStr.split('\n').filter(Boolean)
  }

  // 수정할 내용이 없다면 바로 반환
  if (!hasMissingEnglish) return analysis

  // DB 업데이트
  if (Object.keys(updatedData).length > 0) {
    const result = await prisma.matchAnalysis.update({
      where: { id: analysis.id },
      data: updatedData,
    })
    return { ...analysis, ...result }
  }

  return analysis
}

/**
 * 데일리 리포트의 누락된 영문 필드들을 번역하여 채웁니다.
 */
export async function ensureDailyReportEnglish(report: any) {
  if (!report || report.summaryEn) return report

  try {
    const translatedSummary = await translateAndCache(
      report.summary,
      'daily report content (JSON)',
      async (t) => {}
    )

    if (translatedSummary) {
      await prisma.dailyReport.update({
        where: { id: report.id },
        data: { summaryEn: translatedSummary },
      })
      return { ...report, summaryEn: translatedSummary }
    }
  } catch (error) {
    console.error('[Translate] Daily report translation failed:', error)
  }

  return report
}

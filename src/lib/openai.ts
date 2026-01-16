import OpenAI from 'openai'

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined
}

function createOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured.')
    return null
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export const openai = globalForOpenAI.openai ?? createOpenAIClient()

if (process.env.NODE_ENV !== 'production' && openai) {
  globalForOpenAI.openai = openai
}

// Model configurations
export const AI_MODELS = {
  ANALYSIS: 'gpt-4o', // 경기 분석용
  SUMMARY: 'gpt-4o-mini', // 뉴스 요약 등 저비용 작업
} as const

// Token limits
export const TOKEN_LIMITS = {
  ANALYSIS: 2000,
  SUMMARY: 500,
  TEAM_ANALYSIS: 1500,
} as const

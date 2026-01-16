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

// Model configurations - 모든 작업에 gpt-4o-mini 사용 (비용 절감)
export const AI_MODELS = {
  ANALYSIS: 'gpt-4o-mini',
  SUMMARY: 'gpt-4o-mini',
} as const

// Token limits
export const TOKEN_LIMITS = {
  ANALYSIS: 2000,
  SUMMARY: 500,
  TEAM_ANALYSIS: 1500,
} as const

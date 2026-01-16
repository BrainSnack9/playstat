/**
 * API 호출 제한 관리자
 * Free Plan 제약: 하루 100회
 */

// 제한 설정
const RATE_LIMITS = {
  CALLS_PER_DAY: 100,
  DELAY_BETWEEN_CALLS_MS: 1000, // 최소 1초 간격
}

// 메모리 캐시 (최근 호출 시간)
let lastCallTime = 0

/**
 * API 호출 전 rate limit 체크 및 대기
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now()

  // 마지막 호출 이후 최소 대기 시간
  const timeSinceLastCall = now - lastCallTime
  if (timeSinceLastCall < RATE_LIMITS.DELAY_BETWEEN_CALLS_MS) {
    const waitTime = RATE_LIMITS.DELAY_BETWEEN_CALLS_MS - timeSinceLastCall
    await delay(waitTime)
  }

  lastCallTime = Date.now()
}

/**
 * API 호출 로깅 (DB에 기록)
 */
export async function logApiCall(
  apiType: 'football' | 'basketball' | 'baseball',
  endpoint: string,
  success: boolean = true,
  response?: unknown
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.apiCallLog.create({
      data: {
        apiType,
        endpoint,
        success,
        response: response ? JSON.parse(JSON.stringify(response)) : null,
      },
    })
  } catch (error) {
    console.error('Failed to log API call:', error)
  }
}

/**
 * 오늘 API 호출 횟수 조회
 */
export async function getDailyApiCalls(): Promise<number> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const count = await prisma.apiCallLog.count({
      where: {
        calledAt: {
          gte: startOfDay,
        },
        success: true,
      },
    })

    return count
  } catch {
    console.warn('Could not get daily API calls count')
    return 0
  }
}

/**
 * 일간 API 호출 가능 여부 체크
 */
export async function canMakeApiCall(): Promise<boolean> {
  const dailyCount = await getDailyApiCalls()
  return dailyCount < RATE_LIMITS.CALLS_PER_DAY
}

/**
 * 남은 API 호출 횟수 조회
 */
export async function getRemainingApiCalls(): Promise<number> {
  const dailyCount = await getDailyApiCalls()
  return Math.max(0, RATE_LIMITS.CALLS_PER_DAY - dailyCount)
}

/**
 * 지연 헬퍼 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * API 호출을 rate limit을 준수하면서 실행
 */
export async function executeWithRateLimit<T>(
  apiType: 'football' | 'basketball' | 'baseball',
  endpoint: string,
  apiCallFn: () => Promise<T>
): Promise<T> {
  // 일간 제한 체크
  const canCall = await canMakeApiCall()
  if (!canCall) {
    throw new Error('Daily API call limit reached (100/day)')
  }

  // Rate limit 대기
  await waitForRateLimit()

  try {
    const result = await apiCallFn()
    await logApiCall(apiType, endpoint, true)
    return result
  } catch (error) {
    await logApiCall(apiType, endpoint, false, { error: String(error) })
    throw error
  }
}

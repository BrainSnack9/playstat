/**
 * API 호출 제한 관리자
 * Free Plan 제약: 분당 10회, 월 약 2,000회
 */

// 제한 설정
const RATE_LIMITS = {
  CALLS_PER_MINUTE: 10,
  CALLS_PER_MONTH: 2000,
  DELAY_BETWEEN_CALLS_MS: 6500, // 10 calls/min = 6초 간격 + 여유
}

// 메모리 캐시 (최근 호출 시간)
let lastCallTime = 0
let callsInCurrentMinute = 0
let minuteResetTime = Date.now()

/**
 * API 호출 전 rate limit 체크 및 대기
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now()

  // 분당 카운터 리셋
  if (now - minuteResetTime > 60000) {
    callsInCurrentMinute = 0
    minuteResetTime = now
  }

  // 분당 제한 체크
  if (callsInCurrentMinute >= RATE_LIMITS.CALLS_PER_MINUTE) {
    const waitTime = 60000 - (now - minuteResetTime)
    console.log(`Rate limit reached. Waiting ${waitTime}ms...`)
    await delay(waitTime + 1000)
    callsInCurrentMinute = 0
    minuteResetTime = Date.now()
  }

  // 마지막 호출 이후 최소 대기 시간
  const timeSinceLastCall = now - lastCallTime
  if (timeSinceLastCall < RATE_LIMITS.DELAY_BETWEEN_CALLS_MS) {
    const waitTime = RATE_LIMITS.DELAY_BETWEEN_CALLS_MS - timeSinceLastCall
    await delay(waitTime)
  }

  lastCallTime = Date.now()
  callsInCurrentMinute++
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
 * 이번 달 API 호출 횟수 조회
 */
export async function getMonthlyApiCalls(): Promise<number> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const count = await prisma.apiCallLog.count({
      where: {
        calledAt: {
          gte: startOfMonth,
        },
        success: true,
      },
    })

    return count
  } catch {
    console.warn('Could not get monthly API calls count')
    return 0
  }
}

/**
 * 월간 API 호출 가능 여부 체크
 */
export async function canMakeApiCall(): Promise<boolean> {
  const monthlyCount = await getMonthlyApiCalls()
  return monthlyCount < RATE_LIMITS.CALLS_PER_MONTH
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
  // 월간 제한 체크
  const canCall = await canMakeApiCall()
  if (!canCall) {
    throw new Error('Monthly API call limit reached')
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

// 타임존 유틸리티

// 쿠키에서 타임존 가져오기 (서버 사이드)
export function getTimezoneFromCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return 'Asia/Seoul' // 기본값: 한국

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)

  return cookies['timezone'] || 'Asia/Seoul'
}

// 타임존 오프셋 계산 (분 단위)
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date()
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch {
    return 540 // 기본값: KST (UTC+9 = 540분)
  }
}

// 사용자 타임존 기준 오늘의 시작/끝 (UTC로 반환)
export function getTodayRangeInTimezone(timezone: string): { start: Date; end: Date } {
  const now = new Date()
  const offsetMinutes = getTimezoneOffset(timezone)

  // 사용자 타임존의 현재 시간
  const userNow = new Date(now.getTime() + offsetMinutes * 60 * 1000)

  // 사용자 타임존 기준 오늘 00:00:00 (UTC로 변환)
  const userMidnight = new Date(Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
    0, 0, 0, 0
  ))

  // UTC로 변환 (오프셋 빼기)
  const startUTC = new Date(userMidnight.getTime() - offsetMinutes * 60 * 1000)
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { start: startUTC, end: endUTC }
}

// 자주 사용하는 타임존 목록
export const COMMON_TIMEZONES = [
  { value: 'Asia/Seoul', label: '한국 (KST, UTC+9)' },
  { value: 'Asia/Tokyo', label: '일본 (JST, UTC+9)' },
  { value: 'Asia/Shanghai', label: '중국 (CST, UTC+8)' },
  { value: 'Europe/London', label: '영국 (GMT/BST)' },
  { value: 'Europe/Paris', label: '프랑스 (CET/CEST)' },
  { value: 'Europe/Berlin', label: '독일 (CET/CEST)' },
  { value: 'America/New_York', label: '미국 동부 (EST/EDT)' },
  { value: 'America/Los_Angeles', label: '미국 서부 (PST/PDT)' },
]

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

// 특정 날짜 기준 타임존 오프셋 계산 (분 단위)
export function getTimezoneOffsetAtDate(timezone: string, date: Date): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch {
    return getTimezoneOffset(timezone)
  }
}

// KST (UTC+9) 오프셋 (밀리초)
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 특정 날짜(또는 현재)를 UTC 기준 날짜로 변환하여 시작/끝 시간을 반환
 */
export function getUTCDayRange(date?: Date | string): { start: Date; end: Date; utcDate: Date } {
  const baseDate = date
    ? new Date(`${date}T00:00:00.000Z`)
    : new Date()

  const utcDateStart = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    0, 0, 0, 0
  ))
  const utcEnd = new Date(utcDateStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { start: utcDateStart, end: utcEnd, utcDate: utcDateStart }
}

/**
 * 특정 날짜(또는 현재)를 KST 기준 날짜로 변환하여 시작/끝 시간을 UTC로 반환
 */
export function getKSTDayRange(date?: Date | string): { start: Date; end: Date; kstDate: Date } {
  const baseDate = date ? new Date(date) : new Date()
  
  // 입력된 날짜를 KST로 변환
  const kstTime = new Date(baseDate.getTime() + KST_OFFSET_MS)

  // KST 기준 00:00:00 (UTC 시간으로는 -9시간)
  const kstDateStart = new Date(Date.UTC(
    kstTime.getUTCFullYear(),
    kstTime.getUTCMonth(),
    kstTime.getUTCDate(),
    0, 0, 0, 0
  ))
  const utcStart = new Date(kstDateStart.getTime() - KST_OFFSET_MS)

  // KST 기준 23:59:59.999
  const utcEnd = new Date(utcStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { start: utcStart, end: utcEnd, kstDate: kstTime }
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

// 사용자 타임존 기준 특정 날짜의 시작/끝 (UTC로 반환)
export function getDayRangeInTimezone(dateStr: string, timezone: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) {
    return getTodayRangeInTimezone(timezone)
  }

  const utcBase = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const offsetMinutes = getTimezoneOffsetAtDate(timezone, utcBase)
  const startUTC = new Date(utcBase.getTime() - offsetMinutes * 60 * 1000)
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

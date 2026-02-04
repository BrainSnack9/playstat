export const MATCH_STATUS_KEYS: Record<string, string> = {
  SCHEDULED: 'upcoming',
  TIMED: 'upcoming',
  LIVE: 'live',
  IN_PLAY: 'live',
  PAUSED: 'paused',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
}

// 데일리 리포트 날짜 범위 제한
// 이 범위 밖의 날짜는 DB 쿼리 없이 즉시 404 반환
export const DAILY_REPORT_DATE_RANGE = {
  // 데이터 수집 시작일 (이 날짜 이전은 데이터 없음)
  START_DATE: '2026-01-19',
  // 미래 날짜 허용 범위 (오늘 + N일)
  MAX_FUTURE_DAYS: 7,
}

/**
 * 데일리 리포트 날짜가 유효한 범위인지 확인
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @returns 유효하면 true, 범위 밖이면 false
 */
export function isValidDailyReportDate(dateStr: string): boolean {
  // 날짜 형식 검증
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) {
    return false
  }

  const date = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(date.getTime())) {
    return false
  }

  // 시작일 이전 체크
  const startDate = new Date(DAILY_REPORT_DATE_RANGE.START_DATE + 'T00:00:00Z')
  if (date < startDate) {
    return false
  }

  // 미래 날짜 체크 (오늘 + MAX_FUTURE_DAYS)
  const today = new Date()
  const maxDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + DAILY_REPORT_DATE_RANGE.MAX_FUTURE_DAYS))
  if (date > maxDate) {
    return false
  }

  return true
}

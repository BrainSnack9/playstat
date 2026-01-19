'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface LocalTimeProps {
  utcTime: Date | string
  formatStr?: string
  className?: string
  fallback?: string
}

/**
 * 클라이언트 사이드에서 UTC 시간을 사용자 로컬 시간대로 변환하여 표시
 * 브라우저의 Intl API를 사용하여 자동으로 사용자 타임존 적용
 */
export function LocalTime({
  utcTime,
  formatStr = 'HH:mm',
  className = '',
  fallback = '--:--'
}: LocalTimeProps) {
  const [localTime, setLocalTime] = useState<string>(fallback)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const date = new Date(utcTime)
      // date-fns format은 자동으로 로컬 타임존을 사용
      const formatted = format(date, formatStr)
      setLocalTime(formatted)
    } catch {
      setLocalTime(fallback)
    }
  }, [utcTime, formatStr, fallback])

  // SSR/hydration mismatch 방지: 서버에서는 fallback 표시
  if (!mounted) {
    return <span className={className}>{fallback}</span>
  }

  return <span className={className}>{localTime}</span>
}

interface LocalDateTimeProps {
  utcTime: Date | string
  dateFormat?: string
  timeFormat?: string
  className?: string
  separator?: string
}

/**
 * 날짜와 시간을 함께 표시 (예: "01/20 15:30")
 * timeFormat이 빈 문자열이면 날짜만 표시
 */
export function LocalDateTime({
  utcTime,
  dateFormat = 'MM/dd',
  timeFormat = 'HH:mm',
  className = '',
  separator = ' '
}: LocalDateTimeProps) {
  const fallback = timeFormat ? '--/-- --:--' : '--/--'
  const [localDateTime, setLocalDateTime] = useState<string>(fallback)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const date = new Date(utcTime)
      const dateStr = format(date, dateFormat)
      if (!timeFormat) {
        setLocalDateTime(dateStr)
      } else {
        const timeStr = format(date, timeFormat)
        setLocalDateTime(`${dateStr}${separator}${timeStr}`)
      }
    } catch {
      setLocalDateTime(fallback)
    }
  }, [utcTime, dateFormat, timeFormat, separator, fallback])

  if (!mounted) {
    return <span className={className}>{fallback}</span>
  }

  return <span className={className}>{localDateTime}</span>
}

/**
 * 풀 날짜/시간 표시 (예: "2026년 1월 20일 15:30" 또는 "January 20, 2026 15:30")
 * Intl.DateTimeFormat을 사용하여 로케일에 맞게 포맷
 */
interface LocalFullDateTimeProps {
  utcTime: Date | string
  locale?: string
  options?: Intl.DateTimeFormatOptions
  className?: string
}

export function LocalFullDateTime({
  utcTime,
  locale,
  options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
  className = '',
}: LocalFullDateTimeProps) {
  const [formattedTime, setFormattedTime] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const date = new Date(utcTime)
      const userLocale = locale || navigator.language
      const formatted = new Intl.DateTimeFormat(userLocale, options).format(date)
      setFormattedTime(formatted)
    } catch {
      setFormattedTime('')
    }
  }, [utcTime, locale, options])

  if (!mounted) {
    return <span className={className}>...</span>
  }

  return <span className={className}>{formattedTime}</span>
}

'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DAILY_REPORT_DATE_RANGE } from '@/lib/constants'
import { getDateLocale } from '@/lib/utils'
import type { SportId } from '@/lib/sport'

interface DailyDatePickerProps {
  currentDate: string // YYYY-MM-DD 형식
  sportId: SportId
  className?: string
}

export function DailyDatePicker({ currentDate, sportId, className }: DailyDatePickerProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('common')
  const [open, setOpen] = React.useState(false)

  // 현재 선택된 날짜
  const selectedDate = React.useMemo(() => {
    const date = new Date(currentDate + 'T00:00:00Z')
    // UTC 날짜를 로컬로 변환
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }, [currentDate])

  // 유효한 날짜 범위 계산
  const { minDate, maxDate } = React.useMemo(() => {
    const startDate = new Date(DAILY_REPORT_DATE_RANGE.START_DATE + 'T00:00:00Z')
    const min = new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())

    const today = new Date()
    const max = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + DAILY_REPORT_DATE_RANGE.MAX_FUTURE_DAYS
    )

    return { minDate: min, maxDate: max }
  }, [])

  // 날짜 선택 핸들러
  const handleSelect = (date: Date | undefined) => {
    if (!date) return

    // UTC 형식으로 변환 (YYYY-MM-DD)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    setOpen(false)
    router.push(`/${sportId}/daily/${dateStr}`)
  }

  // 날짜 포맷
  const formattedDate = React.useMemo(() => {
    try {
      return format(selectedDate, 'MMM d, yyyy', { locale: getDateLocale(locale) })
    } catch {
      return currentDate
    }
  }, [selectedDate, locale, currentDate])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal gap-2',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{formattedDate}</span>
          <span className="sm:hidden">{format(selectedDate, 'M/d')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => date < minDate || date > maxDate}
          defaultMonth={selectedDate}
          initialFocus
          classNames={{
            // 오늘 날짜 스타일 제거 (선택된 날짜만 강조)
            today: 'bg-transparent text-foreground',
          }}
        />
        <div className="border-t p-3 text-xs text-muted-foreground text-center">
          {t('available_date_range')}: {format(minDate, 'M/d')} - {format(maxDate, 'M/d')}
        </div>
      </PopoverContent>
    </Popover>
  )
}

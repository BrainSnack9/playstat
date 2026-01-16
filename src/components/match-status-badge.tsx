import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MatchStatusBadgeProps {
  status: string
  label: string
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  TIMED: 'bg-blue-500',
  LIVE: 'bg-red-500 animate-pulse',
  IN_PLAY: 'bg-red-500 animate-pulse',
  FINISHED: 'bg-gray-500',
  POSTPONED: 'bg-yellow-500',
  CANCELLED: 'bg-gray-400',
  SUSPENDED: 'bg-orange-500',
  PAUSED: 'bg-yellow-500',
}

export function MatchStatusBadge({ status, label, className }: MatchStatusBadgeProps) {
  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.SCHEDULED
  
  return (
    <Badge className={cn(statusClass, 'text-white border-none', className)}>
      {label}
    </Badge>
  )
}

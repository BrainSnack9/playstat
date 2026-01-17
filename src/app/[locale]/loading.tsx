'use client'

import { useTranslations } from 'next-intl'
import { Trophy } from 'lucide-react'

export default function Loading() {
  const t = useTranslations('common')

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center space-y-8 px-4">
      <div className="relative">
        {/* Outer Ring */}
        <div className="absolute inset-[-16px] animate-[spin_3s_linear_infinite] rounded-full border-2 border-t-primary border-r-transparent border-b-primary/20 border-l-transparent" />
        
        {/* Inner Ring */}
        <div className="absolute inset-[-8px] animate-[spin_2s_linear_infinite_reverse] rounded-full border-2 border-t-transparent border-r-primary border-b-transparent border-l-primary/20" />
        
        {/* Center Icon with Pulse */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]">
          <Trophy className="h-10 w-10 animate-bounce text-primary" />
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        </div>
      </div>

      <div className="flex flex-col items-center space-y-2 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          PlayStat
        </h2>
        <div className="flex items-center space-x-1.5">
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {t('loading_analysis')}
          </p>
          <div className="flex space-x-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

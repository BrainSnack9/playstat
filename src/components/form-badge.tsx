import React from 'react'

interface FormBadgeProps {
  form: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function FormBadge({ form, size = 'md' }: FormBadgeProps) {
  if (!form) return null

  // form이 "W,W,D,L,W" 형식이면 쉼표로 분리, 아니면 문자별로 분리
  const formArray = form.includes(',') ? form.split(',') : form.split('')

  const sizeClasses = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-[22px] w-[22px] text-[11px]',
    lg: 'h-6 w-6 text-xs',
  }

  return (
    <div className="flex gap-1">
      {formArray.slice(0, 5).map((result, i) => (
        <span
          key={i}
          className={`flex ${sizeClasses[size]} items-center justify-center rounded-full font-semibold transition-colors ${
            result === 'W'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : result === 'D'
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400'
              : result === 'L'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  )
}

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
    md: 'h-6 w-6 text-xs',
    lg: 'h-7 w-7 text-xs',
  }

  return (
    <div className="flex gap-1">
      {formArray.slice(0, 5).map((result, i) => (
        <span
          key={i}
          className={`flex ${sizeClasses[size]} items-center justify-center rounded font-bold text-white shadow-sm ${
            result === 'W'
              ? 'bg-green-500'
              : result === 'D'
              ? 'bg-gray-400'
              : result === 'L'
              ? 'bg-red-500'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  )
}

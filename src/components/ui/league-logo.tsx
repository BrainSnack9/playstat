import Image from 'next/image'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeagueLogoProps {
  logoUrl: string | null | undefined
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallbackClassName?: string
}

const sizeConfig = {
  xs: { dimension: 16, iconClass: 'h-3 w-3' },
  sm: { dimension: 20, iconClass: 'h-4 w-4' },
  md: { dimension: 32, iconClass: 'h-5 w-5' },
  lg: { dimension: 40, iconClass: 'h-6 w-6' },
  xl: { dimension: 48, iconClass: 'h-8 w-8' },
}

export function LeagueLogo({
  logoUrl,
  name,
  size = 'sm',
  className,
  fallbackClassName,
}: LeagueLogoProps) {
  const config = sizeConfig[size]

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={config.dimension}
        height={config.dimension}
        className={cn('object-contain', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded bg-muted',
        fallbackClassName
      )}
      style={{ width: config.dimension, height: config.dimension }}
    >
      <Trophy className={cn(config.iconClass, 'text-muted-foreground')} />
    </div>
  )
}

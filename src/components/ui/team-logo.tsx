import Image from 'next/image'
import { cn } from '@/lib/utils'

interface TeamLogoProps {
  logoUrl: string | null | undefined
  name: string
  shortName?: string | null
  tla?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallbackClassName?: string
  grayscale?: boolean
}

const sizeConfig = {
  xs: { dimension: 20, textClass: 'text-[8px]' },
  sm: { dimension: 28, textClass: 'text-[10px]' },
  md: { dimension: 36, textClass: 'text-xs' },
  lg: { dimension: 40, textClass: 'text-xs' },
  xl: { dimension: 56, textClass: 'text-lg' },
}

export function TeamLogo({
  logoUrl,
  name,
  shortName,
  tla,
  size = 'md',
  className,
  fallbackClassName,
  grayscale = false,
}: TeamLogoProps) {
  const config = sizeConfig[size]
  const abbreviation = tla || shortName || name.slice(0, 3).toUpperCase()

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={config.dimension}
        height={config.dimension}
        className={cn(
          'object-contain rounded',
          grayscale && 'grayscale opacity-70',
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-muted',
        fallbackClassName
      )}
      style={{ width: config.dimension, height: config.dimension }}
    >
      <span className={cn(config.textClass, 'font-bold text-muted-foreground')}>
        {abbreviation}
      </span>
    </div>
  )
}

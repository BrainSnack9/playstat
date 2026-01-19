'use client'

interface AdPlaceholderProps {
  slot: 'sidebar-left' | 'sidebar-right' | 'banner-top' | 'banner-bottom' | 'in-article'
  className?: string
}

/**
 * 광고 플레이스홀더 컴포넌트
 * 나중에 실제 애드센스 코드로 교체
 *
 * 사이드바 광고 크기:
 * - 160x600 (Wide Skyscraper)
 * - 300x600 (Half Page)
 *
 * 배너 광고 크기:
 * - 728x90 (Leaderboard)
 * - 970x90 (Large Leaderboard)
 * - 320x100 (Large Mobile Banner)
 */
export function AdPlaceholder({ slot, className = '' }: AdPlaceholderProps) {
  // 개발 환경에서만 플레이스홀더 표시
  if (process.env.NODE_ENV === 'production') {
    // 프로덕션에서는 실제 애드센스 코드가 들어갈 자리
    return (
      <div className={`ad-slot ad-${slot} ${className}`}>
        {/* 애드센스 코드 삽입 위치 */}
      </div>
    )
  }

  const sizeClasses: Record<string, string> = {
    'sidebar-left': 'w-[160px] min-h-[600px]',
    'sidebar-right': 'w-[160px] min-h-[600px]',
    'banner-top': 'w-full h-[90px]',
    'banner-bottom': 'w-full h-[90px]',
    'in-article': 'w-full h-[250px]',
  }

  return (
    <div
      className={`
        ${sizeClasses[slot]}
        ${className}
        bg-muted/30
        border-2 border-dashed border-muted-foreground/20
        rounded-lg
        flex items-center justify-center
        text-xs text-muted-foreground/50
      `}
    >
      AD: {slot}
    </div>
  )
}

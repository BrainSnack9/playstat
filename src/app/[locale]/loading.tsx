import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center space-y-4">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
      </div>
      <p className="animate-pulse text-sm font-medium text-muted-foreground">
        분석 데이터를 불러오는 중입니다...
      </p>
    </div>
  )
}

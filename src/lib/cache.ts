// 기본 캐시 유지 시간 (초)
// 일반적인 페이지는 1시간(3600초) 캐시를 권장합니다.
export const CACHE_REVALIDATE = 3600

// 데일리 리포트처럼 데이터가 거의 고정된 경우 더 긴 캐시 적용
export const DAILY_REPORT_REVALIDATE = 86400 // 24시간

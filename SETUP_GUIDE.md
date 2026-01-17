# PlayStat 프로젝트 설정 및 배포 가이드

이 문서는 PlayStat 프로젝트를 새로운 환경에 배포하거나 다른 사용자가 사용할 때 필수적으로 설정해야 할 내용을 담고 있습니다.

## 1. 필수 외부 서비스 가입 및 API 키 발급

프로젝트 작동을 위해 다음 서비스들의 계정과 API 키가 필요합니다.

1. **Football-Data.org**: [가입하기](https://www.football-data.org/)
   - 축구 경기 일정 및 결과 데이터를 가져오기 위한 API 키 (무료 플랜 가능)
2. **OpenAI API**: [플랫폼 접속](https://platform.openai.com/)
   - 경기 분석 및 다국어 번역 생성을 위한 API 키
3. **Supabase**: [가입하기](https://supabase.com/)
   - PostgreSQL 데이터베이스 호스팅
4. **Upstash**: [가입하기](https://upstash.com/)
   - Redis (캐싱 및 속도 최적화)
5. **cron-job.org**: [가입하기](https://cron-job.org/)
   - Vercel 무료 티어의 제한을 우회하여 실시간 점수 업데이트를 수행하기 위한 외부 크론 서비스

## 2. 환경 변수 (.env) 설정

Vercel 배포 시 또는 로컬 `.env` 파일에 다음 변수들을 반드시 등록해야 합니다.

```env
# Database (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Football Data API
FOOTBALL_DATA_API_KEY="your_api_key_here"

# OpenAI API
OPENAI_API_KEY="your_openai_key_here"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="your_token_here"

# Vercel Cron Secret (보안용)
# 아무 랜덤한 긴 문자열을 생성하여 입력하세요.
CRON_SECRET="your_random_secret_string"

# Next.js Config
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
```

## 3. 외부 크론(cron-job.org) 등록 방법 (필수)

Vercel 무료 티어는 크론 작업이 하루 1회로 제한됩니다. **실시간 점수 업데이트(10분 단위)**를 위해 다음 설정을 완료하세요.

1. **cron-job.org** 로그인 후 "Create Cron Job" 클릭
2. **URL**: `https://your-domain.com/api/cron/update-live-matches`
3. **Schedule**: `Every 10 minutes`
4. **HTTP Headers (중요)**:
   - Key: `Authorization`
   - Value: `Bearer [위에서 설정한 CRON_SECRET값]`
5. **저장** 및 활성화

## 4. 초기 데이터 수집 방법

배포 후 데이터가 비어있을 경우, 다음 주소를 브라우저에서 직접 호출하거나 수동 크론을 실행하세요 (보안 헤더 필요).

- `https://your-domain.com/api/cron/collect-matches?chain=true`
  - 이 주소는 경기 수집, 팀 데이터 갱신, AI 분석, 데일리 리포트 생성을 순차적으로 실행합니다.

## 5. 기타 설정

- **Vercel Analytics**: Vercel 대시보드 내 "Analytics" 탭에서 활성화 버튼만 누르면 자동 적용됩니다.
- **애드센스**: `public/ads.txt`에 본인의 정보를 입력하고, `src/app/[locale]/layout.tsx` 내의 Adsense ID를 본인 것으로 수정하세요.

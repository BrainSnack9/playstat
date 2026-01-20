# PlayStat - Multi-Sport Analytics Platform

PlayStat은 축구, 농구, 야구 데이터 분석을 제공하는 스포츠 인사이트 플랫폼입니다.

## 🏆 지원 스포츠

- ⚽ **축구 (Football)**: EPL, La Liga, Serie A, Bundesliga, Ligue 1
- 🏀 **농구 (Basketball)**: NBA
- ⚾ **야구 (Baseball)**: MLB

## 🚀 주요 기능

### 데이터 수집
- **BallDontLie API 통합**: 모든 스포츠 데이터를 단일 API로 통합 관리
- **자동 크론 작업**:
  - `collect-football`: EPL 및 주요 유럽 리그 데이터 수집
  - `collect-basketball`: NBA 경기 및 순위 데이터 수집
  - `collect-baseball`: MLB 경기 및 순위 데이터 수집
- **실시간 업데이트**: 경기 점수 및 상태 실시간 동기화

### AI 분석
- **GPT-4o 기반 경기 분석**: 객관적 데이터 기반 인사이트 생성
- **다국어 지원**: 한국어/영어 자동 번역 및 캐싱
- **Daily Report**: 날짜별 경기 종합 분석 리포트

### 성능 최적화
- **Multi-layer 캐싱**:
  - Next.js `unstable_cache`: 서버 메모리 캐시
  - Upstash Redis: 분산 환경 캐싱
- **SEO 최적화**: 동적 메타데이터 및 JSON-LD 구조화 데이터

## 📦 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase) + Prisma ORM
- **Cache**: Upstash Redis
- **AI**: OpenAI GPT-4o / GPT-4o-mini
- **API**: BallDontLie Sports API
- **i18n**: next-intl
- **UI**: Tailwind CSS + shadcn/ui

## 🛠️ 개발 환경 설정

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Database (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

# API Keys
OPENAI_API_KEY="sk-..."
BALLDONTLIE_API_KEY="..."

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Cron Secret
CRON_SECRET="..."

# Site URL
NEXT_PUBLIC_SITE_URL="https://playstat.space"
```

### 2. 의존성 설치

```bash
npm install
# or
pnpm install
```

### 3. 데이터베이스 마이그레이션

```bash
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

포트: `http://localhost:3030`

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── [locale]/           # 다국어 라우팅
│   │   ├── football/       # 축구 페이지
│   │   ├── basketball/     # 농구 페이지
│   │   ├── baseball/       # 야구 페이지
│   │   └── daily/[date]/   # Daily Report
│   └── api/
│       └── cron/           # 크론 작업
│           ├── collect-football/
│           ├── collect-basketball/
│           └── collect-baseball/
├── lib/
│   ├── api/
│   │   └── balldontlie.ts  # BallDontLie API 클라이언트
│   ├── ai/
│   │   └── prompts.ts      # AI 분석 프롬프트
│   └── prisma.ts           # Prisma 클라이언트
└── components/             # React 컴포넌트
```

## 🔄 크론 작업

PlayStat은 각 스포츠별로 **5가지 크론 작업**을 운영합니다:

### 1. Collect Matches (경기 수집)
```bash
GET /api/cron/collect-football
GET /api/cron/collect-basketball
GET /api/cron/collect-baseball
Authorization: Bearer {CRON_SECRET}
```

### 2. Collect Team Data (팀 데이터 수집)
```bash
GET /api/cron/collect-team-data?sport={football|basketball|baseball}
Authorization: Bearer {CRON_SECRET}
```

### 3. Generate Analysis (AI 분석 생성)
```bash
GET /api/cron/generate-analysis?sport={football|basketball|baseball}
Authorization: Bearer {CRON_SECRET}
```

### 4. Generate Daily Report (데일리 리포트 생성)
```bash
GET /api/cron/generate-daily-report?sport={football|basketball|baseball}
Authorization: Bearer {CRON_SECRET}
```

### 5. Update Live Matches (실시간 스코어 업데이트)
```bash
GET /api/cron/update-live-matches?sport={football|basketball|baseball}
Authorization: Bearer {CRON_SECRET}
```

**Rate Limiting**: BallDontLie Free Tier는 분당 5회 요청 제한이 있으므로, 크론 작업은 13초 간격으로 실행됩니다.

## 📝 API 사용법

### BallDontLie API 통합

```typescript
import { ballDontLieApi } from '@/lib/api/balldontlie'

// 축구
const eplTeams = await ballDontLieApi.getSoccerTeams('epl')
const eplGames = await ballDontLieApi.getSoccerGames('epl', {
  season: 2024,
  start_date: '2024-01-01',
  end_date: '2024-01-31'
})

// 농구
const nbaTeams = await ballDontLieApi.getTeams()
const nbaGames = await ballDontLieApi.getGamesByDateRange('2024-01-01', '2024-01-31')

// 야구
const mlbTeams = await ballDontLieApi.getBaseballTeams()
const mlbGames = await ballDontLieApi.getBaseballGames({
  season: 2024,
  start_date: '2024-04-01',
  end_date: '2024-04-30'
})
```

## 🚨 중요 규칙

### 콘텐츠 정책 (애드센스 준수)
- ❌ **절대 금지**: 승부 예측, 배팅 추천, 배당률 분석, 도박 조장
- ✅ **허용**: 객관적 데이터 분석, 팀/선수 통계, 최근 폼 분석

### AI 분석 가이드라인
- 데이터 기반 객관적 분석만 제공
- "A팀이 이길 것이다" 같은 예측 금지
- "최근 5경기에서 4승 1무" 같은 사실 위주 작성

## 📊 성능 지표

- **캐시 적용**: `unstable_cache` + Redis 이중 캐싱
- **Revalidate 주기**:
  - 일반 데이터: 1시간 (3600초)
  - Daily Report: 24시간 (86400초)
- **API 호출 최적화**: Rate limiting 준수 (분당 5회)

## 🌐 배포

### Vercel 배포
```bash
vercel --prod
```

### 환경 변수 설정
Vercel Dashboard에서 모든 환경 변수를 설정하세요.

### 크론 작업 설정

**모든 크론 작업은 GitHub Actions로 실행됩니다.**

#### GitHub Actions 설정

1. **GitHub Secrets 설정**:
   - `SITE_URL`: 배포된 사이트 URL (예: `https://playstat.space`)
   - `CRON_SECRET`: 크론 인증 시크릿

2. **자동 실행**: `.github/workflows/data-collection.yml`
   - ⚽ Football: 매일 01:00 UTC (KST 10:00)
   - 🏀 Basketball: 매일 02:00 UTC (KST 11:00)
   - ⚾ Baseball: 매일 03:00 UTC (KST 12:00)

3. **수동 실행**:
   - GitHub 저장소 > Actions > "Data Collection Cron Jobs"
   - "Run workflow" 버튼 클릭
   - 원하는 스포츠 선택 (football/basketball/baseball/all)

#### 전체 크론 스케줄

각 스포츠는 **5개의 순차적인 작업**을 실행합니다 (15초 간격):

| 스포츠 | 실행 시간 (UTC) | 작업 내용 |
|--------|-----------------|-----------|
| ⚽ Football | 01:00 | 1. Collect Matches → 2. Collect Team Data → 3. Generate Analysis → 4. Generate Daily Report → 5. Update Live Matches |
| 🏀 Basketball | 02:00 | 1. Collect Matches → 2. Collect Team Data → 3. Generate Analysis → 4. Generate Daily Report → 5. Update Live Matches |
| ⚾ Baseball | 03:00 | 1. Collect Matches → 2. Collect Team Data → 3. Generate Analysis → 4. Generate Daily Report → 5. Update Live Matches |

#### Vercel 설정

`vercel.json`의 `crons` 배열은 비어있습니다. 모든 크론 작업은 GitHub Actions에서 실행됩니다.

## 📖 추가 문서

- [CLAUDE.md](CLAUDE.md): Claude Code 개발 가이드라인
- [TODO-BASKETBALL.md](TODO-BASKETBALL.md): 농구 기능 개발 체크리스트

## 🤝 기여

이슈 및 PR은 언제든 환영합니다!

## 📄 라이선스

MIT License

---

**Built with ❤️ using Next.js, TypeScript, and BallDontLie API**

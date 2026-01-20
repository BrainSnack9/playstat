# GitHub Actions Workflows

PlayStat 프로젝트의 GitHub Actions 워크플로우 설명입니다.

## 📋 워크플로우 목록

### 1. Data Collection Cron Jobs (`data-collection.yml`)

**목적**: 스포츠 데이터 자동 수집 및 분석

**스케줄**:
- ⚽ Football: 매일 01:00 UTC (KST 10:00)
- 🏀 Basketball: 매일 02:00 UTC (KST 11:00)
- ⚾ Baseball: 매일 03:00 UTC (KST 12:00)

**수동 실행**:
```bash
# GitHub UI에서 Actions > Data Collection Cron Jobs > Run workflow
# 또는 gh CLI 사용:
gh workflow run data-collection.yml -f sport=all
gh workflow run data-collection.yml -f sport=football
gh workflow run data-collection.yml -f sport=basketball
gh workflow run data-collection.yml -f sport=baseball
```

**필요한 Secrets**:
- `SITE_URL`: 배포된 사이트 URL (예: `https://playstat.space`)
- `CRON_SECRET`: 크론 API 인증 토큰

**동작 방식**:
각 스포츠별로 **5개의 순차적인 작업**을 15초 간격으로 실행합니다:

1. **Collect Matches**: 경기 일정 및 결과 수집
   - 엔드포인트: `/api/cron/collect-{sport}`
   - Football: EPL, La Liga, Serie A, Bundesliga, Ligue 1
   - Basketball: NBA
   - Baseball: MLB

2. **Collect Team Data**: 팀 시즌 스탯 및 순위표 수집
   - 엔드포인트: `/api/cron/collect-team-data?sport={sport}`
   - 7일 이내 예정된 경기의 팀 데이터만 수집

3. **Generate Analysis**: AI 기반 경기 분석 생성
   - 엔드포인트: `/api/cron/generate-analysis?sport={sport}`
   - 48시간 이내 경기에 대한 GPT-4o 분석

4. **Generate Daily Report**: 데일리 리포트 생성
   - 엔드포인트: `/api/cron/generate-daily-report?sport={sport}`
   - 오늘/내일 경기 종합 리포트

5. **Update Live Matches**: 실시간 스코어 업데이트
   - 엔드포인트: `/api/cron/update-live-matches?sport={sport}`
   - 진행 중이거나 당일 경기의 점수 및 상태 업데이트

### 2. Manual Data Collection Trigger (`manual-trigger.yml`)

**목적**: 수동으로 데이터 수집 트리거

**기능**:
- 원하는 스포츠 선택 (football/basketball/baseball/all)
- Chain 옵션 설정 (후속 작업 실행 여부)
- All 선택 시 모든 스포츠 순차 실행 (Rate limiting 고려하여 15초 간격)

**사용법**:
```bash
# GitHub UI에서 Actions > Manual Data Collection Trigger > Run workflow
# 스포츠 선택 + Chain 옵션 선택
```

**특징**:
- 실행 결과를 JSON으로 출력
- HTTP 상태 코드 확인
- 각 요청 사이 15초 대기 (BallDontLie API Rate Limiting 준수)

### 3. API Health Check (`health-check.yml`)

**목적**: API 및 사이트 상태 모니터링

**스케줄**: 매시간 실행

**체크 항목**:
- ✅ PlayStat 사이트 Health Check
- ✅ BallDontLie Football API 상태
- ✅ BallDontLie Basketball API 상태
- ✅ BallDontLie Baseball API 상태

**수동 실행**:
```bash
gh workflow run health-check.yml
```

## 🔐 Required Secrets 설정

GitHub 저장소 Settings > Secrets and variables > Actions에서 설정:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SITE_URL` | 배포된 사이트 URL | `https://playstat.space` |
| `CRON_SECRET` | 크론 API 인증 토큰 | `.env` 파일의 `CRON_SECRET` 값 |

## 🚨 중요 사항

### Rate Limiting
BallDontLie Free Tier는 **분당 5회 요청 제한**이 있습니다:
- 각 크론 작업이 1시간 간격으로 실행되도록 스케줄됨
- Manual Trigger에서 "all" 선택 시 15초 간격으로 실행
- 크론 내부에서도 13초 딜레이 적용

### GitHub Actions Only

**모든 크론 작업은 GitHub Actions에서 실행됩니다**:
- ⚽ Football: EPL, La Liga, Serie A, Bundesliga, Ligue 1
- 🏀 Basketball: NBA
- ⚾ Baseball: MLB
- Health Check (별도 워크플로우)

**Vercel Cron**: 사용하지 않음 (`vercel.json`의 `crons` 배열은 비어있음)

## 📊 모니터링

### 워크플로우 실행 확인
```bash
# 최근 워크플로우 실행 확인
gh run list --workflow=data-collection.yml

# 특정 실행 로그 보기
gh run view <run-id>
```

### 실패 시 대응
1. GitHub Actions 탭에서 실패한 워크플로우 확인
2. 로그에서 에러 메시지 확인
3. API Rate Limit 초과 시 → 다음 시간까지 대기
4. 인증 실패 시 → Secrets 확인

## 🔧 트러블슈팅

### 401 Unauthorized
- `CRON_SECRET`이 올바르게 설정되었는지 확인
- Vercel 환경 변수와 동일한 값인지 확인

### 429 Rate Limit Exceeded
- BallDontLie API 제한 초과
- 13분 후 재시도

### Workflow Not Triggering
- 저장소가 Public인지 확인 (Private는 별도 설정 필요)
- cron 표현식 검증
- GitHub Actions 활성화 확인

## 📝 워크플로우 수정

워크플로우 파일 수정 후:
```bash
git add .github/workflows/
git commit -m "Update workflow"
git push
```

변경사항은 즉시 반영되며, 다음 스케줄 시간 또는 수동 실행 시 적용됩니다.

---

**Built for PlayStat Multi-Sport Analytics Platform**

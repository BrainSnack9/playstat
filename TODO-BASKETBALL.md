# NBA 농구 기능 남은 작업

## 완료된 작업 ✅

1. **BallDontLie API 연동** - `src/lib/api/balldontlie.ts`
2. **농구 크론 작업** - `src/app/api/cron/collect-basketball/route.ts`
3. **NBA 팀 30개 정리** (불필요한 역사적 팀 삭제)
4. **리그 페이지 컨퍼런스 탭** (East/West)
5. **순위표 UI 개선** (메달, 중앙정렬, 번역)
6. **FormBadge 디자인 개선** (파스텔 컬러)
7. **데일리 리포트 날짜 수정** (KST → UTC 기준)
8. **스포츠별 타이틀 번역** (basketball_analysis_title, baseball_analysis_title)

## 남은 작업 🔧

### 1. 데일리 리포트 재생성 테스트
- 서버 재시작 후 농구 데일리 리포트 생성 테스트 필요
- `curl -X GET "http://localhost:3030/api/cron/generate-daily-report?sport=basketball&date=2026-01-19" -H "Authorization: Bearer {CRON_SECRET}"`

### 2. 기존 데이터 정리 (선택)
- DB에 남아있는 잘못된 날짜의 농구 데일리 리포트가 있을 수 있음
- UTC 기준으로 변경되었으므로 이전 KST 기준 데이터와 불일치 가능

### 3. 확인 필요 사항
- [ ] 농구 데일리 리포트 페이지에서 "축구" 대신 "NBA"로 표시되는지 확인
- [ ] 날짜 클릭 시 올바른 날짜의 리포트가 표시되는지 확인
- [ ] 컨퍼런스별 순위표가 정상 동작하는지 확인

### 4. 향후 고려 사항
- MLB 야구 지원 추가 (동일한 패턴으로)
- 농구 경기 분석 AI 프롬프트 최적화
- 농구용 트렌드 메시지 추가 (연승/연패 등)

## 관련 파일

- `src/app/api/cron/collect-basketball/route.ts` - 농구 데이터 수집
- `src/app/api/cron/generate-daily-report/route.ts` - 데일리 리포트 생성
- `src/app/[locale]/daily/[date]/page.tsx` - 데일리 리포트 페이지
- `src/app/[locale]/league/[slug]/page.tsx` - 리그 상세 페이지
- `src/lib/api/balldontlie.ts` - BallDontLie API 클라이언트
- `messages/*.json` - 번역 파일들

## 테스트 명령어

```bash
# 농구 데이터 수집
curl -X GET "http://localhost:3030/api/cron/collect-basketball" -H "Authorization: Bearer {CRON_SECRET}"

# 농구 데일리 리포트 생성
curl -X GET "http://localhost:3030/api/cron/generate-daily-report?sport=basketball&date=2026-01-19" -H "Authorization: Bearer {CRON_SECRET}"

# 농구 경기 분석 생성
curl -X GET "http://localhost:3030/api/cron/generate-analysis?sport=basketball" -H "Authorization: Bearer {CRON_SECRET}"
```

---
마지막 업데이트: 2026-01-19

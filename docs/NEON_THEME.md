# PlayStat Neon Theme (Common Guide)

이 문서는 PlayStat 랜딩에 적용한 네온 스타일을 **다른 서비스에 재사용**할 수 있도록 정리한 공통 테마 가이드입니다.

## 1) 컬러 팔레트

- **Base BG**: `#0b0f14`
- **Surface**: `rgba(255,255,255,0.05)` (Tailwind: `bg-white/5`)
- **Border**: `rgba(255,255,255,0.10)` (Tailwind: `border-white/10`)
- **Muted Text**: `rgba(255,255,255,0.60~0.70)` (`text-white/60`, `text-white/70`)
- **Primary Neon**: `#A3FF12` (Tailwind: `text-lime-300`, `bg-lime-400`)
- **Accent Neon**: `#3CF2FF` (Tailwind: `text-cyan-300`)
- **Secondary Neon**: `#10B981` (Tailwind: `text-emerald-300`)

## 2) 타이포그래피

- **Display/Title**: Orbitron
- **Body/UI**: Space Grotesk
- **톤**: 대문자/트래킹 강조 (예: `tracking-[0.2em]`)

## 3) 레이아웃/컴포넌트 스타일

### Card / Panel
- 기본: `rounded-2xl border border-white/10 bg-white/5`
- 글로우: `shadow-[0_0_24px_rgba(163,255,18,0.12)]`
- 상단 라인: `bg-gradient-to-r from-lime-300/60 via-white/10 to-transparent`

### Button (Primary)
- `bg-gradient-to-r from-lime-300 to-lime-400`
- `text-black`
- `shadow-[0_0_24px_rgba(163,255,18,0.25)]`

### Button (Outline)
- `border-white/30 text-white hover:bg-white/10`

### Section Background
- `bg-[#0b0f14]` + `border-white/10`
- 부드러운 블러 점광: `bg-lime-400/10`, `bg-cyan-400/10`

## 4) 타임라인 패턴

- **라인**: `absolute left-3 top-6 bottom-6 w-px bg-white/10`
- **넘버 노드**: `rounded-full border border-lime-300/40 bg-black text-lime-300`
- **카드 오프셋**: `ml-10`

## 5) 스포츠 카드 네온 포인트

- 카드: `border-[color]/20 + shadow glow`
- 타이틀 텍스트: 네온 컬러 적용
  - Football: `text-lime-300`
  - Basketball: `text-cyan-300`
  - Baseball: `text-emerald-300`

## 6) 푸터

- 랜딩 전용 배경: `bg-[#0b0f14]`
- 폰트: Space Grotesk 통일

## 7) 이미지 가이드

- **Hero 배너**: 가로형(배너), 최소 1600px 이상 권장
- **카드 썸네일**: 16:9 또는 4:3
- **톤**: 다크/네온/테크 느낌

## 8) 적용 예시 (Tailwind 조합)

```txt
Container: bg-[#0b0f14] text-white
Card: rounded-2xl border border-white/10 bg-white/5
Neon title: text-lime-300 uppercase tracking-[0.2em]
Glow: shadow-[0_0_24px_rgba(163,255,18,0.12)]
```

---

필요하면 이 문서를 기반으로 **다른 서비스 테마 CSS/Token 파일**로 추출해줄 수 있습니다.

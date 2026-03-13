# Unified Workspace Design Guideline

토스증권(tossinvest.com) 디자인 시스템을 기반으로 실제 사이트에서 추출한 정확한 디자인 토큰.

> **중요**: 브랜드 컬러는 `#3182f6`입니다. `#0064FF`는 잘못된 값입니다.

## 디자인 원칙

1. **Spacious** - 충분한 여백으로 콘텐츠에 집중
2. **Clean** - 불필요한 장식 제거, 데이터 중심
3. **Consistent** - 일관된 토큰 사용
4. **Accessible** - WCAG 접근성 준수

---

## Color Tokens

### Brand Blue (브랜드 컬러)

> 기본 브랜드 컬러는 **blue500 = `#3182f6`** 입니다.

| Token | Hex | Usage |
|-------|-----|-------|
| `blue50` | `#e8f3ff` | 브랜드 배경, 선택 상태 |
| `blue100` | `#c9e2ff` | 연한 브랜드 배경 |
| `blue200` | `#90c2ff` | 비활성 브랜드 요소 |
| `blue300` | `#64a8ff` | 보조 브랜드 요소 |
| `blue400` | `#4593fc` | 호버 보조 |
| `blue500` | `#3182f6` | **Primary — 버튼, 링크, 활성 상태** |
| `blue600` | `#2272eb` | 프라이머리 버튼 호버 |
| `blue700` | `#1b64da` | 프라이머리 버튼 액티브 |
| `blue800` | `#1957c2` | 강조 블루 |
| `blue900` | `#194aa6` | 다크 블루 |

### Grey Scale (그레이 팔레트)

| Token | Hex | Usage |
|-------|-----|-------|
| `grey50` | `#f9fafb` | 테이블 헤더 배경 |
| `grey100` | `#f2f4f6` | 섹션 배경, 입력 필드 배경 |
| `grey200` | `#e5e8eb` | 기본 보더, 구분선 |
| `grey300` | `#d1d6db` | 강조 보더 |
| `grey400` | `#b0b8c1` | 비활성 텍스트 |
| `grey500` | `#8b95a1` | 보조 텍스트, 플레이스홀더 |
| `grey600` | `#6b7684` | 비활성 네비 링크 |
| `grey700` | `#4e5968` | 부제목, 설명 |
| `grey800` | `#333d4b` | 활성 네비 링크, 강조 본문 |
| `grey900` | `#191f28` | 제목, 주요 본문 |

### Grey Opacity Scale (반투명 그레이)

| Token | Value | Usage |
|-------|-------|-------|
| `greyOpacity50` | `rgba(0,23,51,0.02)` | 최소 오버레이 |
| `greyOpacity100` | `rgba(2,32,71,0.05)` | 필터 pill 배경, 검색 입력 배경 |
| `greyOpacity200` | `rgba(0,27,55,0.10)` | 카드 배경 |
| `greyOpacity300` | `rgba(0,29,58,0.18)` | 구분 요소 |
| `greyOpacity400` | `rgba(0,25,54,0.31)` | 중간 오버레이 |
| `greyOpacity500` | `rgba(3,24,50,0.46)` | 강조 오버레이 |
| `greyOpacity600` | `rgba(0,19,43,0.58)` | 짙은 오버레이 |
| `greyOpacity700` | `rgba(3,18,40,0.70)` | 헤비 오버레이 |
| `greyOpacity800` | `rgba(0,12,30,0.80)` | 거의 불투명 오버레이 |
| `greyOpacity900` | `rgba(2,9,19,0.91)` | 스크림 |

### Semantic Colors (의미 색상)

| Token | Hex | Usage |
|-------|-----|-------|
| `red500` | `#f04452` | 하락, 에러, 삭제 |
| `red50` | `#ffeeee` | 에러 배경 |
| `green500` | `#03b26c` | 상승, 성공, 완료 |
| `green50` | `#f0faf6` | 성공 배경 |
| `orange500` | `#fe9800` | 경고, 진행중 |
| `orange50` | `#fff3e0` | 경고 배경 |

### Background Tokens (배경 토큰)

| Token | Hex | Usage |
|-------|-----|-------|
| `backgroundScreen` | `#f6f7f9` | 전체 화면 배경 |
| `background` | `#ffffff` | 카드, 기본 배경 |
| `greyBackground` | `#f2f4f6` | 섹션 배경 (`grey100`과 동일) |
| `tableBackground` | `#f9fafb` | 테이블 헤더 (`grey50`과 동일) |
| `backgroundDimmed` | `rgba(0,0,0,0.20)` | 딤드 배경 (모달 오버레이) |
| `floatBackground` | `#ffffff` | 플로팅 요소 (드롭다운, 툴팁) |
| `hairlineBorder` | `#e5e8eb` | 기본 보더 (`grey200`과 동일) |

### Text Colors (텍스트 색상)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#191f28` | 제목, 주요 본문 (`grey900`) |
| `--color-text-secondary` | `#4e5968` | 부제목, 설명 (`grey700`) |
| `--color-text-tertiary` | `#8b95a1` | 보조 텍스트, 플레이스홀더 (`grey500`) |
| `--color-text-disabled` | `#b0b8c1` | 비활성 텍스트 (`grey400`) |
| `--color-text-on-color` | `#ffffff` | 컬러 배경 위 텍스트 |

### Sidebar (다크 사이드바)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-sidebar-bg` | `#17171c` | 사이드바 배경 |
| `--color-sidebar-hover` | `#2c2c35` | 호버 상태 |
| `--color-sidebar-active` | `#3182f6` | 활성 항목 (blue500) |
| `--color-sidebar-text` | `#8b8b99` | 비활성 텍스트 |
| `--color-sidebar-text-active` | `#ffffff` | 활성 텍스트 |

---

## Typography

### Font Stack

```css
font-family: "Toss Product Sans", "Tossface", -apple-system, BlinkMacSystemFont,
  "Bazier Square", "Noto Sans KR", "Segoe UI", "Apple SD Gothic Neo",
  Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Font Weights

| Name | Value |
|------|-------|
| regular | 400 |
| medium | 500 |
| semibold | 600 |
| bold | 700 |

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display` | 32px | 700 | 1.3 | 페이지 제목 |
| `title-1` | 24px | 700 | 1.3 | 섹션 제목 |
| `title-2` | 20px | 600 | 1.4 | 카드 제목 |
| `title-3` | 17px | 600 | 1.4 | 소제목 |
| `body-1` | 15px | 400 | 1.6 | 본문 |
| `body-2` | 14px | 400 | 1.5 | 부가 텍스트 |
| `caption-1` | 13px | 400 | 1.4 | 캡션 |
| `caption-2` | 12px | 500 | 1.3 | 배지, 라벨 |
| `overline` | 11px | 600 | 1.3 | 오버라인 |

---

## Spacing

기본 단위: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | 최소 간격 |
| `space-2` | 8px | 아이콘-텍스트 간격 |
| `space-3` | 12px | 작은 내부 패딩 |
| `space-4` | 16px | 기본 패딩 |
| `space-5` | 20px | 카드 내부 패딩 |
| `space-6` | 24px | 섹션 간격 |
| `space-8` | 32px | 큰 섹션 간격 |
| `space-10` | 40px | 페이지 패딩 |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | 배지, 태그 |
| `radius-md` | 8px | 버튼, 입력 필드, 필터 pill |
| `radius-lg` | 12px | 카드 |
| `radius-xl` | 16px | 모달 |
| `radius-full` | 9999px | 아바타, 원형 요소 |

> 이전 값 대비 변경: 버튼/입력은 10px → **8px**, 카드는 16px → **12px**, 모달은 20px → **16px**

---

## Shadows

블루-그레이 계열의 현실적 그림자 사용 (검정 계열 그림자 사용 금지).

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,23,51,0.02)` | 미세한 깊이 |
| `shadow-md` | `0 2px 8px rgba(2,32,71,0.05), 0 1px 2px rgba(0,23,51,0.02)` | 카드 기본 |
| `shadow-lg` | `0 4px 16px rgba(2,32,71,0.05), 0 2px 8px rgba(0,23,51,0.02)` | 카드 호버, 드롭다운 |
| `shadow-xl` | `0 8px 32px rgba(2,32,71,0.08), 0 4px 16px rgba(0,23,51,0.04)` | 모달 |

---

## Components

### Navigation (네비게이션 바)

- 높이: **52px**
- 배경: transparent (스크롤 전) / `#ffffff` (스크롤 후)
- 활성 링크: 15px / 700 / `grey800` (#333d4b), padding 6px 12px
- 비활성 링크: 15px / 500 / `grey600` (#6b7684), padding 6px 12px

### Card (카드)

- 배경: `background` (#ffffff)
- 보더: none (그림자로 깊이 표현)
- Border Radius: `radius-lg` (**12px**)
- Padding: 20px ~ 24px
- Shadow: `shadow-md`
- Hover: `shadow-lg` (인터랙티브한 경우)

### Button (버튼)

#### Primary
- 배경: `blue500` (**#3182f6**)
- 텍스트: #ffffff
- Border Radius: `radius-md` (**8px**)
- Padding: 6px 12px
- Font: 14px / 600
- Hover: `blue600` (#2272eb)
- Active: `blue700` (#1b64da)

#### Secondary
- 배경: `grey100` (#f2f4f6)
- 텍스트: `grey900` (#191f28)
- Border Radius: `radius-md` (8px)
- Hover: `grey200` (#e5e8eb)

#### Ghost
- 배경: transparent
- 텍스트: `grey700` (#4e5968)
- Hover: `grey100` (#f2f4f6)

### Filter Pill (필터 버튼)

- 배경: `greyOpacity100` (rgba(2,32,71,0.05))
- Border Radius: `radius-md` (8px)
- 높이: 32px
- Font: 14px / 600
- 활성 상태: `blue50` (#e8f3ff) + `blue500` (#3182f6) 텍스트

### Input / Search (입력 필드)

- 배경: `greyOpacity100` (rgba(2,32,71,0.05))
- 보더: none (기본), `blue500` 2px ring (포커스)
- Border Radius: `radius-md` (**8px**)
- 높이: 32px (소형 / 검색), 44px (기본)
- Padding: 8px 12px
- Font: 14px / 400
- Placeholder: `grey500` (#8b95a1)

### Badge / Tag (배지)

- Border Radius: `radius-sm` (6px)
- Padding: 2px 8px
- Font: 12px / 500
- Variants:
  - brand: `blue50` 배경 + `blue600` 텍스트
  - positive: `green50` 배경 + `green500` 텍스트
  - negative: `red50` 배경 + `red500` 텍스트
  - warning: `orange50` 배경 + `orange500` 텍스트
  - neutral: `grey100` 배경 + `grey700` 텍스트

### Table (테이블)

- 헤더 배경: `tableBackground` (#f9fafb)
- 헤더 텍스트: `grey500` (#8b95a1), 12px / 500
- 행 호버: `grey50` (#f9fafb)
- 구분선: `grey200` (#e5e8eb), 1px
- 셀 패딩: 12px 16px

### Stat Card (통계 카드)

- 큰 숫자: 24px / 700, `grey900`
- 라벨: 13px / 400, `grey500`
- 상승 변화량: `green500` (#03b26c) + 위 화살표
- 하락 변화량: `red500` (#f04452) + 아래 화살표

---

## Layout

### Top Navigation
- 높이: **52px**
- 배경: transparent / white

### Sidebar
- Width: 240px (확장), 64px (축소)
- 배경: `--color-sidebar-bg` (#17171c)

### Header
- 높이: **52px** (네비와 동일)
- 배경: `background` (#ffffff)
- 하단 보더: `hairlineBorder` (#e5e8eb)

### Content Area
- 배경: `backgroundScreen` (**#f6f7f9**)
- 최대 너비: fluid
- Padding: 24px (데스크탑), 16px (모바일)

### Grid
- 대시보드: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Gap: 16px

---

## Transitions

- Duration: 150ms (마이크로), 200ms (기본), 300ms (강조)
- Easing: `cubic-bezier(0.33, 0, 0.67, 1)` (ease-out)
- 기본값: `all 200ms ease`

---

## 주요 변경 사항 (이전 가이드라인 대비)

| 항목 | 이전 (잘못된 값) | 현재 (정확한 값) |
|------|----------------|----------------|
| 브랜드 컬러 | `#0064FF` | **`#3182f6`** |
| 전체 배경 | `#f4f5f8` | **`#f6f7f9`** |
| 버튼 Border Radius | 10px | **8px** |
| 카드 Border Radius | 16px | **12px** |
| 모달 Border Radius | 20px | **16px** |
| 네비 높이 | 56px | **52px** |
| 그림자 색조 | 검정 계열 | **블루-그레이 계열** |
| Positive 색상 | `#00B386` | **`#03b26c`** |
| Warning 색상 | `#FF8800` | **`#fe9800`** |
| 사이드바 활성 | `#0064FF` | **`#3182f6`** |

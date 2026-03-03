# 배포 가이드

## 현재 상태

- [x] 1단계: 프론트엔드 빌드 확인
- [x] 2단계: Vercel CLI 설치 & 로그인
- [x] 3단계: `vercel` 명령으로 Preview 배포 완료
- [ ] 4단계: 환경변수 설정
- [ ] 5단계: 프로덕션 배포
- [ ] 6단계: 백엔드 배포 및 연결

---

## 4단계: Vercel 환경변수 설정

### 웹 대시보드

1. [vercel.com](https://vercel.com) 로그인
2. 프로젝트 클릭 → 상단 **Settings** 탭
3. 좌측 메뉴 **Environment Variables** 클릭
4. 아래 값 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://<백엔드-URL>/api` | Production, Preview, Development 전부 체크 |
| `INTERNAL_API_URL` | `https://<백엔드-URL>/api` | Production, Preview, Development 전부 체크 |

- `NEXT_PUBLIC_API_URL`: 브라우저에서 API 호출 시 사용 (클라이언트)
- `INTERNAL_API_URL`: SSR에서 API 호출 시 사용 (서버)
- Vercel에서는 둘 다 같은 외부 백엔드 URL 사용 (Docker 내부 네트워크가 아니므로)

### CLI로 설정

```bash
vercel env add NEXT_PUBLIC_API_URL
# 프롬프트: 값 입력 → 환경 선택 (production, preview, development)

vercel env add INTERNAL_API_URL
```

### 환경변수 변경 후 재배포 필요

```bash
vercel --prod
```

---

## 5단계: 프로덕션 배포

```bash
cd frontend
vercel --prod
```

---

## 6단계: 백엔드 배포

Vercel은 Next.js(프론트)만 호스팅. FastAPI 백엔드는 별도 배포 필요.

### 추천 옵션

| 플랫폼 | 난이도 | 비고 |
|--------|--------|------|
| **Railway** | 쉬움 | Docker Compose 지원, PostgreSQL/Redis 애드온 |
| **Render** | 쉬움 | Dockerfile 기반, 무료 티어 |
| **Fly.io** | 중간 | Dockerfile 기반, 리전 선택 가능 |
| **AWS EC2 + Docker Compose** | 높음 | 전체 스택 그대로 배포 |

### Railway 배포 (가장 빠른 방법)

1. [railway.app](https://railway.app) 가입
2. New Project → Deploy from GitHub repo
3. 서비스 추가: PostgreSQL, Redis
4. backend 서비스의 환경변수 설정:
   - `DATABASE_URL`: Railway PostgreSQL에서 자동 제공
   - `REDIS_URL`: Railway Redis에서 자동 제공
   - `GEMINI_API_KEY`: 본인 API 키
   - `MOCK_MODE`: `0` (또는 테스트 시 `1`)
5. 배포 완료 후 Railway URL을 Vercel 환경변수에 연결

---

## 백엔드 필요 환경변수 (배포 시)

```env
# DB
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>

# Redis
REDIS_URL=redis://<host>:6379/0

# Auth
SECRET_KEY=<랜덤-시크릿-키>

# LLM (Dataset Summary)
GEMINI_API_KEY=<Gemini API 키>
GEMINI_MODEL=gemini-2.5-flash
MOCK_MODE=0

# n8n (선택)
N8N_BASE_URL=http://<n8n-host>:5678
N8N_WEBHOOK_BASE=http://<n8n-host>:5678/webhook
```

---

## 참고: 백엔드 없이 UI만 확인

환경변수를 설정하지 않아도 프론트엔드 페이지 자체는 렌더링됨.
API 호출(파일 업로드 → 생성하기)에서만 에러 발생.
사이드바, 레이아웃, 드래그앤드롭 UI 등은 정상 확인 가능.

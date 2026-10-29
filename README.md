# 팀장님께 전하는 마음

떠나시는 팀장님께 팀원들의 감사와 응원을 전하는 **모바일 롤링페이퍼 웹서비스**입니다.
사진 위에 놓인 편지봉투 5개에 팀원이 한 통씩 편지를 남기고, 완성본 링크 하나로 팀장님께 전달합니다.
(Next.js App Router · TypeScript · Tailwind CSS · Supabase · Vercel)

| 주소 | 용도 |
|---|---|
| `/edit` | 편집모드. 배경 사진 최초 등록, 편지 작성·수정·삭제 |
| `/view` | 완성본. 읽기 전용 — **팀장님께는 이 주소만 전달하세요** |
| `/` | `/view`로 이동 |

## 배포 순서

1. **Supabase 프로젝트 생성** 후 SQL Editor에서 `supabase/migrations/0001_init.sql` 전체를 실행합니다.
   (테이블, RLS, 배경 업로드 선점 함수, 요청 제한 함수, `backgrounds` 스토리지 버킷이 만들어집니다.)
2. **환경변수 설정** — 로컬은 `.env.local`, Vercel은 Project Settings → Environment Variables. 항목은 `.env.example` 참고.
   - `SUPABASE_SERVICE_ROLE_KEY`, `LETTER_PASSWORD_PEPPER`, `LETTER_AUTH_SECRET`은 **서버 전용**입니다. 절대 `NEXT_PUBLIC_`을 붙이지 마세요.
3. GitHub 저장소를 Vercel에 연결해 배포합니다.
4. **먼저** `/edit`에 접속해 배경 사진을 등록하고, **그 다음에** 팀원들에게 `/edit` 링크를 공유하세요.
   (사진 등록은 인증 없이 첫 접속자가 선점하므로, 링크를 먼저 퍼뜨리면 제3자가 사진을 정할 수 있습니다.)

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

## 개발

```bash
npm run typecheck   # 타입 검사
npm test            # 검증 규칙·봉투 배치 단위 테스트
npm run build
```

## 설계 메모

- **쓰기는 모두 서버 API 경유.** 브라우저에는 Supabase 키가 전달되지 않고, `anon`/`authenticated`는 DB 권한이 없습니다(RLS 켬 + 정책 없음). 편지 공개 조회도 서버 API(`GET /api/letters`)가 비밀번호 해시를 뺀 컬럼만 돌려줍니다.
- **비밀번호:** HMAC(pepper) → Argon2id. 확인에 성공하면 해당 편지·해당 작업(수정/삭제)에만 쓸 수 있는 5분짜리 서명 토큰을 발급합니다.
- **대입 방어:** 4자리 숫자는 1만 가지뿐이라, 편지 하나당 10분에 10회까지만 확인할 수 있습니다(접속 IP당 30회). 한도를 넘으면 정답도 거절됩니다.
- **동시 저장:** `slot_number` UNIQUE 제약 → 하나만 성공, 나머지는 409. 수정은 `updated_at`이 같을 때만 반영(낙관적 잠금).
- **배경 사진:** DB 함수로 업로드 권한을 원자적으로 선점(2분 후 자동 만료) → Storage 저장 → 확정. 확정 뒤에는 DB 트리거가 경로 변경도 막습니다. 서버는 파일 실제 형식·디코딩을 검사하고, EXIF(위치 정보 등)를 제거한 1600px WebP로 저장합니다.
- Vercel 서버리스 함수의 요청 본문 한도(약 4.5MB) 때문에, 브라우저가 업로드 전에 사진을 줄입니다(선택 가능한 원본은 10MB까지).
- 글자 수(닉네임 20자, 본문 2000자)는 화면에 보이는 글자 기준이며 DB 제약은 안전망으로 더 느슨합니다.

## E2E 테스트 (실제 Supabase 없이)

`e2e/fake-supabase.mjs`는 Supabase(PostgREST·Storage)를 흉내 내는 테스트용 서버입니다. 규칙은 `0001_init.sql`과 같게 맞춰 두었습니다.

```bash
set -a; . e2e/env.sh; set +a        # 테스트용 환경변수
npm run build && npx next start -p 3100 &
npm run e2e:fake &                  # 가짜 Supabase (:54321)
npm run e2e:api                     # API 28개 시나리오
npm i -D playwright && npx playwright install chromium   # 최초 1회
npm run e2e:ui                      # 모바일 화면 흐름 (스크린샷: e2e/.out/)
```

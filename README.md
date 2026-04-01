# 펀타스틱 판매가 계산기

중국 사입 원가 → B2B/B2C 판매가 자동 계산 + 네이버/쿠팡 키워드 조회 도구

---

## 배포 방법 (3단계)

### 1. Supabase 테이블 생성

Supabase 대시보드 → SQL Editor → 아래 파일 내용 실행:

```
supabase_migration.sql
```

### 2. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사하고 값 채우기:

```bash
cp .env.local.example .env.local
```

| 변수 | 어디서 가져오나 |
|------|----------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |

### 3. Vercel 배포

```bash
# GitHub에 push
git init
git add .
git commit -m "init: funtastic calculator"
git remote add origin https://github.com/tapeoff-tpo/funtastic-calc.git
git push -u origin main
```

Vercel에서 import 후 환경 변수 3개 추가하면 끝.

---

## 기능

| 탭 | 기능 |
|----|------|
| 판매가 계산기 | 원가 입력 → B2B(수수료 10%) / B2C(수수료 25%) 자동 계산 |
| 키워드 조회 | AI가 메인/세부/연관/해시태그/롱테일 키워드 분석 |
| 상품 목록 | 계산한 상품 저장·공유 (Supabase에 저장되어 직원 전체 공유) |

## 계산 로직 (엑셀 동일)

```
B2B 계산가 = 원가 × 1.4
B2B 확정가 = ROUNDUP(계산가 × 1.1, 10원 단위)  ← 직접 입력 가능
B2B 부가세  = 확정가 ÷ 11
B2B 수수료  = 확정가 × 10%
B2B 순이익  = 확정가 − 원가 − 부가세 − 수수료

B2C 계산가 = B2B확정가 × 1.2
B2C 확정가 = ROUNDUP(계산가 × 1.1, 10원 단위)  ← 직접 입력 가능
B2C 부가세  = 확정가 ÷ 11
B2C 수수료  = 확정가 × 25%
B2C 순이익  = 확정가 − 원가 − 부가세 − 수수료
```

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

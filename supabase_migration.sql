-- 펀타스틱 판매가 계산기 — 상품 테이블
-- Supabase SQL Editor에서 실행하세요

create table if not exists calc_products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cost        numeric not null,
  b2b_price   numeric not null,
  b2c_price   numeric not null,
  b2b_margin  numeric not null,
  b2c_margin  numeric not null,
  created_at  timestamptz default now()
);

-- 전체 직원이 읽기/쓰기 가능하도록 RLS 비활성화 (내부 전용 도구)
alter table calc_products disable row level security;

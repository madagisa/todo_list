-- =====================================================
-- KEPCO 대구본부장 일정관리 시스템 - Supabase 설정
-- =====================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES Table (직책명 기반 사용자 관리)
create table if not exists public.profiles (
  id uuid default uuid_generate_v4() primary key,
  position_title text unique not null,
  password_hash text not null,
  role text default 'user' check (role in ('admin', 'user')),
  is_approved boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

-- 모든 사용자가 프로필 조회 가능
create policy "Anyone can view profiles"
  on profiles for select
  using ( true );

-- 새 계정 생성 가능 (회원가입)
create policy "Anyone can insert profile"
  on profiles for insert
  with check ( true );

-- 관리자만 다른 사용자 프로필 수정 가능 (승인/거절)
create policy "Admins can update any profile"
  on profiles for update
  using ( 
    exists (
      select 1 from profiles p
      where p.position_title = current_setting('app.current_user', true)
      and p.role = 'admin'
    )
  );

-- 자기 계정 삭제 가능 (탈퇴)
create policy "Users can delete own profile"
  on profiles for delete
  using ( position_title = current_setting('app.current_user', true) );

-- 2. SCHEDULE_ITEMS Table
create table if not exists public.schedule_items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  is_important boolean default false,
  status text default 'pending' check (status in ('pending', 'completed')),
  user_id uuid references public.profiles(id) on delete set null
);

-- RLS for Schedule Items
alter table public.schedule_items enable row level security;

-- 모든 사용자가 일정 조회 가능
create policy "Anyone can view schedules"
  on schedule_items for select
  using ( true );

-- 관리자만 일정 추가/수정/삭제 가능
create policy "Admins can manage schedules"
  on schedule_items for all
  using (
    exists (
      select 1 from profiles
      where profiles.position_title = current_setting('app.current_user', true)
      and profiles.role = 'admin'
    )
  );

-- =====================================================
-- 관리자 등록 방법 (Supabase Dashboard에서 직접 실행)
-- 여러 명의 관리자를 등록할 수 있습니다.
-- =====================================================
-- 
-- 1. 먼저 직접 가입하거나 아래 SQL로 계정 생성:
-- INSERT INTO public.profiles (position_title, password_hash, role, is_approved)
-- VALUES ('대구본부장', '비밀번호', 'admin', true);
--
-- 2. 기존 계정을 관리자로 승격:
-- UPDATE public.profiles 
-- SET role = 'admin', is_approved = true 
-- WHERE position_title = '직책명';
--
-- 3. 관리자 권한 해제:
-- UPDATE public.profiles 
-- SET role = 'user' 
-- WHERE position_title = '직책명';

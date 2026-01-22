-- =========================================================
-- [주의] 이 스크립트는 기존 데이터를 모두 삭제하고 초기화합니다!
-- =========================================================

-- 1. 기존 테이블 삭제 (데이터가 모두 사라집니다)
DROP TABLE IF EXISTS public.schedule_items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. UUID 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. PROFILES 테이블 생성 (직책명 기반)
CREATE TABLE public.profiles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_title text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'user' CHECK (role in ('admin', 'user')),
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SCHEDULE_ITEMS 테이블 생성 (일정)
CREATE TABLE public.schedule_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_important boolean DEFAULT false,
  status text DEFAULT 'pending' CHECK (status in ('pending', 'completed')),
  -- 반복 일정 그룹핑을 위한 컬럼 추가
  recurrence_id uuid, -- 반복 일정끼리 공유하는 그룹 ID
  recurrence_rule text, -- 반복 규칙 (예: 'daily', 'weekly')
  
  -- foreign key 연결 (profiles 테이블의 id 참조)
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 5. RLS (보안 정책) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

-- 6. 모든 권한 허용 정책 생성 (인증 로직은 앱에서 처리)
CREATE POLICY "Allow all access to profiles"
  ON public.profiles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to schedule_items"
  ON public.schedule_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. (선택사항) 초기 관리자 자동 생성
-- 필요하시면 아래 주석(--)을 풀고 실행하세요. 비밀번호는 원하는 대로 변경하세요.
-- INSERT INTO public.profiles (position_title, password_hash, role, is_approved)
-- VALUES ('경영지원부장', '1234', 'admin', true);

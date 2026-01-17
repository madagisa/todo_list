-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES Table (Handling Roles)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  role text default 'user' check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. SCHEDULE_ITEMS Table
create table public.schedule_items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  is_important boolean default false,
  status text default 'pending' check (status in ('pending', 'completed')),
  user_id uuid references auth.users not null
);

-- RLS for Schedule Items
alter table public.schedule_items enable row level security;

-- Policy: Everyone (authenticated) can VIEW schedules
create policy "Enable read access for authenticated users"
  on schedule_items for select
  to authenticated
  using ( true );

-- Policy: Only ADMIN can INSERT/UPDATE/DELETE
-- We check if the user has a profile with role 'admin'
create policy "Enable write access for admins only"
  on schedule_items for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

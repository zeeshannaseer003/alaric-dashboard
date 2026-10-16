-- Run in Supabase → SQL Editor → New query → Run
-- Makes questions + members visible to admin on every device

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  specialty text,
  role text not null default 'member',
  status text not null default 'pending',
  photo text,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  visibility text not null default 'members',
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_all" on public.profiles;
create policy "profiles_all" on public.profiles for all to authenticated using (true) with check (true);

drop policy if exists "posts_all" on public.posts;
create policy "posts_all" on public.posts for all to authenticated using (true) with check (true);

drop policy if exists "comments_all" on public.comments;
create policy "comments_all" on public.comments for all to authenticated using (true) with check (true);

drop policy if exists "likes_all" on public.likes;
create policy "likes_all" on public.likes for all to authenticated using (true) with check (true);

drop policy if exists "chat_all" on public.chat_messages;
create policy "chat_all" on public.chat_messages for all to authenticated using (true) with check (true);

-- 팀장님께 전하는 마음: 초기 스키마
-- Supabase SQL Editor 또는 `supabase db push`로 한 번 실행합니다.
-- 모든 쓰기는 Next.js 서버(service_role)를 통해서만 이뤄지며,
-- anon / authenticated 역할에는 어떤 권한도 주지 않습니다.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- letters
-- ---------------------------------------------------------------------------
-- 글자 수(닉네임 20자, 본문 2000자)는 "화면에 보이는 글자(grapheme)" 기준으로
-- 서버 API에서 검사합니다. 이모지처럼 한 글자가 여러 코드포인트인 경우를 위해
-- DB 제약은 안전망 역할로 여유 있게 둡니다.
create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  slot_number   smallint not null unique check (slot_number between 1 and 5),
  nickname      text not null
                check (char_length(nickname) between 1 and 100 and btrim(nickname) <> ''),
  password_hash text not null,
  content       text not null
                check (char_length(content) between 1 and 10000 and btrim(content, E' \n\r\t') <> ''),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- project_settings (프로젝트 1개만 존재)
-- ---------------------------------------------------------------------------
create table if not exists public.project_settings (
  id                      uuid primary key default gen_random_uuid(),
  singleton               boolean not null default true unique check (singleton),
  title                   text not null default '팀장님께 전하는 마음',
  background_image_path   text,
  background_locked_at    timestamptz,
  background_upload_state text not null default 'empty'
                          check (background_upload_state in ('empty', 'reserved', 'completed')),
  upload_reserved_at      timestamptz,
  upload_reservation_id   uuid,
  layout_seed             text not null default encode(gen_random_bytes(8), 'hex'),
  created_at              timestamptz not null default now()
);

insert into public.project_settings (singleton) values (true)
on conflict (singleton) do nothing;

-- 배경 사진이 확정된 뒤에는 DB 수준에서도 경로·상태 변경을 막습니다.
create or replace function public.guard_background_lock()
returns trigger
language plpgsql
as $$
begin
  if old.background_upload_state = 'completed'
     and (new.background_image_path is distinct from old.background_image_path
          or new.background_upload_state is distinct from old.background_upload_state
          or new.background_locked_at is distinct from old.background_locked_at) then
    raise exception 'background image is locked';
  end if;
  return new;
end;
$$;

drop trigger if exists project_settings_background_lock on public.project_settings;
create trigger project_settings_background_lock
  before update on public.project_settings
  for each row execute function public.guard_background_lock();

-- ---------------------------------------------------------------------------
-- 배경 업로드 예약 (원자적 선점)
-- ---------------------------------------------------------------------------
-- 예약은 2분 뒤 자동으로 만료되어, 업로드가 중간에 끊겨도 영구히 막히지 않습니다.
create or replace function public.reserve_background()
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  update public.project_settings
     set background_upload_state = 'reserved',
         upload_reserved_at      = now(),
         upload_reservation_id   = v_id
   where background_upload_state = 'empty'
      or (background_upload_state = 'reserved'
          and upload_reserved_at < now() - interval '2 minutes');
  if not found then
    return null;
  end if;
  return v_id;
end;
$$;

create or replace function public.release_background(p_reservation uuid)
returns boolean
language plpgsql
as $$
begin
  update public.project_settings
     set background_upload_state = 'empty',
         upload_reserved_at      = null,
         upload_reservation_id   = null
   where upload_reservation_id = p_reservation
     and background_upload_state = 'reserved';
  return found;
end;
$$;

create or replace function public.complete_background(p_reservation uuid, p_path text)
returns boolean
language plpgsql
as $$
begin
  update public.project_settings
     set background_upload_state = 'completed',
         background_image_path   = p_path,
         background_locked_at    = now(),
         upload_reserved_at      = null,
         upload_reservation_id   = null
   where upload_reservation_id = p_reservation
     and background_upload_state = 'reserved';
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 요청 횟수 제한 (고정 윈도우 카운터)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null
);

-- 허용되면 true, 한도를 넘으면 false
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start end,
        count = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1 end
  returning r.count into v_count;

  -- 오래된 행은 가끔 정리
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS / 권한: 정책을 만들지 않으므로 anon·authenticated는 접근할 수 없음
-- ---------------------------------------------------------------------------
alter table public.letters          enable row level security;
alter table public.project_settings enable row level security;
alter table public.rate_limits      enable row level security;

revoke all on table public.letters          from anon, authenticated;
revoke all on table public.project_settings from anon, authenticated;
revoke all on table public.rate_limits      from anon, authenticated;

revoke all on function public.reserve_background()                      from public, anon, authenticated;
revoke all on function public.release_background(uuid)                  from public, anon, authenticated;
revoke all on function public.complete_background(uuid, text)           from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer)    from public, anon, authenticated;
revoke all on function public.guard_background_lock()                   from public, anon, authenticated;

grant all on table public.letters          to service_role;
grant all on table public.project_settings to service_role;
grant all on table public.rate_limits      to service_role;
grant execute on function public.reserve_background()                   to service_role;
grant execute on function public.release_background(uuid)               to service_role;
grant execute on function public.complete_background(uuid, text)        to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: 배경 사진 버킷
-- 공개 읽기(public bucket) + 쓰기 정책 없음 → 업로드는 서버(service_role)만 가능
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

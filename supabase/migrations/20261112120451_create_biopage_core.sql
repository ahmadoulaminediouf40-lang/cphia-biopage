create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.biopage_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  full_name text not null,
  whatsapp text,
  linkedin_url text,
  photo_path text,
  content jsonb not null,
  edit_token_hash text not null unique,
  is_activated boolean not null default false,
  is_published boolean not null default false,
  activation_code_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists biopage_profiles_created_at_idx
  on public.biopage_profiles (created_at desc);
create index if not exists biopage_profiles_published_idx
  on public.biopage_profiles (is_published, published_at desc);

create table if not exists public.biopage_activation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_prefix text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_slug text,
  issued_by_email text not null
);

create index if not exists biopage_activation_codes_created_at_idx
  on public.biopage_activation_codes (created_at desc);

create table if not exists public.biopage_generation_limits (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists biopage_generation_limits_ip_created_idx
  on public.biopage_generation_limits (ip_hash, created_at desc);

create table if not exists public.biopage_admin_audit (
  id bigserial primary key,
  admin_email text not null,
  action text not null,
  target_slug text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.biopage_profiles enable row level security;
alter table public.biopage_activation_codes enable row level security;
alter table public.biopage_generation_limits enable row level security;
alter table public.biopage_admin_audit enable row level security;

revoke all on public.biopage_profiles from anon, authenticated;
revoke all on public.biopage_activation_codes from anon, authenticated;
revoke all on public.biopage_generation_limits from anon, authenticated;
revoke all on public.biopage_admin_audit from anon, authenticated;
grant all on public.biopage_profiles to service_role;
grant all on public.biopage_activation_codes to service_role;
grant all on public.biopage_generation_limits to service_role;
grant all on public.biopage_admin_audit to service_role;
grant usage, select on sequence public.biopage_generation_limits_id_seq to service_role;
grant usage, select on sequence public.biopage_admin_audit_id_seq to service_role;

create or replace function private.redeem_biopage_activation_code(p_code_hash text, p_slug text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code_id uuid;
begin
  update public.biopage_activation_codes
  set used_at = now(), used_by_slug = p_slug
  where code_hash = p_code_hash
    and used_at is null
    and (expires_at is null or expires_at > now())
  returning id into v_code_id;

  if v_code_id is null then
    return false;
  end if;

  update public.biopage_profiles
  set is_activated = true,
      is_published = true,
      activation_code_id = v_code_id,
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where slug = p_slug;

  if not found then
    raise exception 'Portfolio introuvable';
  end if;

  return true;
end;
$$;

grant usage on schema private to service_role;
grant execute on function private.redeem_biopage_activation_code(text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('biopage-portraits', 'biopage-portraits', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

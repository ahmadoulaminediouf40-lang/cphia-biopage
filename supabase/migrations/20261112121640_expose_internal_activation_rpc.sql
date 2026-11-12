create or replace function public.redeem_biopage_activation_code(p_code_hash text, p_slug text)
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

revoke all on function public.redeem_biopage_activation_code(text, text) from public, anon, authenticated;
grant execute on function public.redeem_biopage_activation_code(text, text) to service_role;

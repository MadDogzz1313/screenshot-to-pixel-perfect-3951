-- 017: Push-Server per Knopfdruck im Admin-Bereich einrichten (statt push_set_config von Hand).
-- Voraussetzung: 010 (und für das iPhone 011). Mehrfach ausführbar, ändert keine Daten.
-- Danach: In der LIVE-App als Admin -> Admin-Bereich -> „Push-Server“ -> „Push jetzt einrichten“ tippen.

-- Nur Admins: trägt Versand-Adresse + geheimen Schlüssel ein (kommt vom Leonida-Server, nie aus der App).
create or replace function public.push_admin_setup(_dispatch_url text, _secret text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if _dispatch_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/api/push/dispatch$' then raise exception 'BAD_URL'; end if;
  if char_length(coalesce(_secret, '')) < 32 then raise exception 'BAD_SECRET'; end if;
  return public.push_set_config(_dispatch_url, _secret);
end $$;

-- Nur Admins: Stand der Einrichtung. Der Schlüssel selbst wird nie zurückgegeben, nur ob er passt.
create or replace function public.push_admin_status(_secret text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare c record;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  select dispatch_url, secret, updated_at into c from public.push_config where id = 1;
  if not found then return jsonb_build_object('configured', false); end if;
  return jsonb_build_object('configured', true, 'dispatch_url', c.dispatch_url, 'updated_at', c.updated_at,
    'secret_matches', c.secret = coalesce(_secret, ''));
end $$;

revoke execute on function public.push_admin_setup(text, text), public.push_admin_status(text) from public, anon;
grant execute on function public.push_admin_setup(text, text), public.push_admin_status(text) to authenticated;

select '017 erfolgreich eingerichtet – jetzt im Admin-Bereich „Push jetzt einrichten“ tippen' as ergebnis;

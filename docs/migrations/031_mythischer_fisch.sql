-- 031_mythischer_fisch.sql
-- Leonida Fishing: neue Seltenheit „Mythisch“ (Mythischer Leonida-Marlín, 0,5 %, 5.000 Coins),
-- neue Grundchancen, Mythischer Köder (150 Coins, 0,5 % → 1 %, Nutzung pro Wurf) und Badge „Mythischer Fang“.
-- Voraussetzung: 004 (badges/user_badges), 027 (Leonida Fishing v2). Mehrfach ausführbar.
-- Bestehende Fänge, Coins, Köder-Inventare und Badges bleiben unverändert.

-- 1. Seltenheit erweitern
alter table public.fishing_species drop constraint if exists fishing_species_rarity_check;
alter table public.fishing_species add constraint fishing_species_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'));

-- 2. Neue Grundchancen (Summe exakt 100 %), Belohnungen bleiben; Mythischer Marlín neu
update public.fishing_species set base_chance = 12.0 where id = 'neon_makrele';
update public.fishing_species set base_chance = 7.5  where id = 'palmenschnapper';
update public.fishing_species set base_chance = 5.0  where id = 'leonida_marlin';
insert into public.fishing_species (id, rarity, name, base_chance, reward_coins, reward_xp, sort)
values ('mythic_marlin', 'mythic', 'Mythischer Leonida-Marlín', 0.5, 5000, 5, 6)
on conflict (id) do update set rarity = excluded.rarity, name = excluded.name, base_chance = excluded.base_chance,
  reward_coins = excluded.reward_coins, reward_xp = excluded.reward_xp, sort = excluded.sort;
do $$ begin
  if (select sum(base_chance) from public.fishing_species) <> 100 then raise exception 'FISHING_ODDS_INVALID'; end if;
end $$;

-- 3. Mythischer Köder: ×2 (0,5 % → 1 %), Nutzung wird pro Angelversuch verbraucht
alter table public.fishing_baits add column if not exists consume_on_cast boolean not null default false;
insert into public.fishing_baits (id, target_rarity, name, price, uses, boost_factor, sort, consume_on_cast)
values ('bait_mythic', 'mythic', 'Mythischer Köder', 150, 3, 2, 6, true)
on conflict (id) do update set target_rarity = excluded.target_rarity, name = excluded.name, price = excluded.price,
  uses = excluded.uses, boost_factor = excluded.boost_factor, sort = excluded.sort, consume_on_cast = excluded.consume_on_cast;

-- Köder mit Nutzung pro Wurf: beim Auswerfen abbuchen (atomar im selben Insert). Der Wurf verweist danach
-- nicht mehr auf das Inventar, damit beim Einholen nichts doppelt abgezogen wird.
create or replace function public.fishing_consume_on_cast()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare left_uses integer;
begin
  if new.bait_inventory_id is null or not exists (select 1 from public.fishing_baits b where b.id = new.bait_id and b.consume_on_cast) then
    return new;
  end if;
  update public.fishing_bait_inventory i set uses_left = i.uses_left - 1
  where i.id = new.bait_inventory_id and i.uses_left > 0 returning i.uses_left into left_uses;
  new.bait_uses_left := coalesce(left_uses, 0);
  new.bait_inventory_id := null;
  if coalesce(left_uses, 0) = 0 and not exists (select 1 from public.fishing_bait_inventory i where i.user_id = new.user_id and i.bait_id = new.bait_id and i.uses_left > 0) then
    update public.fishing_state s set selected_bait_id = null, updated_at = now() where s.user_id = new.user_id and s.selected_bait_id = new.bait_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.fishing_consume_on_cast() from public, anon, authenticated;
drop trigger if exists fishing_consume_on_cast on public.fishing_casts;
create trigger fishing_consume_on_cast before insert on public.fishing_casts for each row execute function public.fishing_consume_on_cast();

-- 4. Badge „Mythischer Fang“: automatisch und genau einmal beim ersten mythischen Fang
insert into public.badges (id, kind, name, requirement, threshold, sort)
values ('mythic_catch', 'community', 'Mythischer Fang', 'Fange den Mythischen Leonida-Marlín', 1, 13)
on conflict (id) do update set name = excluded.name, requirement = excluded.requirement;

create or replace function public.fishing_award_mythic_badge()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'caught' and old.status is distinct from 'caught' and new.species_id = 'mythic_marlin' then
    insert into public.user_badges (user_id, badge_id) values (new.user_id, 'mythic_catch') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.fishing_award_mythic_badge() from public, anon, authenticated;
drop trigger if exists fishing_award_mythic_badge on public.fishing_casts;
create trigger fishing_award_mythic_badge after update of status on public.fishing_casts for each row execute function public.fishing_award_mythic_badge();

select '031 erfolgreich – Mythischer Leonida-Marlín (0,5 %, 5.000 Coins), Mythischer Köder (150 Coins, 1 %), Badge „Mythischer Fang“' as ergebnis;

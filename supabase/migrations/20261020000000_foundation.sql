-- Phase 1: households, members, child accounts, invites, pairing codes,
-- per-member settings and push subscriptions. RLS on every table.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Our family',
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('admin', 'adult', 'child');

-- One row per person. id = auth.users.id.
create table public.members (
  id            uuid primary key references auth.users (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade,
  role          public.member_role not null,
  display_name  text not null,
  -- Who manages this account (set for child accounts only).
  guardian_id   uuid references public.members (id) on delete set null,
  sports        text[] not null default '{}',
  in_season     boolean not null default false,
  timezone      text not null default 'America/Denver',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint child_has_guardian check (role <> 'child' or guardian_id is not null)
);
create index on public.members (household_id);

-- Body data and other numbers that are private to the member (adults) or
-- visible only to the guardian (children). A child can never read this table,
-- so his body weight cannot leak into his UI even through a bad query.
create table public.member_private (
  member_id         uuid primary key references public.members (id) on delete cascade,
  sex               text check (sex in ('male', 'female')),
  birth_date        date,
  age_years         int check (age_years between 5 and 110),
  height_in         numeric(5, 2) check (height_in between 30 and 96),
  weight_lb         numeric(6, 2) check (weight_lb between 30 and 700),
  goal_weight_lb    numeric(6, 2) check (goal_weight_lb between 30 and 700),
  activity_level    text check (activity_level in ('sedentary', 'light', 'moderate', 'very_active')),
  updated_at        timestamptz not null default now()
);

-- Settings the member controls (adults) or the guardian controls (children).
create table public.member_settings (
  member_id        uuid primary key references public.members (id) on delete cascade,
  track_food       boolean not null default true,
  track_workouts   boolean not null default true,
  -- Which win categories post to the family feed.
  feed_workouts    boolean not null default true,
  feed_prs         boolean not null default true,
  feed_test_bests  boolean not null default true,
  feed_streaks     boolean not null default true,
  feed_body        boolean not null default false,
  -- Reminder times/toggles; filled in by later phases, defaults applied in app.
  reminders        jsonb not null default '{}'::jsonb,
  dislikes         text[] not null default '{}',
  -- {"mon": "gym" | "home" | "rest", ...}
  weekly_schedule  jsonb not null default '{}'::jsonb,
  -- Home equipment presets, e.g. ["dumbbells:5-50", "pullup_bar"].
  home_equipment   text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

-- Guardian-only settings for a child (protein g/lb, foot-contact cap, ...).
create table public.child_guardian_settings (
  child_id            uuid primary key references public.members (id) on delete cascade,
  protein_g_per_lb    numeric(3, 2) not null default 0.70 check (protein_g_per_lb between 0.3 and 1.2),
  foot_contact_cap    int not null default 80 check (foot_contact_cap between 10 and 200),
  test_reminder_weeks int not null default 4 check (test_reminder_weeks between 1 and 26),
  updated_at          timestamptz not null default now()
);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email        text not null,
  display_name text,
  invited_by   uuid not null references public.members (id) on delete cascade,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index household_invites_open_email
  on public.household_invites (lower(email)) where accepted_at is null;

-- Short-lived codes that sign a child's phone in. Only the hash is stored.
create table public.pairing_codes (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.members (id) on delete cascade,
  code_hash  text not null unique,
  created_by uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  last_error      text
);
create index on public.push_subscriptions (member_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse into members)
-- ---------------------------------------------------------------------------

create or replace function public.my_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.members where id = auth.uid()
$$;

create or replace function public.is_household_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role = 'admin')
$$;

-- True when the caller is the member, or is the guardian of that (child) member.
create or replace function public.can_manage_member(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or exists (select 1 from public.members
                 where id = target and role = 'child' and guardian_id = auth.uid())
$$;

create or replace function public.is_child() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role = 'child')
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households              enable row level security;
alter table public.members                 enable row level security;
alter table public.member_private          enable row level security;
alter table public.member_settings         enable row level security;
alter table public.child_guardian_settings enable row level security;
alter table public.household_invites       enable row level security;
alter table public.pairing_codes           enable row level security;
alter table public.push_subscriptions      enable row level security;

-- households: members read their own; admin renames.
create policy households_read on public.households for select
  using (id = public.my_household_id());
create policy households_admin_update on public.households for update
  using (id = public.my_household_id() and public.is_household_admin());

-- members: everyone in the household sees names/roles (needed for the feed).
create policy members_read on public.members for select
  using (household_id = public.my_household_id());
-- Members edit their own row, guardians edit their child's row. Role,
-- household and guardian are locked by the trigger below.
create policy members_update on public.members for update
  using (public.can_manage_member(id))
  with check (public.can_manage_member(id));

-- member_private: adults read/write their own; guardians read/write their
-- child's. A child gets nothing, not even his own row.
create policy member_private_rw on public.member_private for all
  using (public.can_manage_member(member_id) and not public.is_child())
  with check (public.can_manage_member(member_id) and not public.is_child());

-- member_settings: own row, or guardian for a child.
create policy member_settings_rw on public.member_settings for all
  using (public.can_manage_member(member_id))
  with check (public.can_manage_member(member_id));

-- child_guardian_settings: guardian only.
create policy child_guardian_settings_rw on public.child_guardian_settings for all
  using (public.can_manage_member(child_id) and not public.is_child())
  with check (public.can_manage_member(child_id) and not public.is_child());

-- invites: admin manages (creation also goes through invite_member()).
create policy invites_admin on public.household_invites for all
  using (household_id = public.my_household_id() and public.is_household_admin())
  with check (household_id = public.my_household_id() and public.is_household_admin());

-- pairing_codes: no direct client access; see create_pairing_code() and the
-- pairing-redeem edge function (service role).

-- push_subscriptions: own only.
create policy push_subscriptions_rw on public.push_subscriptions for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Guard rails
-- ---------------------------------------------------------------------------

-- Members can't promote themselves, move households or detach a guardian.
create or replace function public.members_lock_columns() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.role         := old.role;
    new.household_id := old.household_id;
    new.guardian_id  := old.guardian_id;
  end if;
  return new;
end $$;
create trigger members_lock_columns before update on public.members
  for each row execute function public.members_lock_columns();

-- A child's weight never posts to the feed.
create or replace function public.settings_child_no_body_feed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.members where id = new.member_id and role = 'child') then
    new.feed_body := false;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger settings_child_no_body_feed before insert or update on public.member_settings
  for each row execute function public.settings_child_no_body_feed();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Called right after sign-in. Returns the caller's membership, creating it
-- from an open invite or (for the very first user ever) a new household with
-- the caller as admin. Anyone else gets 'not_invited'.
create or replace function public.join_household(p_display_name text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_member public.members;
  v_invite public.household_invites;
  v_hh     uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select * into v_member from public.members where id = v_uid;
  if found then
    return jsonb_build_object('status', 'member', 'role', v_member.role);
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_invite from public.household_invites
    where lower(email) = lower(v_email) and accepted_at is null
    for update;
  if found then
    insert into public.members (id, household_id, role, display_name)
      values (v_uid, v_invite.household_id, 'adult',
              coalesce(nullif(trim(p_display_name), ''), v_invite.display_name, split_part(v_email, '@', 1)));
    insert into public.member_settings (member_id) values (v_uid);
    insert into public.member_private (member_id) values (v_uid);
    update public.household_invites set accepted_at = now() where id = v_invite.id;
    return jsonb_build_object('status', 'joined', 'role', 'adult');
  end if;

  -- Bootstrap: the first person to sign in owns the (single) household.
  perform pg_advisory_xact_lock(hashtext('family-trainer-bootstrap'));
  if not exists (select 1 from public.households) then
    insert into public.households default values returning id into v_hh;
    insert into public.members (id, household_id, role, display_name)
      values (v_uid, v_hh, 'admin',
              coalesce(nullif(trim(p_display_name), ''), split_part(v_email, '@', 1)));
    -- Jeremy doesn't eat beans or legumes (editable in Settings).
    insert into public.member_settings (member_id, dislikes)
      values (v_uid, '{beans,legumes,edamame,lentils,chickpeas,hummus}');
    insert into public.member_private (member_id) values (v_uid);
    return jsonb_build_object('status', 'created', 'role', 'admin');
  end if;

  return jsonb_build_object('status', 'not_invited');
end $$;

create or replace function public.invite_member(p_email text, p_display_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_household_admin() then
    raise exception 'only the household admin can invite';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  insert into public.household_invites (household_id, email, display_name, invited_by)
    values (public.my_household_id(), lower(trim(p_email)), nullif(trim(p_display_name), ''), auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- Returns a fresh 8-character code; only its hash is stored. Older unused
-- codes for the same child are revoked.
create or replace function public.create_pairing_code(p_child_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text := '';
  v_bytes    bytea := gen_random_bytes(8);
  v_expires  timestamptz := now() + interval '15 minutes';
  i          int;
begin
  if not exists (select 1 from public.members
                 where id = p_child_id and role = 'child' and guardian_id = auth.uid()) then
    raise exception 'not your child account';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  delete from public.pairing_codes where child_id = p_child_id and used_at is null;
  insert into public.pairing_codes (child_id, code_hash, created_by, expires_at)
    values (p_child_id, encode(digest(v_code, 'sha256'), 'hex'), auth.uid(), v_expires);
  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end $$;

-- Lock down: only signed-in users may call the RPCs.
revoke execute on function public.join_household(text)      from public, anon;
revoke execute on function public.invite_member(text, text) from public, anon;
revoke execute on function public.create_pairing_code(uuid) from public, anon;
grant  execute on function public.join_household(text)      to authenticated;
grant  execute on function public.invite_member(text, text) to authenticated;
grant  execute on function public.create_pairing_code(uuid) to authenticated;

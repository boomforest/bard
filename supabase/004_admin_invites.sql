-- ============================================================
-- Admin role + invite-only promoter onboarding.
-- Run in Supabase SQL Editor after 003_stripe_connect.sql.
-- Idempotent.
-- ============================================================

-- ── Admin flag on users ──────────────────────────────────────
alter table users
  add column if not exists is_admin boolean not null default false;

-- Make JP admin: replace with your auth user id.
-- Get yours with: select id, email from auth.users;
-- Then run:
--   update users set is_admin = true where email = 'jproney@gmail.com';

-- ── Promoter requests (public submits, admin reviews) ────────
create table if not exists promoter_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  city         text,
  description  text,
  status       text not null default 'pending',  -- pending | invited | declined | redeemed
  notes        text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null
);
create index if not exists promoter_requests_status_idx on promoter_requests(status, created_at desc);

-- ── Invite tokens ────────────────────────────────────────────
create table if not exists promoter_invites (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  email         text,                              -- optional: pre-fill on signup
  request_id    uuid references promoter_requests(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  redeemed_by   uuid references auth.users(id) on delete set null,
  redeemed_at   timestamptz,
  expires_at    timestamptz default (now() + interval '30 days'),
  created_at    timestamptz not null default now()
);
create index if not exists promoter_invites_token_idx on promoter_invites(token);

-- ── RLS ──────────────────────────────────────────────────────
alter table promoter_requests enable row level security;
alter table promoter_invites  enable row level security;

-- Anyone (incl. anon) can submit a request — gating happens in admin
drop policy if exists "Anyone can request promoter access" on promoter_requests;
create policy "Anyone can request promoter access"
  on promoter_requests for insert with check (true);

-- Only admins can see / update requests
drop policy if exists "Admins read requests" on promoter_requests;
create policy "Admins read requests"
  on promoter_requests for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

drop policy if exists "Admins update requests" on promoter_requests;
create policy "Admins update requests"
  on promoter_requests for update
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

-- Anyone can read an invite by token (needed at signup time, before auth)
drop policy if exists "Public read invites by token" on promoter_invites;
create policy "Public read invites by token"
  on promoter_invites for select using (true);

-- Only admins can create invites
drop policy if exists "Admins create invites" on promoter_invites;
create policy "Admins create invites"
  on promoter_invites for insert
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

-- A signed-in user can mark their own invite as redeemed
drop policy if exists "User redeems invite" on promoter_invites;
create policy "User redeems invite"
  on promoter_invites for update
  using (redeemed_by is null or redeemed_by = auth.uid());

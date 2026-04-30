-- Schema alignment after a full code-vs-schema audit (2026-04-30).
--
-- Fills in columns the code writes/reads but earlier migrations missed,
-- and creates two utility tables (contacts, feedback) that exist in the
-- code but never had a CREATE TABLE statement.
--
-- Idempotent: safe to run multiple times. Uses `add column if not exists`
-- and `create table if not exists` everywhere.

-- ─── USERS: extend with the profile/auth columns signup flows write ─────────
-- AuthApp / JoinPage / ProfilePage do upsert({ ...these }), so missing any
-- of them = "Could not find the X column" error on signup.
alter table users add column if not exists email         text;
alter table users add column if not exists username      text;
alter table users add column if not exists user_type     text default 'fan';
alter table users add column if not exists zip_code      text;
alter table users add column if not exists radius_miles  int;
alter table users add column if not exists city          text;
alter table users add column if not exists state         text;
alter table users add column if not exists phone         text;
alter table users add column if not exists artist_name   text;

-- ─── EVENTS: currency for Stripe Connect destination charges ───────────────
-- create-payment-intent and create-bar-payment-intent both read this with
-- a 'mxn' fallback, so adding it just makes the fallback explicit-in-DB.
alter table events add column if not exists currency text default 'mxn';

-- ─── CONTACTS: per-promoter email list, populated by CSV import ────────────
-- GrailContacts.jsx selects + upserts on (promoter_id, email).
create table if not exists contacts (
  id           uuid primary key default gen_random_uuid(),
  promoter_id  uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  name         text,
  created_at   timestamptz not null default now(),
  unique (promoter_id, email)
);
create index if not exists contacts_promoter_idx on contacts(promoter_id);

-- ─── FEEDBACK: show feedback form ──────────────────────────────────────────
-- submit-feedback.js inserts; AdminPage.jsx reads. Schema mirrors the
-- fields submit-feedback parses out of the request body.
create table if not exists feedback (
  id              uuid primary key default gen_random_uuid(),
  event           text,
  vibe_rating     int,
  sound_rating    int,
  heard_from      text,
  what_worked     text,
  what_didnt      text,
  come_back       text,
  anything_else   text,
  email           text,
  created_at      timestamptz not null default now()
);
create index if not exists feedback_event_idx on feedback(event);
create index if not exists feedback_created_idx on feedback(created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Both new tables left without RLS to match the existing permissive pattern
-- on most tables in this project. If/when you harden:
--   - contacts: enable RLS, policy "promoter reads own contacts"
--   - feedback: enable RLS, allow anon INSERT, restrict SELECT to is_admin

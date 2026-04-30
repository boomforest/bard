-- Store buyer locale on records that drive customer-facing emails.
-- Lets cron-triggered jobs (auto-close-bar refunds) email buyers in the
-- language they bought in, instead of always defaulting to ES.
--
-- Idempotent.

alter table bar_tabs        add column if not exists lang text default 'es';
alter table tickets         add column if not exists lang text default 'es';
alter table event_waitlist  add column if not exists lang text default 'es';

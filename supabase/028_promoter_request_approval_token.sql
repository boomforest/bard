-- Random per-request token that lets JP approve directly from his email
-- (no admin login required). Cleared after use; status='invited' or
-- 'denied' so a second click sees the request already processed.

alter table public.promoter_requests
  add column if not exists approval_token text default encode(gen_random_bytes(24), 'hex');

create unique index if not exists promoter_requests_approval_token_idx
  on public.promoter_requests(approval_token)
  where approval_token is not null;

-- Backfill existing pending requests so the email-approve link works for
-- in-flight ones.
update public.promoter_requests
   set approval_token = encode(gen_random_bytes(24), 'hex')
 where approval_token is null and status = 'pending';

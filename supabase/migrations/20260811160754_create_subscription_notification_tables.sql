-- Article email notification subscription system.
-- Both tables default-deny RLS for anon/authenticated: every read/write goes
-- through an Edge Function using the service_role key (which bypasses RLS),
-- never direct PostgREST access. This avoids an email-enumeration oracle on
-- subscribe (a bare anon INSERT would leak "already exists" via a unique
-- violation vs success) and keeps confirm/unsubscribe token checks server-side.

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null check (locale in ('zh', 'en', 'zh-cn', 'vi', 'id')),
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'active', 'unsubscribed')),
  subscribed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirm_token_hash text,
  confirm_token_expires_at timestamptz,
  unsubscribe_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscribers_email_lower_key
  on subscribers (lower(email));

create unique index if not exists subscribers_unsubscribe_token_hash_key
  on subscribers (unsubscribe_token_hash);

-- Confirm-token lookups filter by hash then status; this composite index
-- keeps that fast without needing a separate index on confirm_token_hash alone.
create index if not exists subscribers_confirm_token_hash_idx
  on subscribers (confirm_token_hash) where confirm_token_hash is not null;

-- Send-time query: active subscribers for a given locale.
create index if not exists subscribers_status_locale_idx
  on subscribers (status, locale);

alter table subscribers enable row level security;

create table if not exists article_notifications (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null,
  notification_type text not null default 'new_article',
  status text not null default 'not_decided'
    check (status in ('not_decided', 'pending', 'scheduled', 'sending', 'sent', 'do_not_send', 'failed')),
  available_locales jsonb not null default '{}'::jsonb,
  decided_at timestamptz,
  last_prompted_at timestamptz,
  scheduled_at timestamptz,
  sending_started_at timestamptz,
  sent_at timestamptz,
  message_id text,
  recipient_count integer,
  failed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The actual idempotency guard: send-notification's atomic UPDATE ... WHERE
-- status IN (...) RETURNING * relies on there being exactly one row per
-- (article_slug, notification_type), so a duplicate/retry call finds nothing
-- left to claim once the first call has moved status to 'sending'.
create unique index if not exists article_notifications_slug_type_key
  on article_notifications (article_slug, notification_type);

create index if not exists article_notifications_status_idx
  on article_notifications (status);

alter table article_notifications enable row level security;

-- Shared updated_at trigger.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_set_updated_at on subscribers;
create trigger subscribers_set_updated_at
  before update on subscribers
  for each row
  execute function set_updated_at();

drop trigger if exists article_notifications_set_updated_at on article_notifications;
create trigger article_notifications_set_updated_at
  before update on article_notifications
  for each row
  execute function set_updated_at();

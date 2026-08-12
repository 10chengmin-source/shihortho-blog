-- Lightweight capture table for article ideas submitted from the mobile
-- voice-capture page (notes/). RLS default-deny, same pattern as
-- subscribers/article_notifications: all access goes through Edge Functions
-- using the service_role key, never direct PostgREST access.

create table if not exists article_ideas (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Session-start hook / ideas:pending query: unprocessed ideas, oldest first.
create index if not exists article_ideas_unprocessed_idx
  on article_ideas (created_at) where processed_at is null;

alter table article_ideas enable row level security;

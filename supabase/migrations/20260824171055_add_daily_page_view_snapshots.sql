-- Daily snapshots of page_views.views so a delta (today's new views) can be
-- computed. page_views itself only ever stores a running total per slug.
create table if not exists page_view_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  slug text not null,
  views integer not null,
  created_at timestamptz not null default now(),
  unique (snapshot_date, slug)
);

alter table page_view_daily_snapshots enable row level security;
-- No policies: default-deny for anon/authenticated, same as the
-- subscribers/article_notifications tables. All access goes through the
-- SECURITY DEFINER functions below, mirroring increment_page_view's
-- existing trust model for this counter feature.

-- Called once per day (by the report script) to record today's totals.
create or replace function record_daily_page_view_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into page_view_daily_snapshots (snapshot_date, slug, views)
  select current_date, slug, views from page_views
  on conflict (snapshot_date, slug) do update set views = excluded.views;
end;
$$;

grant execute on function record_daily_page_view_snapshot() to anon;

-- Returns each slug's current total plus its delta since yesterday's
-- snapshot. had_prior_snapshot is false on a slug's first-ever run (no
-- snapshot to diff against yet), so the caller can render that distinctly
-- instead of presenting the full cumulative total as "today's views".
create or replace function get_page_view_daily_report()
returns table(
  slug text,
  total_views integer,
  delta integer,
  had_prior_snapshot boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.slug,
    p.views as total_views,
    p.views - coalesce(y.views, 0) as delta,
    (y.views is not null) as had_prior_snapshot
  from page_views p
  left join page_view_daily_snapshots y
    on y.slug = p.slug and y.snapshot_date = current_date - 1
  order by p.views desc;
$$;

grant execute on function get_page_view_daily_report() to anon;

create table public.jp_dashboard_report_feed(
 user_id uuid primary key references public.jp_dashboard_accounts(user_id) on delete cascade,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<2000000),
 revision bigint not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table public.jp_dashboard_report_feed enable row level security;
revoke all on public.jp_dashboard_report_feed from public,anon,authenticated;
grant select on public.jp_dashboard_report_feed to authenticated;
create policy dashboard_reports_owner_read on public.jp_dashboard_report_feed for select to authenticated using((select auth.uid())=user_id and (select (auth.jwt()->>'is_anonymous')::boolean) is false);

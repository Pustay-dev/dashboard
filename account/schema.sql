-- Private setup for the existing dashboard owner. No changes to shop/admin tables.
create table public.jp_dashboard_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object' and octet_length(settings::text)<20000),
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now()
);
alter table public.jp_dashboard_accounts enable row level security;
revoke all on public.jp_dashboard_accounts from public,anon,authenticated;
grant select on public.jp_dashboard_accounts to authenticated;
grant update(settings,revision,updated_at) on public.jp_dashboard_accounts to authenticated;
create policy dashboard_owner_read on public.jp_dashboard_accounts for select to authenticated using((select auth.uid())=user_id and (select (auth.jwt()->>'is_anonymous')::boolean) is false);
create policy dashboard_owner_update on public.jp_dashboard_accounts for update to authenticated using((select auth.uid())=user_id and (select (auth.jwt()->>'is_anonymous')::boolean) is false) with check((select auth.uid())=user_id and (select (auth.jwt()->>'is_anonymous')::boolean) is false);
insert into public.jp_dashboard_accounts(user_id)
 select u.id from auth.users u join public.nsl_admin_members m on lower(u.email)=m.email where lower(u.email)='pustay.jakub@gmail.com';

-- Additive admin API. No customer-facing permissions are changed.
create table if not exists public.nsl_admin_members(email text primary key check(email=lower(email)), created_at timestamptz not null default now());
create table if not exists public.nsl_admin_finance(day date primary key, revenue numeric(12,2) not null, ads numeric(12,2) not null check(ads>=0), generation numeric(12,2) not null check(generation>=0), printing numeric(12,2) not null check(printing>=0), other numeric(12,2) not null check(other>=0), updated_at timestamptz not null default now());
create table if not exists public.nsl_admin_complaints(id uuid primary key default gen_random_uuid(), subject text not null check(length(subject) between 1 and 200), email text, resolved boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.nsl_admin_carts(session_id uuid primary key references public.sessions(id) on delete cascade, items jsonb not null default '[]', updated_at timestamptz not null default now());
alter table public.nsl_admin_members enable row level security;
alter table public.nsl_admin_finance enable row level security;
alter table public.nsl_admin_complaints enable row level security;
alter table public.nsl_admin_carts enable row level security;
revoke all on public.nsl_admin_members,public.nsl_admin_finance,public.nsl_admin_complaints,public.nsl_admin_carts from anon,authenticated;
grant all on public.nsl_admin_members,public.nsl_admin_finance,public.nsl_admin_complaints,public.nsl_admin_carts to service_role;

create or replace function public.nsl_admin_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
with paid as (
 select distinct on (payload->>'id') payload from private.shopify_paid_events where status='processed' order by payload->>'id',received_at desc
), lines as (
 select p.payload, l.value line from paid p cross join lateral jsonb_array_elements(p.payload->'line_items') l
), purchases as (
 select oi.session_id,oi.created_at,oi.quantity,
 case when l.line->>'price' ~ '^\d+(\.\d+)?$' then (l.line->>'price')::numeric*oi.quantity-coalesce((select sum((d->>'amount')::numeric) from jsonb_array_elements(l.line->'discount_allocations') d),0) end amount,
 coalesce(oi.is_test_order,false) or coalesce((l.payload->>'test')::boolean,false) is_test
 from public.order_items oi left join lines l on l.payload->>'id'=oi.shopify_order_id and l.line->>'id'=oi.shopify_line_item_id
 where oi.payment_status='paid'
), sessions as (
 select s.id,s.admin_label, 'USER-'||lpad(s.internal_number::text,4,'0') as default_label,s.created_at,s.admin_archived_at,
 (select max(i.created_at) from public.images i where i.session_id=s.id) last_activity,
 (select count(*) from public.images i where i.session_id=s.id) gallery_count,
 (select count(*) from public.images i where i.session_id=s.id and (i.created_at at time zone 'Europe/Prague')::date=(now() at time zone 'Europe/Prague')::date) gen_today,
 (select coalesce(jsonb_agg(x),'[]') from (select i.id,i.internal_reference from public.images i where i.session_id=s.id order by i.created_at desc limit 3) x) previews,
 (select case when count(*)=0 then 0 when count(*) filter(where p.amount is null)>0 then null else sum(p.amount) end from purchases p where p.session_id=s.id and not p.is_test) spent,
 (select max(p.created_at) from purchases p where p.session_id=s.id and not p.is_test) last_purchase,
 (select count(*) from public.generation_jobs g where g.session_id=s.id and g.status in ('failed','needs_review')) errors,
 (select coalesce(sum((e->>'quantity')::integer),0) from public.nsl_admin_carts c cross join lateral jsonb_array_elements(c.items)e where c.session_id=s.id) cart_count,
 (select c.updated_at from public.nsl_admin_carts c where c.session_id=s.id) cart_updated_at
 from public.sessions s
), revenue as (
 select coalesce(sum(amount) filter(where not is_test),0) total,coalesce(sum(amount) filter(where not is_test and (created_at at time zone 'Europe/Prague')::date=(now() at time zone 'Europe/Prague')::date),0) today,
 count(*) filter(where not is_test and amount is null) missing,coalesce(sum(quantity) filter(where not is_test),0) prints from purchases
)
select jsonb_build_object('at',now(),'sessions',coalesce((select jsonb_agg(s order by s.last_activity desc nulls last) from sessions s),'[]'),
 'metrics',jsonb_build_object('generated',(select count(*) from public.images),'generated_today',(select count(*) from public.images where (created_at at time zone 'Europe/Prague')::date=(now() at time zone 'Europe/Prague')::date), 'revenue',r.total,'revenue_today',r.today,'missing_revenue',r.missing,'prints',r.prints,'costs',(select coalesce(jsonb_agg(f order by f.day desc),'[]') from public.nsl_admin_finance f),'first_day',(select min(created_at at time zone 'Europe/Prague')::date from public.generation_jobs)),
 'errors',(select coalesce(jsonb_agg(e),'[]') from (select id,session_id,internal_reference,status,stage,error_code,provider_submission_state,provider_submit_count,created_at from public.generation_jobs where status in ('failed','needs_review') order by created_at desc limit 100)e),
 'safe_retries',(select count(*) from public.generation_jobs where status='failed' and provider_submit_count=0 and provider_submission_state='not_submitted' and attempt<max_attempts and coalesce(error_code,'') not in ('SAFETY_REJECTED','PAID_SUBMISSION_LIMIT_REACHED','PROVIDER_CREDITS_EXHAUSTED')),
 'complaints',(select coalesce(jsonb_agg(c order by c.created_at desc),'[]') from public.nsl_admin_complaints c where not resolved)) from revenue r;
$$;
revoke all on function public.nsl_admin_snapshot() from public,anon,authenticated;
grant execute on function public.nsl_admin_snapshot() to service_role;

create or replace function public.nsl_admin_retry_safe() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.generation_jobs set status='queued',run_after=now(),error_code=null,updated_at=now()
 where status='failed' and provider_submit_count=0 and provider_submission_state='not_submitted' and attempt<max_attempts
 and coalesce(error_code,'') not in ('SAFETY_REJECTED','PAID_SUBMISSION_LIMIT_REACHED','PROVIDER_CREDITS_EXHAUSTED');
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.nsl_admin_retry_safe() from public,anon,authenticated;
grant execute on function public.nsl_admin_retry_safe() to service_role;

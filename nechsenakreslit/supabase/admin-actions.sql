create table if not exists public.nsl_admin_error_resolutions(job_id uuid primary key references public.generation_jobs(id) on delete cascade, resolved_at timestamptz not null default now());
alter table public.nsl_admin_error_resolutions enable row level security;
revoke all on public.nsl_admin_error_resolutions from anon,authenticated;
grant all on public.nsl_admin_error_resolutions to service_role;

-- Deleted galleries must not reset paid generation accounting.
create table if not exists private.nsl_deleted_generation_totals(id integer primary key check(id=1), submissions bigint not null default 0, images bigint not null default 0, first_day date);
insert into private.nsl_deleted_generation_totals(id) values(1) on conflict do nothing;
alter table private.nsl_deleted_generation_totals enable row level security;
revoke all on private.nsl_deleted_generation_totals from public,anon,authenticated;
grant all on private.nsl_deleted_generation_totals to service_role;

create table if not exists private.nsl_deleted_image_days(day date primary key,images bigint not null);
alter table private.nsl_deleted_image_days enable row level security;
revoke all on private.nsl_deleted_image_days from public,anon,authenticated;
grant all on private.nsl_deleted_image_days to service_role;

create table if not exists public.nsl_admin_deletions(session_id uuid primary key references public.sessions(id), confirmed_by text not null, started_at timestamptz not null default now(), auth_ids jsonb not null default '[]');
alter table public.nsl_admin_deletions enable row level security;
revoke all on public.nsl_admin_deletions from anon,authenticated;
grant all on public.nsl_admin_deletions to service_role;

create or replace function public.nsl_admin_clear_errors() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.nsl_admin_error_resolutions(job_id,resolved_at) select id,now() from public.generation_jobs where status in ('failed','needs_review')
 on conflict(job_id) do update set resolved_at=excluded.resolved_at;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.nsl_admin_clear_errors() from public,anon,authenticated;
grant execute on function public.nsl_admin_clear_errors() to service_role;

create or replace function public.nsl_admin_delete_session(p_session_id uuid,p_phase text,p_actor text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.sessions; manifest jsonb; auths jsonb; n bigint; image_count bigint; customer uuid;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if exists(select 1 from public.order_items where session_id=s.id) then raise exception 'SESSION_HAS_ORDERS'; end if;
 if exists(select 1 from public.generation_jobs where session_id=s.id and (status not in('completed','failed','cancelled') or provider_submission_state in('accepted','unknown'))) then raise exception 'SESSION_HAS_ACTIVE_JOBS'; end if;
 if exists(select 1 from public.uploads where session_id=s.id and status='uploading' and updated_at>now()-interval '15 minutes') then raise exception 'SESSION_HAS_ACTIVE_UPLOAD'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into manifest from storage.objects where left(name,length(s.id::text)+1)=s.id::text||'/';
 select coalesce(jsonb_agg(a.auth_user_id),'[]') into auths from public.session_access a where a.session_id=s.id and not exists(select 1 from public.session_access other where other.auth_user_id=a.auth_user_id and other.session_id<>s.id);
 if p_phase='preview' then
  return jsonb_build_object('session_id',s.id,'label',coalesce(s.admin_label,'USER-'||lpad(s.internal_number::text,4,'0')),'images',(select count(*) from public.images where session_id=s.id),'uploads',(select count(*) from public.uploads where session_id=s.id),'jobs',(select count(*) from public.generation_jobs where session_id=s.id),'files',jsonb_array_length(manifest),'anonymous_logins',jsonb_array_length(auths),'scope','This session, its gallery, uploads, cart and contact details. Other sessions and Shopify orders are not deleted. Only anonymous aggregate generation totals are kept.');
 elsif p_phase='begin' then
  if length(p_actor)=0 then raise exception 'ADMIN_ACTOR_REQUIRED'; end if;
  insert into public.nsl_admin_deletions(session_id,confirmed_by,auth_ids) values(s.id,p_actor,auths) on conflict(session_id) do nothing;
  update public.sessions set selected_image_id=null,expires_at=least(expires_at,now()-interval '1 second'),admin_archived_at=coalesce(admin_archived_at,now()),updated_at=now() where id=s.id;
  delete from public.session_access where session_id=s.id;
  select auth_ids into auths from public.nsl_admin_deletions where session_id=s.id;
  return jsonb_build_object('files',manifest,'auth_ids',auths);
 elsif p_phase='finish' then
  if not exists(select 1 from public.nsl_admin_deletions where session_id=s.id) then raise exception 'DELETION_NOT_STARTED'; end if;
  if jsonb_array_length(manifest)>0 then raise exception 'STORAGE_FILES_REMAIN'; end if;
  -- Share the paid-generation guard lock before moving counts into the anonymous tally.
  perform pg_advisory_xact_lock(62026002::bigint);
  select count(*) into n from private.portrait_generation_submissions where job_id in(select id from public.generation_jobs where session_id=s.id);
  select count(*) into image_count from public.images where session_id=s.id;
  update private.nsl_deleted_generation_totals set submissions=submissions+n,images=images+image_count,first_day=least(first_day,(select min(created_at at time zone 'Europe/Prague')::date from public.generation_jobs where session_id=s.id)) where id=1;
  insert into private.nsl_deleted_image_days(day,images) select (created_at at time zone 'Europe/Prague')::date,count(*) from public.images where session_id=s.id group by 1 on conflict(day) do update set images=nsl_deleted_image_days.images+excluded.images;
  delete from private.gallery_contacts where session_id=s.id;
  delete from private.portrait_generation_submissions where job_id in(select id from public.generation_jobs where session_id=s.id);
  delete from public.images where session_id=s.id;
  delete from public.generation_jobs where session_id=s.id;
  delete from public.uploads where session_id=s.id;
  delete from public.nsl_admin_deletions where session_id=s.id;
  customer:=s.customer_id;
  delete from public.sessions where id=s.id;
  if customer is not null and not exists(select 1 from public.sessions where customer_id=customer) then delete from private.customers where id=customer; end if;
  return jsonb_build_object('deleted',true);
 end if;
 raise exception 'INVALID_PHASE';
end $$;
revoke all on function public.nsl_admin_delete_session(uuid,text,text) from public,anon,authenticated;
grant execute on function public.nsl_admin_delete_session(uuid,text,text) to service_role;

-- Durable background cleanup leases and retry reporting.
alter table public.nsl_admin_deletions add column if not exists lease_until timestamptz, add column if not exists attempts integer not null default 0, add column if not exists last_error text;


-- Read-only readiness check; approved grants are recorded in backend-cleanup-permissions.sql.
create or replace function public.nsl_admin_deletion_ready() returns boolean language sql stable security invoker set search_path='' as $$ select has_table_privilege(current_user,'private.gallery_contacts','delete') and has_table_privilege(current_user,'private.portrait_generation_submissions','delete') $$;
revoke all on function public.nsl_admin_deletion_ready() from public,anon,authenticated;
grant execute on function public.nsl_admin_deletion_ready() to service_role;

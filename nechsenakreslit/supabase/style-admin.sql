-- Admin-only catalogue controls; existing worker remains the sole paid generation path.
create table public.nsl_admin_style_audit(id bigint generated always as identity primary key,actor text not null,operation text not null,target text,created_at timestamptz not null default now());
alter table public.nsl_admin_style_audit enable row level security;
revoke all on public.nsl_admin_style_audit from anon,authenticated;
grant all on public.nsl_admin_style_audit to service_role;
grant usage,select on sequence public.nsl_admin_style_audit_id_seq to service_role;
create table public.nsl_admin_style_requests(id uuid primary key default gen_random_uuid(),family_id text,style_id text,category_id text not null,queue_family text not null unique,kind text not null check(kind in('variant','assets')),status text not null default 'queued',created_at timestamptz not null default now());
alter table public.nsl_admin_style_requests enable row level security;
revoke all on public.nsl_admin_style_requests from anon,authenticated;
grant all on public.nsl_admin_style_requests to service_role;
alter table private.portrait_style_examples add column if not exists admin_hidden boolean not null default false;
-- Preserve completed assets and paid accounting when an admin removes an example from display.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.style_examples_catalog(text)'::regprocedure);
 d:=replace(d,'where e.style_id=s.id and e.status=''ready'')','where e.style_id=s.id and e.status=''ready'' and not e.admin_hidden)');
 execute d;
end $$;
create or replace function public.nsl_admin_style_action(p_op text,p_data jsonb default '{}',p_actor text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare s public.portrait_styles; f public.portrait_style_families; r public.nsl_admin_style_requests; generated public.portrait_styles; q text; result jsonb; id text:=p_data->>'id'; cat text:=p_data->>'category_id';
begin
 if length(p_actor)=0 then raise exception 'ADMIN_ACTOR_REQUIRED'; end if;
 if p_op='list' then
  -- Import finished requests only after the existing worker has finished every asset.
  for r in select a.* from public.nsl_admin_style_requests a join public.portrait_style_factory_status st on st.family_id=a.queue_family where a.status='queued' and st.status='ready' for update of a loop
   select * into generated from public.portrait_styles where family_id=r.queue_family order by portrait_styles.id limit 1;
   if generated.id is null then continue; end if;
   if r.kind='assets' then
    update public.portrait_styles set example_image_url=generated.example_image_url,revision=revision+1,updated_at=now() where portrait_styles.id=r.style_id;
    update public.portrait_style_placements set preview_url=generated.example_image_url where style_id=r.style_id and category_id=r.category_id;
    insert into private.portrait_style_examples(style_id,category,sort_order,status,image_path,thumbnail_path,style_revision,global_prompt_version,provider_request_id)
    select r.style_id,e.category,e.sort_order,'ready',e.image_path,e.thumbnail_path,e.style_revision,e.global_prompt_version,e.provider_request_id from private.portrait_style_examples e where e.style_id=generated.id and e.status='ready'
    on conflict(style_id,category) do update set image_path=excluded.image_path,thumbnail_path=excluded.thumbnail_path,status='ready',admin_hidden=false,updated_at=now()
    where portrait_style_examples.status in ('ready','queued','failed');
   else
    update public.portrait_styles set family_id=r.family_id,enabled=false,revision=revision+1,updated_at=now() where portrait_styles.id=generated.id;
   end if;
   update public.nsl_admin_style_requests set status='ready' where nsl_admin_style_requests.id=r.id;
  end loop;
  return jsonb_build_object('styles',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order,x.id),'[]') from public.portrait_styles x where not exists(select 1 from public.nsl_admin_style_requests a where a.queue_family=x.family_id and (a.kind='assets' or a.status<>'ready'))),'families',(select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]') from public.portrait_style_families x where exists(select 1 from public.portrait_styles s where s.family_id=x.id)), 'categories',(select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.portrait_style_categories x),'placements',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.portrait_style_placements x),'themes',(select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.portrait_style_themes x),'requests',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('worker_status',st.status,'error',st.error_code) order by x.created_at desc),'[]') from public.nsl_admin_style_requests x left join public.portrait_style_factory_status st on st.family_id=x.queue_family));
 end if;
 if p_op='category' then
  if length(btrim(p_data->>'label')) not between 1 and 80 then raise exception 'INVALID_STYLE_INPUT'; end if;
  update public.portrait_style_categories set label=btrim(p_data->>'label'),preview_url=case when p_data->>'preview_url' like 'https://%' then p_data->>'preview_url' else preview_url end,enabled=(p_data->>'enabled')::boolean where portrait_style_categories.id=id;
 elsif p_op='family' or p_op='reference' then
  select * into strict f from public.portrait_style_families where portrait_style_families.id=id for update;
  if f.revision is distinct from (p_data->>'revision')::int or (p_data ? 'updated_at' and f.updated_at is distinct from (p_data->>'updated_at')::timestamptz) then raise exception 'EDIT_CONFLICT'; end if;
  if p_op='reference' then
   if p_data->>'jpeg' is null then delete from private.portrait_family_style_references where family_id=id;
   else
    if length(p_data->>'jpeg')>205000 or substring(decode(p_data->>'jpeg','base64') from 1 for 2)<>decode('ffd8','hex') then raise exception 'INVALID_REFERENCE'; end if;
    insert into private.portrait_family_style_references(family_id,image_jpeg,prompt_suffix) values(id,decode(p_data->>'jpeg','base64'),'Use this uninhabited artwork only for visual style, materials, lighting and palette. Preserve exactly the customer subjects; do not add people or animals.') on conflict(family_id) do update set image_jpeg=excluded.image_jpeg,prompt_suffix=excluded.prompt_suffix;
   end if;
   update public.portrait_style_families set revision=revision+1,updated_at=now() where portrait_style_families.id=id;
  else
   if length(btrim(p_data->>'display_name')) not between 1 and 80 or length(p_data->>'base_prompt') not between 40 and 20000 then raise exception 'INVALID_STYLE_INPUT'; end if;
   update public.portrait_style_families set display_name=btrim(p_data->>'display_name'),base_prompt=p_data->>'base_prompt',enabled=(p_data->>'enabled')::boolean,revision=revision+1,updated_at=now() where portrait_style_families.id=id;
  end if;
 elsif p_op='example_hide' then
  update private.portrait_style_examples set admin_hidden=(p_data->>'hidden')::boolean where portrait_style_examples.id=id::uuid;
 else
  select * into strict s from public.portrait_styles where portrait_styles.id=id for update;
  if p_op='detail' then
   return jsonb_build_object('examples',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'category',e.category,'status',e.status,'image_path',e.image_path,'thumbnail_path',e.thumbnail_path,'hidden',e.admin_hidden,'error',e.error_code) order by e.sort_order),'[]') from private.portrait_style_examples e where e.style_id=id),'reference',(select encode(image_jpeg,'base64') from private.portrait_family_style_references where family_id=s.family_id));
  end if;
  if s.revision is distinct from (p_data->>'revision')::int or (p_data ? 'updated_at' and s.updated_at is distinct from (p_data->>'updated_at')::timestamptz) then raise exception 'EDIT_CONFLICT'; end if;
  if p_op='save' then
   if length(btrim(p_data->>'display_name')) not between 1 and 80 or length(p_data->>'prompt') not between 1 and 20000 or (p_data->>'preview_url') !~ '^https://' then raise exception 'INVALID_STYLE_INPUT'; end if;
   update public.portrait_styles set display_name=btrim(p_data->>'display_name'),prompt=p_data->>'prompt',example_image_url=p_data->>'preview_url',enabled=(p_data->>'enabled')::boolean,theme=p_data->>'theme',revision=revision+1,updated_at=now() where portrait_styles.id=id;
   if cat is not null then
    insert into public.portrait_style_placements(style_id,category_id,display_name,preview_url,enabled) values(id,cat,btrim(p_data->>'display_name'),p_data->>'preview_url',true) on conflict(style_id,category_id) do update set display_name=excluded.display_name,preview_url=excluded.preview_url,enabled=true;
   end if;
  elsif p_op='placement_remove' then
   update public.portrait_style_placements set enabled=false where style_id=id and category_id=cat;
   update public.portrait_styles set revision=revision+1,updated_at=now() where portrait_styles.id=id;
  elsif p_op='request' then
   if p_data->>'kind' not in ('variant','assets') or not exists(select 1 from public.portrait_style_categories where portrait_style_categories.id=cat) then raise exception 'INVALID_STYLE_INPUT'; end if;
   if exists(select 1 from public.nsl_admin_style_requests a where a.style_id=id and a.category_id=cat and a.status='queued') then raise exception 'REQUEST_ALREADY_QUEUED'; end if;
   if s.family_id is null and p_data->>'kind'='variant' then raise exception 'FAMILY_REQUIRED'; end if;
   q:='adm-'||replace(gen_random_uuid()::text,'-',''); q:=left(q,32);
   select * into f from public.portrait_style_families where portrait_style_families.id=s.family_id;
   result:=public.style_factory_enqueue_chat(jsonb_build_array(jsonb_build_object('family_id',q,'display_name',s.display_name,'concept',left('Preserve this exact established artistic style. Base: '||coalesce(f.base_prompt,'')||E'\nCategory direction: '||s.prompt||E'\nRequested adaptation: '||coalesce(p_data->>'brief','')||E'\nCreate the requested recipient category only. Preserve the exact real customer cast in production.',12000),'categories',jsonb_build_array(cat),'reference_urls','[]'::jsonb)));
   insert into public.nsl_admin_style_requests(family_id,style_id,category_id,queue_family,kind) values(s.family_id,id,cat,q,p_data->>'kind');
  else raise exception 'INVALID_STYLE_OPERATION'; end if;
 end if;
 insert into public.nsl_admin_style_audit(actor,operation,target) values(p_actor,p_op,id);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.nsl_admin_style_action(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.nsl_admin_style_action(text,jsonb,text) to service_role;
create or replace function public.nsl_admin_generation_analytics() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('days',30,'leads',(select count(*) from public.sessions where created_at>=((now() at time zone 'Europe/Prague')::date-29) at time zone 'Europe/Prague'),'account_days',(select count(*) from public.nsl_admin_finance where day between (now() at time zone 'Europe/Prague')::date-29 and (now() at time zone 'Europe/Prague')::date),'ad_spend',(select sum(ads) from public.nsl_admin_finance where day between (now() at time zone 'Europe/Prague')::date-29 and (now() at time zone 'Europe/Prague')::date),'jobs',count(*),'completed',count(*) filter(where status='completed'),'failed',count(*) filter(where status in('failed','needs_review')),'average_seconds',round(avg(extract(epoch from completed_at-created_at)) filter(where status='completed'),1),'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from(select (created_at at time zone 'Europe/Prague')::date as day,count(*) jobs,count(*) filter(where status='completed') completed,count(*) filter(where status in('failed','needs_review')) failed from public.generation_jobs where kind='portrait' and created_at>=now()-interval '30 days' group by 1)d),'[]')) from public.generation_jobs where kind='portrait' and created_at>=now()-interval '30 days';
$$;
revoke all on function public.nsl_admin_generation_analytics() from public,anon,authenticated;
grant execute on function public.nsl_admin_generation_analytics() to service_role;
-- Reference editing is confined to the server role; visitors have no write access.
grant update(image_jpeg,prompt_suffix) on private.portrait_family_style_references to service_role;
grant delete on private.portrait_family_style_references to service_role;

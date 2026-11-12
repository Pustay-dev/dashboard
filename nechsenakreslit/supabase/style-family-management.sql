-- Exact style suggestions, existing artwork fallbacks, family creation and scoped membership changes.
CREATE OR REPLACE FUNCTION public.nsl_admin_style_action(p_op text, p_data jsonb DEFAULT '{}'::jsonb, p_actor text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare s public.portrait_styles; f public.portrait_style_families; r public.nsl_admin_style_requests; generated public.portrait_styles; q text; result jsonb; member jsonb; destination text; previous_family text; id text:=p_data->>'id'; cat text:=p_data->>'category_id';
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
  return jsonb_build_object('styles',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('admin_preview_urls',coalesce((select jsonb_agg(u.url) from (select coalesce(e.thumbnail_path,e.image_path) as path from private.portrait_style_examples e where e.style_id=x.id and e.status='ready' order by e.sort_order limit 3) stored cross join lateral (select 'https://nfurbsycuufhfgfnaiej.supabase.co/storage/v1/object/public/style-examples/'||stored.path as url) u),'[]'::jsonb)) order by x.sort_order,x.id),'[]') from public.portrait_styles x where not exists(select 1 from public.nsl_admin_style_requests a where a.queue_family=x.family_id and (a.kind='assets' or a.status<>'ready'))),'families',(select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]') from public.portrait_style_families x where not exists(select 1 from public.nsl_admin_style_requests internal_request where internal_request.queue_family=x.id)), 'categories',(select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.portrait_style_categories x),'placements',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.portrait_style_placements x),'themes',(select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.portrait_style_themes x),'requests',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('worker_status',st.status,'error',st.error_code) order by x.created_at desc),'[]') from public.nsl_admin_style_requests x left join public.portrait_style_factory_status st on st.family_id=x.queue_family));
 end if;
 if p_op='family_create' then
  if length(btrim(p_data->>'display_name')) not between 1 and 80 or length(btrim(p_data->>'base_prompt')) not between 40 and 20000 then raise exception 'INVALID_STYLE_INPUT'; end if;
  id:='custom-'||replace(gen_random_uuid()::text,'-','');
  insert into public.portrait_style_families(id,display_name,base_prompt,enabled) values(id,btrim(p_data->>'display_name'),btrim(p_data->>'base_prompt'),coalesce((p_data->>'enabled')::boolean,true));
  insert into public.nsl_admin_style_audit(actor,operation,target) values(p_actor,p_op,id);
  return jsonb_build_object('ok',true,'id',id);
 elsif p_op='family_members' then
  select * into strict f from public.portrait_style_families where portrait_style_families.id=id for update;
  if f.revision is distinct from (p_data->>'revision')::int or f.updated_at is distinct from (p_data->>'updated_at')::timestamptz then raise exception 'EDIT_CONFLICT'; end if;
  if jsonb_typeof(p_data->'changes') is distinct from 'array' or jsonb_array_length(p_data->'changes')>250 then raise exception 'INVALID_STYLE_INPUT'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(p_data->'changes') x) then raise exception 'INVALID_STYLE_INPUT'; end if;
  for member in select value from jsonb_array_elements(p_data->'changes') order by value->>'id' loop
   select * into strict s from public.portrait_styles where portrait_styles.id=member->>'id' for update;
   if s.updated_at is distinct from (member->>'updated_at')::timestamptz or s.family_id is distinct from (member->>'from_family_id') then raise exception 'EDIT_CONFLICT'; end if;
   if jsonb_typeof(member->'included') is distinct from 'boolean' then raise exception 'INVALID_STYLE_INPUT'; end if;
   if (member->>'included')::boolean then destination:=id;
   else if s.family_id is distinct from id then raise exception 'EDIT_CONFLICT'; end if; destination:=null; end if;
   if exists(select 1 from public.generation_jobs j where j.style_id=s.id and j.status in ('pending','processing')) then raise exception 'STYLE_HAS_ACTIVE_JOBS'; end if;
   previous_family:=s.family_id;
   update public.portrait_styles set family_id=destination where portrait_styles.id=s.id;
   if previous_family is not null and previous_family<>id then update public.portrait_style_families set revision=revision+1,updated_at=now() where portrait_style_families.id=previous_family; end if;
  end loop;
  update public.portrait_style_families set revision=revision+1,updated_at=now() where portrait_style_families.id=id;
 elsif p_op='category' then
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

  if p_op='recommendations' then
   if not (p_data ? 'updated_at') or p_data->>'mode' is distinct from 'exact' then raise exception 'INVALID_STYLE_INPUT'; end if;
   if jsonb_typeof(p_data->'ids') is distinct from 'array' or jsonb_array_length(p_data->'ids')>12 then raise exception 'INVALID_STYLE_INPUT'; end if;
   if exists(select 1 from jsonb_array_elements(p_data->'ids') x where jsonb_typeof(x)<>'string') then raise exception 'INVALID_STYLE_INPUT'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_data->'ids') x where x=s.id or not exists(select 1 from public.portrait_styles target where target.id=x)) then raise exception 'INVALID_STYLE_INPUT'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements_text(p_data->'ids') x) then raise exception 'INVALID_STYLE_INPUT'; end if;
   update public.portrait_styles set suggested_style_ids=array(select jsonb_array_elements_text(p_data->'ids')),revision=revision+1,updated_at=now() where portrait_styles.id=id;
  elsif p_op='save' then
   if length(btrim(p_data->>'display_name')) not between 1 and 80 or length(p_data->>'prompt') not between 1 and 20000 or (nullif(p_data->>'preview_url','') is not null and (p_data->>'preview_url') !~ '^https://') then raise exception 'INVALID_STYLE_INPUT'; end if;
   update public.portrait_styles set display_name=btrim(p_data->>'display_name'),prompt=p_data->>'prompt',example_image_url=nullif(p_data->>'preview_url',''),enabled=(p_data->>'enabled')::boolean,theme=p_data->>'theme',revision=revision+1,updated_at=now() where portrait_styles.id=id;
   if cat is not null then
    insert into public.portrait_style_placements(style_id,category_id,display_name,preview_url,enabled) values(id,cat,btrim(p_data->>'display_name'),nullif(p_data->>'preview_url',''),true) on conflict(style_id,category_id) do update set display_name=excluded.display_name,preview_url=excluded.preview_url,enabled=true;
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
end $function$
;
-- Family reassignment changes the production prompt and must version the variant.
do $$ declare d text; begin
 d:=pg_get_functiondef('private.touch_portrait_style()'::regprocedure);
 d:=replace(d,'row(new.prompt,new.subject_type,new.max_subjects,new.max_photos)','row(new.prompt,new.subject_type,new.max_subjects,new.max_photos,new.family_id)');
 d:=replace(d,'row(old.prompt,old.subject_type,old.max_subjects,old.max_photos)','row(old.prompt,old.subject_type,old.max_subjects,old.max_photos,old.family_id)');
 execute d;
end $$;

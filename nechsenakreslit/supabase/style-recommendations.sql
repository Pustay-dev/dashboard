-- Store explicit ordered family IDs per variant. Empty preserves automatic suggestions.
alter table public.portrait_styles add column if not exists suggested_style_ids text[] not null default '{}';
alter table public.portrait_styles add constraint portrait_styles_suggestions_limit check(cardinality(suggested_style_ids)<=12);
do $migration$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('public.nsl_admin_style_action(text,jsonb,text)'::regprocedure);
 needle:='  if p_op=''save'' then';
 if strpos(definition,needle)=0 then raise exception 'Unexpected admin function version'; end if;
 definition:=replace(definition,needle,$patch$
  if p_op='recommendations' then
   if jsonb_typeof(p_data->'ids') is distinct from 'array' or jsonb_array_length(p_data->'ids')>12 then raise exception 'INVALID_STYLE_INPUT'; end if;
   if exists(select 1 from jsonb_array_elements(p_data->'ids') x where jsonb_typeof(x)<>'string') then raise exception 'INVALID_STYLE_INPUT'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_data->'ids') x where x=coalesce(s.family_id,s.id) or not exists(select 1 from public.portrait_styles target where coalesce(target.family_id,target.id)=x)) then raise exception 'INVALID_STYLE_INPUT'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements_text(p_data->'ids') x) then raise exception 'INVALID_STYLE_INPUT'; end if;
   update public.portrait_styles set suggested_style_ids=array(select jsonb_array_elements_text(p_data->'ids')),revision=revision+1,updated_at=now() where portrait_styles.id=id;
  elsif p_op='save' then$patch$);
 execute definition;
 definition:=pg_get_functiondef('public.portrait_style_catalog()'::regprocedure);
 needle:='''id'',s.id,''landing_only'',s.landing_only';
 if strpos(definition,needle)=0 then raise exception 'Unexpected public catalogue version'; end if;
 definition:=replace(definition,needle,'''suggested_style_ids'',s.suggested_style_ids,'||needle);
 execute definition;
end $migration$;
-- Existing invoker function and grants remain; clients cannot write suggestions directly.

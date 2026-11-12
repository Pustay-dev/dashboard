-- PL/pgSQL's row variable s shadows the old query alias. Use an unambiguous alias.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.nsl_admin_style_action(text,jsonb,text)'::regprocedure);
 d:=replace(d,'exists(select 1 from public.portrait_styles s where s.family_id=x.id)','exists(select 1 from public.portrait_styles member_style where member_style.family_id=x.id)');
 d:=replace(d,'if p_op=''recommendations'' then','if p_op=''recommendations'' then'||E'\n   if not (p_data ? ''updated_at'') then raise exception ''INVALID_STYLE_INPUT''; end if;');
 execute d;
end $$;

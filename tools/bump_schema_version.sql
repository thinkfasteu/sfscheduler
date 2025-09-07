-- Usage: psql <connection> -f bump_schema_version.sql -v new_version=2
-- Increments schema_version row to :new_version
begin;
\set ON_ERROR_STOP on
do $$
declare v int := :new_version; begin
  if v is null then raise exception 'Provide -v new_version=NN'; end if;
  update public.app_meta set value = jsonb_build_object('v', v), updated_at=now() where key='schema_version';
  if not found then
    insert into public.app_meta(key,value) values('schema_version', jsonb_build_object('v', v));
  end if;
end $$;
commit;

-- Permite el tipo de cuenta 'prestamo' (dinero que te prestaron).
-- Ejecutar una vez en Supabase → SQL Editor. Es seguro repetirlo.
-- Funciona tanto si accounts.type es un enum como si tiene un CHECK.

do $$
declare
  tipo text;
  r record;
begin
  -- Caso 1: la columna es un enum de Postgres.
  select c.udt_name into tipo
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'accounts' and c.column_name = 'type';

  if exists (select 1 from pg_type t where t.typname = tipo and t.typtype = 'e') then
    execute format('alter type %I add value if not exists %L', tipo, 'prestamo');
  end if;

  -- Caso 2: hay un CHECK que lista los tipos permitidos. Se rehace igual
  -- que estaba, agregando 'prestamo' junto a 'tarjeta'. Si algo falla,
  -- todo se deshace y la tabla queda como estaba.
  for r in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%''tarjeta''%'
      and pg_get_constraintdef(oid) not ilike '%prestamo%'
  loop
    execute format('alter table public.accounts drop constraint %I', r.conname);
    execute format(
      'alter table public.accounts add constraint %I %s',
      r.conname,
      regexp_replace(r.def, '''tarjeta''(::[a-z ]+)?', '''tarjeta''\1, ''prestamo''\1')
    );
  end loop;
end $$;

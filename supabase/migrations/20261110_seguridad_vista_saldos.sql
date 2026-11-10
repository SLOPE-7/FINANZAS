-- Seguridad: la vista account_balances debe respetar las políticas RLS
-- de quien consulta. Por defecto, una vista en Postgres se ejecuta con
-- los permisos de su dueño y puede saltarse RLS, dejando ver saldos de
-- otros usuarios.
--
-- Requiere Postgres 15 o superior (los proyectos nuevos de Supabase lo son).
-- Ejecutar una vez en Supabase → SQL Editor.

alter view public.account_balances set (security_invoker = true);

-- Comprobación: las tablas deben tener RLS activado (rowsecurity = true).
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('accounts', 'transactions', 'categories', 'scheduled_payments');

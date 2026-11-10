-- PASO 1 · COPIA DE SEGURIDAD
-- Copia las 4 tablas a un esquema privado "respaldo" (no visible desde la app).
-- Si lo ejecutas otra vez, NO sobrescribe la copia existente.

create schema if not exists respaldo;

create table if not exists respaldo.accounts_20261110           as table public.accounts;
create table if not exists respaldo.categories_20261110         as table public.categories;
create table if not exists respaldo.transactions_20261110       as table public.transactions;
create table if not exists respaldo.scheduled_payments_20261110 as table public.scheduled_payments;

-- Comprobación: las cantidades de la copia deben ser iguales a las originales.
select 'cuentas' as tabla, (select count(*) from public.accounts) as original, (select count(*) from respaldo.accounts_20261110) as copia
union all select 'categorías', (select count(*) from public.categories), (select count(*) from respaldo.categories_20261110)
union all select 'movimientos', (select count(*) from public.transactions), (select count(*) from respaldo.transactions_20261110)
union all select 'pagos programados', (select count(*) from public.scheduled_payments), (select count(*) from respaldo.scheduled_payments_20261110);

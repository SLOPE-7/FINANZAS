-- PASO 2 · VISTA PREVIA (no borra nada)
-- Pon los nombres EXACTOS de las categorías a conservar en las 2 líneas marcadas.

-- a) Categorías que se van a conservar (las principales y sus subcategorías):
with nombres as (
  select lower(trim(n)) as n from unnest(array['Kenneth💙', 'Antonella🩷']) n   -- ← nombres aquí
),
padre as (
  select id, user_id from public.categories
  where lower(trim(name)) in (select n from nombres)
),
k as (
  select id from padre
  union select c.id from public.categories c where c.parent_id in (select id from padre)
)
select c.name as categoria_que_se_conserva, c.kind as tipo
from public.categories c where c.id in (select id from k)
order by c.parent_id nulls first, c.name;

-- b) Qué se conserva y qué se borra:
with nombres as (
  select lower(trim(n)) as n from unnest(array['Kenneth💙', 'Antonella🩷']) n   -- ← nombres aquí
),
padre as (
  select id, user_id from public.categories
  where lower(trim(name)) in (select n from nombres)
),
k as (
  select id from padre
  union select c.id from public.categories c where c.parent_id in (select id from padre)
),
t as (select * from public.transactions where user_id in (select user_id from padre)),
p as (select * from public.scheduled_payments where user_id in (select user_id from padre))
select 'movimientos que se CONSERVAN' as que, count(*) as cantidad
  from t where category_id in (select id from k)
union all
select 'movimientos que se BORRAN', count(*)
  from t where category_id is null or category_id not in (select id from k)
union all
select 'pagos programados que se CONSERVAN', count(*)
  from p where category_id in (select id from k)
union all
select 'pagos programados que se BORRAN', count(*)
  from p where category_id is null or category_id not in (select id from k);

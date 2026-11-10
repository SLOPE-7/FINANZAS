-- PASO 3 · EMPEZAR DE CERO
-- Borra todos los movimientos y pagos programados EXCEPTO los de la
-- categoría de tus hijos (y sus subcategorías). Las cuentas y las
-- categorías se conservan.
-- Cambia 'Hijos' por el nombre EXACTO (línea marcada).
-- Es todo o nada: si algo falla, no se borra nada.

do $$
declare
  nombre text := 'Hijos';                                  -- ← nombre aquí
  n_tx int;
  n_pagos int;
  n_duenos int;
begin
  -- Seguridad 1: exige que exista la copia del paso 1.
  if to_regclass('respaldo.transactions_20261110') is null
     or to_regclass('respaldo.scheduled_payments_20261110') is null then
    raise exception 'Primero ejecuta el PASO 1 (copia de seguridad).';
  end if;

  create temp table _padre on commit drop as
    select id, user_id from public.categories
    where lower(trim(name)) = lower(trim(nombre));

  -- Seguridad 2: la categoría tiene que existir.
  if not exists (select 1 from _padre) then
    raise exception 'No encontré la categoría "%". Revisa el nombre exacto (paso 2).', nombre;
  end if;

  -- Seguridad 3: solo se toca la cuenta de usuario dueña de esa categoría.
  select count(distinct user_id) into n_duenos from _padre;
  if n_duenos <> 1 then
    raise exception 'La categoría "%" existe en % usuarios distintos. Avísale a Claude.', nombre, n_duenos;
  end if;

  create temp table _k on commit drop as
    select id from _padre
    union
    select c.id from public.categories c where c.parent_id in (select id from _padre);

  delete from public.transactions t
  where t.user_id in (select user_id from _padre)
    and (t.category_id is null or t.category_id not in (select id from _k));
  get diagnostics n_tx = row_count;

  delete from public.scheduled_payments p
  where p.user_id in (select user_id from _padre)
    and (p.category_id is null or p.category_id not in (select id from _k));
  get diagnostics n_pagos = row_count;

  raise notice 'Listo: se borraron % movimientos y % pagos programados. Se conservaron los de "%".', n_tx, n_pagos, nombre;
end $$;

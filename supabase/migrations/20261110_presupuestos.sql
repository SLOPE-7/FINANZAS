-- Presupuesto mensual por categoría.
-- Ejecutar una vez en Supabase → SQL Editor. Es seguro repetirlo.
-- La app detecta la columna sola: sin ella, la opción de presupuesto no aparece.

alter table public.categories
  add column if not exists budget numeric(14, 2);

alter table public.categories
  drop constraint if exists categories_budget_nonnegative;

alter table public.categories
  add constraint categories_budget_nonnegative check (budget is null or budget >= 0);

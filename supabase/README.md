# Base de datos (Supabase)

La app usa estas tablas y funciones, creadas en el proyecto de Supabase:

| Objeto | Uso |
|---|---|
| `accounts` | Cuentas: banco, efectivo, tarjetas, ahorro… |
| `account_balances` (vista) | Cuentas con su saldo calculado (`balance`) |
| `transactions` | Ingresos, gastos y transferencias |
| `categories` | Categorías con subcategorías (`parent_id`) |
| `scheduled_payments` | Pagos programados y su recurrencia |
| `mark_payment_paid()` | Registra un pago programado como movimiento |
| `seed_default_categories()` | Crea las categorías iniciales de un usuario nuevo |

## Migraciones

Ejecuta en **SQL Editor** los archivos de `migrations/`, en orden:

1. `20261110_seguridad_vista_saldos.sql`: **recomendado**. Hace que la vista de saldos respete RLS.
2. `20261110_presupuestos.sql`: activa los presupuestos por categoría.

## Recuperar contraseña

Para que funcione "Olvidé mi contraseña", en **Authentication → URL Configuration**
agrega la URL de la app (por ejemplo `https://tu-app.vercel.app`) en *Site URL* y *Redirect URLs*.

> Conviene exportar el esquema actual (`supabase db dump --schema public`) y
> guardarlo aquí, para que la base de datos quede versionada junto al código.

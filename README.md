# Finanzas

App web de finanzas personales en lempiras, pensada para el celular.
Se instala en la pantalla de inicio (PWA).

## Qué hace

- **Inicio**: lo realmente disponible (bancos + efectivo − pagos de los próximos 30 días),
  ingresos y gastos del mes, tasa de ahorro, proyección de gasto, tendencia de 6 meses,
  próximos pagos, tarjetas (corte y pago), gastos por categoría con presupuesto.
- **Movimientos**: gastos, ingresos y transferencias por mes. Búsqueda, filtros,
  exportar a CSV, repetir un movimiento y comprobante imprimible.
  El monto acepta cuentas (`150+75`, `3*45`).
- **Pagos**: pagos programados con recurrencia, en lista por urgencia o en calendario,
  con resumen del mes y filtros. Pueden abonar a una tarjeta, un préstamo o un ahorro.
- **Cuentas**: saldo por cuenta, uso de tarjetas, historial por cuenta y *actualizar saldo*
  (corrige el saldo de hoy sin crear ingresos ni gastos falsos).
- **Préstamos**: al registrarlo, el capital entra a la cuenta elegida y queda la deuda.
  Cada cuota se paga con desglose *capital + intereses + otros cargos* en un solo pago:
  el capital baja la deuda y los intereses cuentan como gasto.
- **Más**: recibo en blanco (imagen para WhatsApp), categorías y presupuestos,
  tema claro/oscuro, ocultar cifras, cambiar contraseña.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y completa los valores de Supabase
npm run dev
npm test
```

Variables necesarias: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

La base de datos vive en Supabase; ver [`supabase/README.md`](supabase/README.md)
para las migraciones (presupuestos y seguridad de la vista de saldos).

-- ===== Migración: restar ahorro de una meta (2026-11-10) =====
-- Agrega el tipo 'retiro' a movimientos.
-- 'retiro' = plata que sacaste de una meta con "Restar ahorro" (metas.html).
-- Es lo contrario de 'ahorro': vuelve a lo que te queda del mes en Flujo.
-- Lleva meta_id igual que los ahorros: si se borra la meta, se borra también.

alter table movimientos drop constraint movimientos_tipo_check;
alter table movimientos add constraint movimientos_tipo_check
  check (tipo in ('ingreso', 'gasto', 'evitado', 'ahorro', 'retiro'));

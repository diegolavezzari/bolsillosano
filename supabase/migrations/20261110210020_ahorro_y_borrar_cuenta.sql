-- ===== Migración: ahorro en metas + borrar mi cuenta (2026-11-10) =====
-- Modifica la tabla movimientos (que ya existe) y agrega una función.
-- No toca ninguna otra tabla.


-- ----- 1. Que movimientos acepte el tipo 'ahorro' -----
-- 'ahorro' = plata que pasaste a una meta desde metas.html.
-- Se descuenta de lo que te queda del mes (igual que un gasto).
-- Para cambiar la regla del check hay que borrarla y crearla de nuevo con la palabra nueva
alter table movimientos drop constraint movimientos_tipo_check;
alter table movimientos add constraint movimientos_tipo_check
  check (tipo in ('ingreso', 'gasto', 'evitado', 'ahorro'));


-- ----- 2. De qué meta es cada ahorro -----
-- Vacía (null) en ingresos, gastos y compras evitadas; con el id de la meta en los ahorros.
-- on delete cascade: si se borra la meta, la base borra sola sus ahorros
-- y esa plata vuelve a lo que te queda del mes en Flujo
alter table movimientos add column meta_id bigint
  references metas(id) on delete cascade;


-- ----- 3. Borrar mi cuenta -----
-- Con la anon key el navegador no puede borrar usuarios.
-- security definer = corre con permisos de la base (el usuario solo no podría).
-- auth.uid() = el usuario logueado: borra al que la llama, y solo a él.
-- Al borrar el usuario, la base borra sola todos sus datos (on delete cascade en cada tabla)
create function borrar_mi_cuenta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Solo usuarios logueados pueden llamarla (nadie anónimo)
revoke execute on function borrar_mi_cuenta() from public, anon;
grant execute on function borrar_mi_cuenta() to authenticated;

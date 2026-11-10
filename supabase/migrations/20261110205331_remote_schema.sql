SET local check_function_bodies = off;

CREATE TABLE "public"."consultas" (
  "id"          bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "descripcion" text                     NOT NULL,
  "monto"       numeric                  NOT NULL,
  "estado"      text                     NOT NULL DEFAULT 'abierta'::text,
  "creada"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "consultas_estado_check" CHECK ((estado = ANY (ARRAY['abierta'::text, 'compro'::text, 'no_compro'::text]))),
  CONSTRAINT "consultas_monto_check" CHECK ((monto > (0)::numeric)),
  CONSTRAINT "consultas_pkey" PRIMARY KEY (id),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."consultas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."metas" (
  "id"       bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "nombre"   text                     NOT NULL,
  "objetivo" numeric                  NOT NULL,
  "ahorrado" numeric                  NOT NULL DEFAULT 0,
  "creada"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "metas_ahorrado_check" CHECK ((ahorrado >= (0)::numeric)),
  CONSTRAINT "metas_objetivo_check" CHECK ((objetivo > (0)::numeric)),
  CONSTRAINT "metas_pkey" PRIMARY KEY (id),
  "user_id"  uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."metas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."movimientos" (
  "id"          bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "tipo"        text    NOT NULL,
  "descripcion" text,
  "categoria"   text,
  "monto"       numeric NOT NULL,
  "fecha"       date    NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT "movimientos_monto_check" CHECK ((monto > (0)::numeric)),
  CONSTRAINT "movimientos_pkey" PRIMARY KEY (id),
  CONSTRAINT "movimientos_tipo_check" CHECK ((tipo = ANY (ARRAY['ingreso'::text, 'gasto'::text, 'evitado'::text]))),
  "user_id"     uuid    NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."movimientos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."perfiles" (
  "user_id" uuid NOT NULL,
  "nombre"  text NOT NULL,
  CONSTRAINT "perfiles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."perfiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."vinculos" (
  "id"         bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "para_email" text                     NOT NULL,
  "para"       uuid,
  "estado"     text                     NOT NULL DEFAULT 'pendiente'::text,
  "creado"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vinculos_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aceptado'::text]))),
  CONSTRAINT "vinculos_pkey" PRIMARY KEY (id),
  "de"         uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "vinculos_de_para_email_key" UNIQUE (de, para_email)
);

ALTER TABLE "public"."vinculos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."votos" (
  "id"          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "consulta_id" bigint NOT NULL,
  "voto"        text   NOT NULL,
  "comentario"  text,
  CONSTRAINT "votos_pkey" PRIMARY KEY (id),
  CONSTRAINT "votos_voto_check" CHECK ((voto = ANY (ARRAY['a_favor'::text, 'en_contra'::text]))),
  "user_id"     uuid   NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "votos_consulta_id_user_id_key" UNIQUE (consulta_id, user_id)
);

ALTER TABLE "public"."votos"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.crear_perfil()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.perfiles (user_id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre'));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."perfiles"
  ADD CONSTRAINT "perfiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."vinculos"
  ADD CONSTRAINT "vinculos_para_fkey" FOREIGN KEY (para) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."votos"
  ADD CONSTRAINT "votos_consulta_id_fkey" FOREIGN KEY (consulta_id) REFERENCES public.consultas(id) ON DELETE CASCADE;

CREATE TRIGGER al_registrarse
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.crear_perfil();

CREATE POLICY "cambiar mi nombre" ON "public"."perfiles"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "aceptar" ON "public"."vinculos"
  FOR UPDATE
  TO "authenticated"
  USING ((para_email = lower(( SELECT (auth.jwt() ->> 'email'::text)))))
  WITH CHECK (((para = ( SELECT auth.uid() AS uid)) AND (estado = 'aceptado'::text) AND (para_email = lower(( SELECT (auth.jwt() ->> 'email'::text))))));

CREATE POLICY "ver votos" ON "public"."votos"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.consultas c
  WHERE (c.id = votos.consulta_id))));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

GRANT EXECUTE ON FUNCTION "public"."crear_perfil"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."crear_perfil"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."crear_perfil"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."crear_perfil"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

REVOKE ALL ON SEQUENCE "public"."consultas_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."consultas_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."consultas_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."consultas_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."consultas_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."consultas_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."consultas_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."consultas_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."metas_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."metas_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."metas_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."metas_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."metas_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."metas_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."metas_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."metas_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."movimientos_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimientos_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."movimientos_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimientos_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."movimientos_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimientos_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."movimientos_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimientos_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."vinculos_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vinculos_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."vinculos_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vinculos_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."vinculos_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vinculos_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."vinculos_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vinculos_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."votos_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."votos_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."votos_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."votos_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."votos_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."votos_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."votos_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."votos_id_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultas" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."consultas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultas" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metas" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."metas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metas" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."movimientos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."perfiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vinculos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."vinculos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vinculos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vinculos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."votos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."votos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."votos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."votos" TO "service_role";

ALTER TABLE "public"."consultas"
  ADD CONSTRAINT "consultas_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "borrar mis consultas" ON "public"."consultas"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "cambiar mis consultas" ON "public"."consultas"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "crear mis consultas" ON "public"."consultas"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."metas"
  ADD CONSTRAINT "metas_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "solo mis metas" ON "public"."metas"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE "public"."movimientos"
  ADD CONSTRAINT "movimientos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "solo mis movimientos" ON "public"."movimientos"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE "public"."vinculos"
  ADD CONSTRAINT "vinculos_de_fkey" FOREIGN KEY (de) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "ver consultas" ON "public"."consultas"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.vinculos v
  WHERE
    ((v.estado = 'aceptado'::text) AND (((v.de = consultas.user_id) AND (v.para = ( SELECT auth.uid() AS uid))) OR ((v.para = consultas.user_id) AND (v.de = ( SELECT auth.uid() AS
    uid)))))))));

CREATE POLICY "ver perfiles" ON "public"."perfiles"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.vinculos v
  WHERE ((v.de = perfiles.user_id) OR (v.para = perfiles.user_id))))));

CREATE POLICY "borrar vinculo" ON "public"."vinculos"
  FOR DELETE
  TO "authenticated"
  USING (((de = ( SELECT auth.uid() AS uid)) OR (para_email = lower(( SELECT (auth.jwt() ->> 'email'::text))))));

CREATE POLICY "ver mis vinculos" ON "public"."vinculos"
  FOR SELECT
  TO "authenticated"
  USING (((de = ( SELECT auth.uid() AS uid)) OR (para = ( SELECT auth.uid() AS uid)) OR (para_email = lower(( SELECT (auth.jwt() ->> 'email'::text))))));

CREATE POLICY "invitar" ON "public"."vinculos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((de = ( SELECT auth.uid() AS uid)) AND (estado = 'pendiente'::text) AND (para IS NULL) AND (para_email <> lower(( SELECT (auth.jwt() ->> 'email'::text))))));

ALTER TABLE "public"."votos"
  ADD CONSTRAINT "votos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "borrar mi voto" ON "public"."votos"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "cambiar mi voto" ON "public"."votos"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "votar" ON "public"."votos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.consultas c
  WHERE ((c.id = votos.consulta_id) AND (c.estado = 'abierta'::text) AND (c.user_id <> ( SELECT auth.uid() AS uid)))))));


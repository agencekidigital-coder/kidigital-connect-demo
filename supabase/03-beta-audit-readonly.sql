-- Audit de structure uniquement : aucune donnée métier, aucun secret, aucune écriture.
-- Une requête, une cellule JSON à copier/exporter ; uniquement public.naitea_*.
-- Ne pas exécuter 02-auth-profile-trigger.sql pour réaliser cet audit.
WITH expected(table_name) AS (
  VALUES ('naitea_profiles'), ('naitea_workshops'), ('naitea_bookings'), ('naitea_stripe_accounts')
), candidates AS (
  SELECT table_name FROM expected UNION
  SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname ~ '^naitea_'
), tables_meta AS (
  SELECT e.table_name, c.oid IS NOT NULL AS table_exists,
         c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
  FROM candidates e LEFT JOIN pg_class c ON c.relname = e.table_name
    AND c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
), columns_meta AS (
  -- Aucun défaut, contenu de ligne ou secret.
  SELECT table_name, column_name, data_type, udt_schema, udt_name, is_nullable, ordinal_position
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name ~ '^naitea_'
), policies_meta AS (
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename ~ '^naitea_'
), constraints_meta AS (
  SELECT c.relname AS table_name, k.conname, k.contype, pg_get_constraintdef(k.oid, true) AS definition
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname ~ '^naitea_'
), indexes_meta AS (
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename ~ '^naitea_'
), triggers_meta AS (
  -- Noms seulement : aucun argument ni corps de fonction.
  SELECT c.relname AS table_name, t.tgname AS trigger_name
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname ~ '^naitea_' AND NOT t.tgisinternal
)
SELECT jsonb_build_object(
  'tables', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_name) FROM tables_meta t), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name, c.ordinal_position) FROM columns_meta c), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname) FROM policies_meta p), '[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(to_jsonb(k) ORDER BY k.table_name, k.conname) FROM constraints_meta k), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename, i.indexname) FROM indexes_meta i), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_name, t.trigger_name) FROM triggers_meta t), '[]'::jsonb)
) AS audit_metadata;

-- Lecture seule : une cellule JSON, sans données de comptes ni modification.
-- Vérifie les droits du profil et les déclencheurs sur auth.users.
-- Aucun argument, corps de fonction ou réglage autre que search_path n'est exporté.
WITH target AS (
  SELECT to_regclass('public.naitea_profiles')::oid AS table_oid
), roles AS (
  SELECT v.role_name, r.oid AS role_oid
  FROM (VALUES ('anon'), ('authenticated')) AS v(role_name)
  LEFT JOIN pg_roles r ON r.rolname = v.role_name
), column_permissions AS (
  SELECT r.role_name, c.column_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = t.table_oid
      AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped)
      THEN has_column_privilege(r.role_oid, t.table_oid, c.column_name, 'SELECT') END AS can_select,
    CASE WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = t.table_oid
      AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped)
      THEN has_column_privilege(r.role_oid, t.table_oid, c.column_name, 'UPDATE') END AS can_update
  FROM roles r CROSS JOIN target t
  CROSS JOIN (VALUES ('id'), ('full_name'), ('business_name')) AS c(column_name)
), permissions AS (
  SELECT r.role_name, r.role_oid IS NOT NULL AS role_exists,
    has_schema_privilege(r.role_oid, 'public'::regnamespace::oid, 'USAGE') AS public_schema_usage,
    has_schema_privilege(r.role_oid, 'public'::regnamespace::oid, 'CREATE') AS public_schema_create,
    has_table_privilege(r.role_oid, t.table_oid, 'SELECT') AS profile_select,
    has_table_privilege(r.role_oid, t.table_oid, 'INSERT') AS profile_insert,
    has_table_privilege(r.role_oid, t.table_oid, 'UPDATE') AS profile_update,
    has_table_privilege(r.role_oid, t.table_oid, 'DELETE') AS profile_delete,
    (SELECT jsonb_agg(to_jsonb(c) - 'role_name' ORDER BY c.column_name)
      FROM column_permissions c WHERE c.role_name = r.role_name) AS columns
  FROM roles r CROSS JOIN target t
), trigger_refs AS (
  SELECT t.tgname, t.tgenabled, t.tgtype::integer AS event_bits, t.tgfoid
  FROM pg_trigger t
  WHERE t.tgrelid = to_regclass('auth.users') AND NOT t.tgisinternal
), functions_meta AS (
  SELECT p.oid AS function_oid, n.nspname AS function_schema, p.proname AS function_name,
    pg_get_userbyid(p.proowner) AS owner_role, p.prosecdef AS security_definer,
    ARRAY(SELECT setting FROM unnest(p.proconfig) AS setting
      WHERE split_part(setting, '=', 1) = 'search_path') AS search_path_settings,
    has_function_privilege((SELECT role_oid FROM roles WHERE role_name = 'anon'), p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege((SELECT role_oid FROM roles WHERE role_name = 'authenticated'), p.oid, 'EXECUTE') AS authenticated_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f' AND ((n.nspname = 'public' AND p.proname ~ '^naitea_')
    OR p.oid IN (SELECT tgfoid FROM trigger_refs))
), triggers_meta AS (
  SELECT t.tgname AS trigger_name, t.tgenabled::text AS enabled,
    CASE WHEN (t.event_bits & 64) <> 0 THEN 'INSTEAD OF'
      WHEN (t.event_bits & 2) <> 0 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
    (t.event_bits & 1) <> 0 AS for_each_row,
    array_remove(ARRAY[
      CASE WHEN (t.event_bits & 4) <> 0 THEN 'INSERT' END,
      CASE WHEN (t.event_bits & 8) <> 0 THEN 'DELETE' END,
      CASE WHEN (t.event_bits & 16) <> 0 THEN 'UPDATE' END,
      CASE WHEN (t.event_bits & 32) <> 0 THEN 'TRUNCATE' END], NULL) AS events,
    f.*
  FROM trigger_refs t JOIN functions_meta f ON f.function_oid = t.tgfoid
)
SELECT jsonb_build_object(
  'profile_table_exists', (SELECT table_oid IS NOT NULL FROM target),
  'permissions', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.role_name) FROM permissions p), '[]'::jsonb),
  'auth_users_triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.trigger_name) FROM triggers_meta t), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.function_schema, f.function_name, f.function_oid) FROM functions_meta f), '[]'::jsonb)
) AS profile_readiness;

-- =============================================================================
-- 08. REGISTER EXISTING SCHEMAS
-- =============================================================================
-- Use this to add existing database schemas to the management system
-- This does NOT create the schema, just registers it in the tenants table
-- =============================================================================

-- =============================================================================
-- REGISTER A SINGLE SCHEMA
-- =============================================================================

-- Replace 'your_schema_name' with your actual schema name
-- Replace 'Display Name' with a friendly name (optional)

/*
INSERT INTO public.tenants (schema_name, display_name, status)
VALUES ('your_schema_name', 'Display Name', 'active')
ON CONFLICT (schema_name) DO NOTHING;
*/

-- =============================================================================
-- EXAMPLES
-- =============================================================================

-- Example 1: Register schema 'ordn'
/*
INSERT INTO public.tenants (schema_name, display_name, status)
VALUES ('ordn', 'Ordn System', 'active');
*/

-- Example 2: Register schema 'client_acme'
/*
INSERT INTO public.tenants (schema_name, display_name, status)
VALUES ('client_acme', 'Acme Corporation', 'active');
*/

-- Example 3: Register multiple schemas at once
/*
INSERT INTO public.tenants (schema_name, display_name, status)
VALUES 
  ('schema1', 'Schema One', 'active'),
  ('schema2', 'Schema Two', 'active'),
  ('schema3', 'Schema Three', 'suspended')
ON CONFLICT (schema_name) DO NOTHING;
*/

-- =============================================================================
-- AUTO-REGISTER ALL EXISTING SCHEMAS (Advanced)
-- =============================================================================

-- This will register ALL non-system schemas in your database
-- BE CAREFUL: This may include schemas you don't want to manage

/*
INSERT INTO public.tenants (schema_name, display_name, status)
SELECT 
  schema_name,
  schema_name,
  'active'
FROM information_schema.schemata
WHERE schema_name NOT IN (
  'public', 'auth', 'storage', 'graphql_public', 'graphql', 
  'realtime', 'supabase_functions', 'supabase_migrations',
  'extensions', 'vault', 'pgsodium', 'pgsodium_masks',
  'information_schema', 'pg_catalog', 'pg_toast'
)
AND schema_name NOT LIKE 'pg_%'
AND schema_name NOT LIKE 'supabase_%'
ON CONFLICT (schema_name) DO NOTHING;
*/

-- =============================================================================
-- VIEW REGISTERED SCHEMAS
-- =============================================================================

-- Check what schemas are registered:
-- SELECT * FROM public.tenants ORDER BY created_at DESC;


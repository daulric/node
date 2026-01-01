-- =============================================================================
-- 06. SCHEMA INSPECTION FUNCTIONS
-- =============================================================================
-- Functions for browsing tables and columns within schemas
-- Run after 03_helper_functions.sql
-- =============================================================================

-- =============================================================================
-- GET SCHEMA TABLES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_schema_tables(target_schema TEXT)
RETURNS TABLE(
  table_name TEXT,
  column_count BIGINT,
  row_count BIGINT,
  table_size TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  -- Verify schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = target_schema) THEN
    RAISE EXCEPTION 'Schema "%" not found', target_schema;
  END IF;

  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    (SELECT COUNT(*) FROM information_schema.columns c 
     WHERE c.table_schema = target_schema AND c.table_name = t.table_name)::BIGINT as column_count,
    0::BIGINT as row_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(target_schema) || '.' || quote_ident(t.table_name)))::TEXT as table_size,
    obj_description((quote_ident(target_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class')::TEXT as description
  FROM information_schema.tables t
  WHERE t.table_schema = target_schema
  AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

-- =============================================================================
-- GET TABLE COLUMNS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_table_columns(target_schema TEXT, target_table TEXT)
RETURNS TABLE(
  column_name TEXT,
  data_type TEXT,
  is_nullable BOOLEAN,
  column_default TEXT,
  is_primary_key BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    (c.is_nullable = 'YES')::BOOLEAN,
    c.column_default::TEXT,
    EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = target_schema
        AND tc.table_name = target_table
        AND kcu.column_name = c.column_name
    )::BOOLEAN as is_primary_key
  FROM information_schema.columns c
  WHERE c.table_schema = target_schema
  AND c.table_name = target_table
  ORDER BY c.ordinal_position;
END;
$$;

-- =============================================================================
-- GET TABLE ROW COUNT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_table_row_count(target_schema TEXT, target_table TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count BIGINT;
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM %I.%I', target_schema, target_table) INTO row_count;
  RETURN row_count;
END;
$$;

-- =============================================================================
-- GET FOREIGN KEYS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_table_foreign_keys(target_schema TEXT, target_table TEXT)
RETURNS TABLE(
  constraint_name TEXT,
  column_name TEXT,
  foreign_schema TEXT,
  foreign_table TEXT,
  foreign_column TEXT,
  on_update TEXT,
  on_delete TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  RETURN QUERY
  SELECT 
    tc.constraint_name::TEXT,
    kcu.column_name::TEXT,
    ccu.table_schema::TEXT as foreign_schema,
    ccu.table_name::TEXT as foreign_table,
    ccu.column_name::TEXT as foreign_column,
    rc.update_rule::TEXT as on_update,
    rc.delete_rule::TEXT as on_delete
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = target_schema
    AND tc.table_name = target_table
  ORDER BY tc.constraint_name;
END;
$$;

-- =============================================================================
-- GET ALL FOREIGN KEYS IN SCHEMA (for relationship diagram)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_schema_foreign_keys(target_schema TEXT)
RETURNS TABLE(
  source_table TEXT,
  source_column TEXT,
  target_table TEXT,
  target_column TEXT,
  constraint_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  RETURN QUERY
  SELECT 
    tc.table_name::TEXT as source_table,
    kcu.column_name::TEXT as source_column,
    ccu.table_name::TEXT as target_table,
    ccu.column_name::TEXT as target_column,
    tc.constraint_name::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = target_schema
  ORDER BY tc.table_name, kcu.column_name;
END;
$$;

-- =============================================================================
-- GET SCHEMA SUMMARY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_schema_summary(target_schema TEXT)
RETURNS TABLE(
  total_tables BIGINT,
  total_size TEXT,
  created_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM information_schema.tables t 
     WHERE t.table_schema = target_schema AND t.table_type = 'BASE TABLE')::BIGINT,
    (SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(target_schema) || '.' || quote_ident(t.table_name))))
     FROM information_schema.tables t 
     WHERE t.table_schema = target_schema AND t.table_type = 'BASE TABLE')::TEXT,
    tenant.created_at,
    tenant.status
  FROM public.tenants tenant
  WHERE tenant.schema_name = target_schema;
END;
$$;

-- =============================================================================
-- CREATE TABLE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_table(
  target_schema TEXT,
  table_name TEXT,
  columns JSONB  -- Array of {name, type, nullable, default, primary_key}
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col JSONB;
  col_defs TEXT[] := '{}';
  col_def TEXT;
  pk_cols TEXT[] := '{}';
BEGIN
  -- Check if user has write access
  IF NOT public.has_schema_access(target_schema, 'write') THEN
    RAISE EXCEPTION 'Access denied: you need write access to create tables';
  END IF;

  -- Validate table name
  IF table_name !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid table name: must be lowercase with letters, numbers, underscores';
  END IF;

  -- Check if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t 
    WHERE t.table_schema = target_schema AND t.table_name = create_table.table_name
  ) THEN
    RAISE EXCEPTION 'Table "%" already exists in schema "%"', table_name, target_schema;
  END IF;

  -- Build column definitions
  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    col_def := format('%I %s', col->>'name', col->>'type');
    
    IF (col->>'nullable')::boolean = false THEN
      col_def := col_def || ' NOT NULL';
    END IF;
    
    IF col->>'default' IS NOT NULL AND col->>'default' != '' THEN
      col_def := col_def || ' DEFAULT ' || (col->>'default');
    END IF;
    
    col_defs := array_append(col_defs, col_def);
    
    IF (col->>'primary_key')::boolean = true THEN
      pk_cols := array_append(pk_cols, format('%I', col->>'name'));
    END IF;
  END LOOP;

  -- Add primary key constraint if any
  IF array_length(pk_cols, 1) > 0 THEN
    col_defs := array_append(col_defs, 'PRIMARY KEY (' || array_to_string(pk_cols, ', ') || ')');
  END IF;

  -- Create the table
  EXECUTE format(
    'CREATE TABLE %I.%I (%s)',
    target_schema,
    table_name,
    array_to_string(col_defs, ', ')
  );

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'CREATE_TABLE', 'table', target_schema || '.' || table_name, columns);
END;
$$;

-- =============================================================================
-- ADD COLUMN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_column(
  target_schema TEXT,
  target_table TEXT,
  column_name TEXT,
  column_type TEXT,
  is_nullable BOOLEAN DEFAULT true,
  default_value TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sql TEXT;
BEGIN
  -- Check if user has write access
  IF NOT public.has_schema_access(target_schema, 'write') THEN
    RAISE EXCEPTION 'Access denied: you need write access to add columns';
  END IF;

  -- Validate column name
  IF column_name !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid column name: must be lowercase with letters, numbers, underscores';
  END IF;

  -- Check if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c 
    WHERE c.table_schema = target_schema 
    AND c.table_name = target_table 
    AND c.column_name = add_column.column_name
  ) THEN
    RAISE EXCEPTION 'Column "%" already exists in table "%"', column_name, target_table;
  END IF;

  -- Build SQL
  sql := format('ALTER TABLE %I.%I ADD COLUMN %I %s', 
    target_schema, target_table, column_name, column_type);
  
  IF NOT is_nullable THEN
    sql := sql || ' NOT NULL';
  END IF;
  
  IF default_value IS NOT NULL AND default_value != '' THEN
    sql := sql || ' DEFAULT ' || default_value;
  END IF;

  -- Execute
  EXECUTE sql;

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ADD_COLUMN', 'column', target_schema || '.' || target_table || '.' || column_name,
    jsonb_build_object('type', column_type, 'nullable', is_nullable, 'default', default_value));
END;
$$;

-- =============================================================================
-- ADD FOREIGN KEY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_foreign_key(
  target_schema TEXT,
  target_table TEXT,
  column_name TEXT,
  ref_schema TEXT,
  ref_table TEXT,
  ref_column TEXT,
  on_delete TEXT DEFAULT 'NO ACTION',
  on_update TEXT DEFAULT 'NO ACTION'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Check if user has write access
  IF NOT public.has_schema_access(target_schema, 'write') THEN
    RAISE EXCEPTION 'Access denied: you need write access to add foreign keys';
  END IF;

  -- Validate on_delete and on_update
  IF on_delete NOT IN ('NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT') THEN
    RAISE EXCEPTION 'Invalid on_delete action';
  END IF;
  
  IF on_update NOT IN ('NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT') THEN
    RAISE EXCEPTION 'Invalid on_update action';
  END IF;

  -- Generate constraint name
  constraint_name := target_table || '_' || column_name || '_fkey';

  -- Add the foreign key
  EXECUTE format(
    'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE %s ON UPDATE %s',
    target_schema, target_table, constraint_name, column_name,
    ref_schema, ref_table, ref_column,
    on_delete, on_update
  );

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ADD_FOREIGN_KEY', 'constraint', constraint_name,
    jsonb_build_object(
      'table', target_schema || '.' || target_table,
      'column', column_name,
      'references', ref_schema || '.' || ref_table || '.' || ref_column
    ));
END;
$$;

-- =============================================================================
-- GET AVAILABLE REFERENCE TABLES (for foreign keys)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reference_tables(target_schema TEXT)
RETURNS TABLE(
  schema_name TEXT,
  table_name TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'read') THEN
    RAISE EXCEPTION 'Access denied: you do not have access to this schema';
  END IF;

  -- Don't return tables if viewing the public schema
  IF target_schema = 'public' THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Tables from the current schema only (never public)
  SELECT 
    t.table_schema::TEXT,
    t.table_name::TEXT,
    t.table_name::TEXT as display_name
  FROM information_schema.tables t
  WHERE t.table_schema = target_schema
  AND t.table_schema != 'public'
  AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

-- =============================================================================
-- GET TABLE PRIMARY KEY COLUMNS (for foreign key references)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_table_pk_columns(target_schema TEXT, target_table TEXT)
RETURNS TABLE(
  column_name TEXT,
  data_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kcu.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.columns c
    ON c.table_schema = kcu.table_schema
    AND c.table_name = kcu.table_name
    AND c.column_name = kcu.column_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = target_schema
    AND tc.table_name = target_table
  ORDER BY kcu.ordinal_position;
END;
$$;

-- =============================================================================
-- DROP FOREIGN KEY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.drop_foreign_key(
  target_schema TEXT,
  target_table TEXT,
  constraint_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has write access
  IF NOT public.has_schema_access(target_schema, 'write') THEN
    RAISE EXCEPTION 'Access denied: you need write access to drop foreign keys';
  END IF;

  -- Execute
  EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', 
    target_schema, target_table, constraint_name);

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'DROP_FOREIGN_KEY', 'constraint', target_schema || '.' || target_table || '.' || constraint_name);
END;
$$;

-- =============================================================================
-- DROP COLUMN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.drop_column(
  target_schema TEXT,
  target_table TEXT,
  column_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has admin access (dropping is destructive)
  IF NOT public.has_schema_access(target_schema, 'admin') THEN
    RAISE EXCEPTION 'Access denied: you need admin access to drop columns';
  END IF;

  -- Execute
  EXECUTE format('ALTER TABLE %I.%I DROP COLUMN %I', 
    target_schema, target_table, column_name);

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'DROP_COLUMN', 'column', target_schema || '.' || target_table || '.' || column_name);
END;
$$;

-- =============================================================================
-- DROP TABLE
-- =============================================================================

-- Drop old function signature if exists
DROP FUNCTION IF EXISTS public.drop_table(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.drop_table(
  target_schema TEXT,
  target_table TEXT,
  force_cascade BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dependent_tables TEXT[];
  dep_count INTEGER;
  public_system_tables TEXT[] := ARRAY[
    'admin_users',
    'tenants', 
    'user_schema_access',
    'admin_audit_log'
  ];
  tenant_default_tables TEXT[] := ARRAY[
    'settings',
    'users',
    'audit_log'
  ];
BEGIN
  -- Check if user has admin access (dropping is destructive)
  IF NOT public.has_schema_access(target_schema, 'admin') THEN
    RAISE EXCEPTION 'Access denied: you need admin access to drop tables';
  END IF;

  -- Prevent deletion of protected system tables in public schema
  IF target_schema = 'public' AND target_table = ANY(public_system_tables) THEN
    RAISE EXCEPTION 'Cannot delete protected system table: %. This table is required for the application to function.', target_table;
  END IF;

  -- Prevent deletion of default tables in tenant schemas
  IF target_schema != 'public' AND target_table = ANY(tenant_default_tables) THEN
    RAISE EXCEPTION 'Cannot delete default table: %. This table is created by default in every schema.', target_table;
  END IF;

  -- Check for tables that depend on this table via foreign keys
  SELECT array_agg(DISTINCT tc.table_schema || '.' || tc.table_name)
  INTO dependent_tables
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name 
    AND ccu.constraint_schema = tc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema = target_schema
    AND ccu.table_name = target_table
    AND NOT (tc.table_schema = target_schema AND tc.table_name = target_table);

  dep_count := COALESCE(array_length(dependent_tables, 1), 0);

  -- If there are dependent tables and force_cascade is false, block deletion
  IF dep_count > 0 AND NOT force_cascade THEN
    RAISE EXCEPTION 'Cannot delete table: % other table(s) depend on it via foreign keys: %. Use force_cascade=true to delete anyway.',
      dep_count,
      array_to_string(dependent_tables, ', ');
  END IF;

  -- Execute the drop (use CASCADE only if force_cascade is true)
  IF force_cascade THEN
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', target_schema, target_table);
  ELSE
    EXECUTE format('DROP TABLE IF EXISTS %I.%I', target_schema, target_table);
  END IF;

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'DROP_TABLE', 'table', target_schema || '.' || target_table);
END;
$$;

GRANT EXECUTE ON FUNCTION public.drop_table TO authenticated;

-- =============================================================================
-- CHECK TENANT STATUS
-- =============================================================================
-- Allows any user (including anon) to check if a schema is active or suspended
-- Useful for client apps to show appropriate UI when suspended

CREATE OR REPLACE FUNCTION public.check_tenant_status(p_schema TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status::TEXT FROM public.tenants WHERE schema_name = p_schema;
$$;

-- =============================================================================
-- GET TENANT INFO (public)
-- =============================================================================
-- Returns basic tenant info that's safe to expose to clients

CREATE OR REPLACE FUNCTION public.get_tenant_info(p_schema TEXT)
RETURNS TABLE(
  schema_name TEXT,
  display_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.schema_name::TEXT,
    t.display_name::TEXT,
    t.status::TEXT,
    t.created_at
  FROM public.tenants t 
  WHERE t.schema_name = p_schema;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_schema_tables TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_row_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_foreign_keys TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schema_foreign_keys TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schema_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_table TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_column TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_foreign_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.drop_column TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reference_tables TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_pk_columns TO authenticated;
GRANT EXECUTE ON FUNCTION public.drop_foreign_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tenant_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tenant_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_info(TEXT) TO anon;

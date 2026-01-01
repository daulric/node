-- =============================================================================
-- 04. SCHEMA MANAGEMENT FUNCTIONS
-- =============================================================================
-- Functions for creating, suspending, activating, and deleting schemas
-- Run after 03_helper_functions.sql
-- =============================================================================

-- Drop existing functions to avoid signature conflicts (handles overloads)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      (quote_ident(n.nspname) || '.' || quote_ident(p.proname) || '(' ||
       pg_get_function_identity_arguments(p.oid) || ')') AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_tenant_schema',
        'suspend_tenant',
        'activate_tenant',
        'delete_tenant_schema',
        'create_user_profile',
        'get_user_profile'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn || ' CASCADE';
  END LOOP;
END
$$;

-- =============================================================================
-- CREATE SCHEMA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema(
  p_schema_name TEXT,
  p_display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  v_schema_exists BOOLEAN;
  v_schema_table_count BIGINT;
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can create schemas';
  END IF;

  -- Validate schema name format
  IF p_schema_name !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid schema name: must start with lowercase letter and contain only lowercase letters, numbers, and underscores';
  END IF;
  
  -- Validate schema name length
  IF LENGTH(p_schema_name) < 3 OR LENGTH(p_schema_name) > 63 THEN
    RAISE EXCEPTION 'Schema name must be between 3 and 63 characters';
  END IF;
  
  -- Check reserved names
  IF p_schema_name IN ('public', 'auth', 'storage', 'graphql', 'realtime', 'supabase', 'extensions', 'vault', 'pgsodium') 
     OR p_schema_name LIKE 'pg_%' 
     OR p_schema_name LIKE 'supabase_%' THEN
    RAISE EXCEPTION 'Schema name "%" is reserved and cannot be used', p_schema_name;
  END IF;

  -- Detect whether the schema already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.schemata s
    WHERE s.schema_name = p_schema_name
  ) INTO v_schema_exists;

  -- If schema exists, check whether it has any base tables
  IF v_schema_exists THEN
    SELECT COUNT(*)::BIGINT
    FROM information_schema.tables t
    WHERE t.table_schema = p_schema_name
      AND t.table_type = 'BASE TABLE'
    INTO v_schema_table_count;

    -- If schema has tables: register only (do not modify objects)
    IF v_schema_table_count > 0 THEN
      INSERT INTO public.tenants (schema_name, display_name, created_by)
      VALUES (p_schema_name, COALESCE(p_display_name, p_schema_name), auth.uid())
      ON CONFLICT (schema_name) DO NOTHING;

      SELECT id FROM public.tenants WHERE tenants.schema_name = p_schema_name
      INTO new_tenant_id;

      INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
      VALUES (auth.uid(), 'REGISTER_EXISTING', 'schema', p_schema_name, 
              jsonb_build_object('display_name', p_display_name));

      RETURN new_tenant_id;
    END IF;
  END IF;

  -- If schema doesn't exist, create it
  IF NOT v_schema_exists THEN
    EXECUTE format('CREATE SCHEMA %I', p_schema_name);
  END IF;

  -- Initialize default tables
  EXECUTE format('
    CREATE TABLE %I.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', p_schema_name);
  
  EXECUTE format('
    CREATE TABLE %I.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT ''user'',
      metadata JSONB DEFAULT ''{}''::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', p_schema_name);
  
  -- Create index for faster auth lookups
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_users_auth_user_id ON %I.users(auth_user_id)', 
                 p_schema_name, p_schema_name);

  EXECUTE format('
    CREATE TABLE %I.audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name TEXT NOT NULL,
      record_id UUID,
      action TEXT NOT NULL,
      old_data JSONB,
      new_data JSONB,
      performed_by UUID,
      performed_at TIMESTAMPTZ DEFAULT NOW()
    )', p_schema_name);

  -- Register tenant record
  INSERT INTO public.tenants (schema_name, display_name, created_by)
  VALUES (p_schema_name, COALESCE(p_display_name, p_schema_name), auth.uid())
  ON CONFLICT (schema_name) DO NOTHING;

  SELECT id FROM public.tenants WHERE tenants.schema_name = p_schema_name
  INTO new_tenant_id;
  
  -- Grant permissions
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', p_schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', p_schema_name);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO authenticated', p_schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', p_schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO authenticated', p_schema_name);
  
  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), CASE WHEN v_schema_exists THEN 'INIT_EXISTING_EMPTY' ELSE 'CREATE' END,
          'schema', p_schema_name, jsonb_build_object('display_name', p_display_name));
  
  RETURN new_tenant_id;
END;
$$;

-- =============================================================================
-- SUSPEND SCHEMA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.suspend_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can suspend schemas';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = suspend_tenant.schema_name) THEN
    RAISE EXCEPTION 'Schema "%" not found', schema_name;
  END IF;
  
  -- Check if already suspended
  IF EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = suspend_tenant.schema_name AND status = 'suspended') THEN
    RAISE EXCEPTION 'Schema "%" is already suspended', schema_name;
  END IF;
  
  -- Revoke permissions
  EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM authenticated', schema_name);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', schema_name);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM authenticated', schema_name);
  
  -- Update status
  UPDATE public.tenants 
  SET status = 'suspended', updated_at = NOW()
  WHERE tenants.schema_name = suspend_tenant.schema_name;
  
  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'SUSPEND', 'schema', schema_name);
END;
$$;

-- =============================================================================
-- ACTIVATE SCHEMA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.activate_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can activate schemas';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = activate_tenant.schema_name) THEN
    RAISE EXCEPTION 'Schema "%" not found', schema_name;
  END IF;
  
  -- Check if already active
  IF EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = activate_tenant.schema_name AND status = 'active') THEN
    RAISE EXCEPTION 'Schema "%" is already active', schema_name;
  END IF;
  
  -- Grant permissions
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO authenticated', schema_name);
  
  -- Update status
  UPDATE public.tenants 
  SET status = 'active', updated_at = NOW()
  WHERE tenants.schema_name = activate_tenant.schema_name;
  
  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'ACTIVATE', 'schema', schema_name);
END;
$$;

-- =============================================================================
-- DELETE SCHEMA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_tenant_schema(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protected_schemas TEXT[] := ARRAY['public', 'auth', 'storage', 'graphql', 'realtime', 'supabase_functions', 'extensions'];
BEGIN
  -- Check if user is a super admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: only super administrators can delete schemas';
  END IF;

  -- Prevent deletion of protected system schemas
  IF schema_name = ANY(protected_schemas) THEN
    RAISE EXCEPTION 'Cannot delete protected system schema: %. This schema is required for the application to function.', schema_name;
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = delete_tenant_schema.schema_name) THEN
    RAISE EXCEPTION 'Schema "%" not found', schema_name;
  END IF;
  
  -- Log the action BEFORE deletion
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'DELETE', 'schema', schema_name);
  
  -- Remove all user access records first
  DELETE FROM public.user_schema_access WHERE tenant_schema = delete_tenant_schema.schema_name;
  
  -- Drop the schema with CASCADE
  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
  
  -- Delete tenant record
  DELETE FROM public.tenants 
  WHERE tenants.schema_name = delete_tenant_schema.schema_name;
END;
$$;

-- =============================================================================
-- CREATE USER PROFILE IN SCHEMA
-- =============================================================================
-- Helper function to create a user profile in a specific tenant schema

CREATE OR REPLACE FUNCTION public.create_user_profile(
  target_schema TEXT,
  user_email TEXT,
  user_name TEXT DEFAULT NULL,
  user_role TEXT DEFAULT 'user',
  user_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
  auth_id UUID;
BEGIN
  -- Get the current user's auth ID
  auth_id := auth.uid();
  
  IF auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user has access to this schema
  IF NOT public.has_schema_access(target_schema, 'write') THEN
    RAISE EXCEPTION 'Access denied: you do not have write access to this schema';
  END IF;

  -- Check if profile already exists for this auth user
  EXECUTE format('
    SELECT id FROM %I.users WHERE auth_user_id = $1
  ', target_schema) INTO new_profile_id USING auth_id;
  
  IF new_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile already exists for this user in schema %', target_schema;
  END IF;

  -- Create the profile
  EXECUTE format('
    INSERT INTO %I.users (auth_user_id, email, name, role, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  ', target_schema) INTO new_profile_id USING auth_id, user_email, user_name, user_role, user_metadata;

  RETURN new_profile_id;
END;
$$;

-- =============================================================================
-- GET USER PROFILE FROM SCHEMA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_profile(target_schema TEXT)
RETURNS TABLE(
  id UUID,
  auth_user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
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

  RETURN QUERY EXECUTE format('
    SELECT u.id, u.auth_user_id, u.email, u.name, u.role, u.metadata, u.created_at
    FROM %I.users u
    WHERE u.auth_user_id = $1
  ', target_schema) USING auth.uid();
END;
$$;

-- =============================================================================
-- ENSURE USER PROFILE (UPSERT)
-- =============================================================================
-- Creates profile if it doesn't exist, returns existing if it does
-- Safe to call on every login/signup - handles both cases

CREATE OR REPLACE FUNCTION public.ensure_user_profile(
  target_schema TEXT,
  user_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  auth_user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
  v_email TEXT;
  v_profile_id UUID;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Get current auth user
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get email from auth.users
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_auth_id;

  -- Check if profile exists in this tenant
  EXECUTE format('SELECT u.id FROM %I.users u WHERE u.auth_user_id = $1', target_schema)
  INTO v_profile_id USING v_auth_id;

  -- Create if doesn't exist
  IF v_profile_id IS NULL THEN
    EXECUTE format('
      INSERT INTO %I.users (auth_user_id, email, name, role, metadata)
      VALUES ($1, $2, $3, ''user'', ''{}''::jsonb)
      RETURNING id
    ', target_schema) INTO v_profile_id USING v_auth_id, v_email, user_name;
    v_is_new := TRUE;
  END IF;

  -- Return the full profile
  RETURN QUERY EXECUTE format('
    SELECT u.id, u.auth_user_id, u.email, u.name, u.role, u.metadata, u.created_at, $2::boolean
    FROM %I.users u WHERE u.id = $1
  ', target_schema) USING v_profile_id, v_is_new;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_tenant_schema(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_tenant(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_tenant(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_schema(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(TEXT, TEXT) TO authenticated;


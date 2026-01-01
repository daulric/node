-- =============================================================================
-- MULTI-TENANT SCHEMA MANAGEMENT - DATABASE SETUP WITH AUTHENTICATION
-- =============================================================================
-- Run this script in your Supabase SQL Editor to set up all required tables
-- and RPC functions for the multi-tenant schema management system.
-- =============================================================================

-- ============================================
-- 1. ADMIN USERS TABLE (for system administrators)
-- ============================================

-- Admin users who can manage all schemas
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS 'System administrators who can manage tenant schemas';
COMMENT ON COLUMN public.admin_users.role IS 'super_admin: full access, admin: manage schemas, viewer: read-only';

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);

-- ============================================
-- 2. TENANTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS 'Stores metadata for each tenant/client schema';
COMMENT ON COLUMN public.tenants.schema_name IS 'The PostgreSQL schema name for this tenant';
COMMENT ON COLUMN public.tenants.status IS 'Current access status: active or suspended';

CREATE INDEX IF NOT EXISTS idx_tenants_schema_name ON public.tenants(schema_name);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- ============================================
-- 3. TENANT PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_schema TEXT NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_schema, product_name)
);

COMMENT ON TABLE public.tenant_products IS 'Tracks enabled product modules for each tenant';
COMMENT ON COLUMN public.tenant_products.product_name IS 'Product module ID: inventory, crm, billing, analytics, hr, projects';

CREATE INDEX IF NOT EXISTS idx_tenant_products_tenant ON public.tenant_products(tenant_schema);

-- ============================================
-- 4. USER SCHEMA ACCESS TABLE (Access Control)
-- ============================================

-- Maps which users have access to which tenant schemas
CREATE TABLE IF NOT EXISTS public.user_schema_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_schema TEXT NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
  granted_by UUID REFERENCES public.admin_users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, tenant_schema)
);

COMMENT ON TABLE public.user_schema_access IS 'Controls which users can access which tenant schemas';
COMMENT ON COLUMN public.user_schema_access.access_level IS 'read: view only, write: CRUD operations, admin: full control including user management';
COMMENT ON COLUMN public.user_schema_access.expires_at IS 'Optional expiration date for temporary access';

CREATE INDEX IF NOT EXISTS idx_user_schema_access_user ON public.user_schema_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schema_access_schema ON public.user_schema_access(tenant_schema);

-- ============================================
-- 5. AUDIT LOG TABLE (Track all admin actions)
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_audit_log IS 'Audit trail for all administrative actions';

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schema_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. HELPER FUNCTIONS FOR RLS
-- ============================================

-- Check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE id = auth.uid() 
    AND is_active = true
  );
$$;

-- Check if the current user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
    AND is_active = true
  );
$$;

-- Check if user has access to a specific schema
CREATE OR REPLACE FUNCTION public.has_schema_access(schema_name TEXT, required_level TEXT DEFAULT 'read')
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schema_access usa
    WHERE usa.user_id = auth.uid()
    AND usa.tenant_schema = schema_name
    AND (usa.expires_at IS NULL OR usa.expires_at > NOW())
    AND (
      required_level = 'read' 
      OR (required_level = 'write' AND usa.access_level IN ('write', 'admin'))
      OR (required_level = 'admin' AND usa.access_level = 'admin')
    )
  )
  OR public.is_admin();
$$;

-- Get all schemas the current user has access to
CREATE OR REPLACE FUNCTION public.get_accessible_schemas()
RETURNS TABLE(tenant_schema TEXT, access_level TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Admins can access all schemas
  SELECT t.schema_name, 'admin'::TEXT
  FROM public.tenants t
  WHERE public.is_admin()
  
  UNION
  
  -- Non-admins only see schemas they have explicit access to
  SELECT usa.tenant_schema, usa.access_level
  FROM public.user_schema_access usa
  WHERE usa.user_id = auth.uid()
  AND (usa.expires_at IS NULL OR usa.expires_at > NOW())
  AND NOT public.is_admin();
$$;

-- ============================================
-- 8. RLS POLICIES
-- ============================================

-- Drop existing policies (for re-running the script)
DO $$ 
BEGIN
  -- admin_users policies
  DROP POLICY IF EXISTS "Admin users: admins can view all" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can insert" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can update" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can delete" ON public.admin_users;
  
  -- tenants policies
  DROP POLICY IF EXISTS "Tenants: admins can view all" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: users see accessible only" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: admins can insert" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: admins can update" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: super_admin can delete" ON public.tenants;
  
  -- tenant_products policies
  DROP POLICY IF EXISTS "Products: view if has schema access" ON public.tenant_products;
  DROP POLICY IF EXISTS "Products: admins can insert" ON public.tenant_products;
  DROP POLICY IF EXISTS "Products: admins can update" ON public.tenant_products;
  DROP POLICY IF EXISTS "Products: admins can delete" ON public.tenant_products;
  
  -- user_schema_access policies
  DROP POLICY IF EXISTS "Access: admins can view all" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: users see own access" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can insert" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can update" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can delete" ON public.user_schema_access;
  
  -- audit_log policies
  DROP POLICY IF EXISTS "Audit: admins can view" ON public.admin_audit_log;
  DROP POLICY IF EXISTS "Audit: system can insert" ON public.admin_audit_log;
END $$;

-- Admin Users Policies
CREATE POLICY "Admin users: admins can view all" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin users: super_admin can insert" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admin users: super_admin can update" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admin users: super_admin can delete" ON public.admin_users
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Tenants Policies
CREATE POLICY "Tenants: admins can view all" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR EXISTS (
      SELECT 1 FROM public.user_schema_access usa 
      WHERE usa.user_id = auth.uid() 
      AND usa.tenant_schema = schema_name
      AND (usa.expires_at IS NULL OR usa.expires_at > NOW())
    )
  );

CREATE POLICY "Tenants: admins can insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenants: admins can update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Tenants: super_admin can delete" ON public.tenants
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Tenant Products Policies
CREATE POLICY "Products: view if has schema access" ON public.tenant_products
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_schema_access usa 
      WHERE usa.user_id = auth.uid() 
      AND usa.tenant_schema = tenant_products.tenant_schema
      AND (usa.expires_at IS NULL OR usa.expires_at > NOW())
    )
  );

CREATE POLICY "Products: admins can insert" ON public.tenant_products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Products: admins can update" ON public.tenant_products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Products: admins can delete" ON public.tenant_products
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- User Schema Access Policies
CREATE POLICY "Access: admins can view all" ON public.user_schema_access
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "Access: admins can insert" ON public.user_schema_access
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Access: admins can update" ON public.user_schema_access
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Access: admins can delete" ON public.user_schema_access
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Audit Log Policies
CREATE POLICY "Audit: admins can view" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Audit: authenticated can insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- 9. RPC FUNCTION: CREATE TENANT SCHEMA
-- ============================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema(
  schema_name TEXT,
  products TEXT[] DEFAULT '{}',
  display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product TEXT;
  new_tenant_id UUID;
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can create tenant schemas';
  END IF;

  -- Validate schema name format
  IF schema_name !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid schema name: must start with lowercase letter and contain only lowercase letters, numbers, and underscores';
  END IF;
  
  -- Validate schema name length
  IF LENGTH(schema_name) < 3 OR LENGTH(schema_name) > 63 THEN
    RAISE EXCEPTION 'Schema name must be between 3 and 63 characters';
  END IF;
  
  -- Check reserved names
  IF schema_name IN ('public', 'auth', 'storage', 'graphql', 'realtime', 'supabase', 'extensions', 'vault', 'pgsodium') 
     OR schema_name LIKE 'pg_%' 
     OR schema_name LIKE 'supabase_%' THEN
    RAISE EXCEPTION 'Schema name "%" is reserved and cannot be used', schema_name;
  END IF;

  -- Check if schema already exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE information_schema.schemata.schema_name = create_tenant_schema.schema_name) THEN
    RAISE EXCEPTION 'Schema "%" already exists', schema_name;
  END IF;

  -- Create the schema
  EXECUTE format('CREATE SCHEMA %I', schema_name);
  
  -- Create standard tables in the tenant schema
  EXECUTE format('
    CREATE TABLE %I.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);
  
  EXECUTE format('
    CREATE TABLE %I.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT ''user'',
      metadata JSONB DEFAULT ''{}''::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

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
    )', schema_name);

  -- Insert tenant record
  INSERT INTO public.tenants (schema_name, display_name, created_by)
  VALUES (create_tenant_schema.schema_name, COALESCE(display_name, schema_name), auth.uid())
  RETURNING id INTO new_tenant_id;
  
  -- Insert enabled products
  IF array_length(products, 1) > 0 THEN
    FOREACH product IN ARRAY products
    LOOP
      INSERT INTO public.tenant_products (tenant_schema, product_name, enabled)
      VALUES (create_tenant_schema.schema_name, product, true);
    END LOOP;
  END IF;
  
  -- Grant usage permissions
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO authenticated', schema_name);
  
  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'CREATE', 'tenant_schema', schema_name, jsonb_build_object('products', products, 'display_name', display_name));
  
  RETURN new_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.create_tenant_schema IS 'Creates a new tenant schema with standard tables and grants permissions';

-- ============================================
-- 10. RPC FUNCTION: SUSPEND TENANT
-- ============================================

CREATE OR REPLACE FUNCTION public.suspend_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can suspend tenants';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = suspend_tenant.schema_name) THEN
    RAISE EXCEPTION 'Tenant "%" not found', schema_name;
  END IF;
  
  -- Check if already suspended
  IF EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = suspend_tenant.schema_name AND status = 'suspended') THEN
    RAISE EXCEPTION 'Tenant "%" is already suspended', schema_name;
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
  VALUES (auth.uid(), 'SUSPEND', 'tenant_schema', schema_name);
END;
$$;

COMMENT ON FUNCTION public.suspend_tenant IS 'Suspends a tenant by revoking all schema permissions';

-- ============================================
-- 11. RPC FUNCTION: ACTIVATE TENANT
-- ============================================

CREATE OR REPLACE FUNCTION public.activate_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can activate tenants';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = activate_tenant.schema_name) THEN
    RAISE EXCEPTION 'Tenant "%" not found', schema_name;
  END IF;
  
  -- Check if already active
  IF EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = activate_tenant.schema_name AND status = 'active') THEN
    RAISE EXCEPTION 'Tenant "%" is already active', schema_name;
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
  VALUES (auth.uid(), 'ACTIVATE', 'tenant_schema', schema_name);
END;
$$;

COMMENT ON FUNCTION public.activate_tenant IS 'Reactivates a suspended tenant by restoring schema permissions';

-- ============================================
-- 12. RPC FUNCTION: DELETE TENANT SCHEMA
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_tenant_schema(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is a super admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: only super administrators can delete tenant schemas';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = delete_tenant_schema.schema_name) THEN
    RAISE EXCEPTION 'Tenant "%" not found', schema_name;
  END IF;
  
  -- Log the action BEFORE deletion
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'DELETE', 'tenant_schema', schema_name);
  
  -- Remove all user access records first
  DELETE FROM public.user_schema_access WHERE tenant_schema = delete_tenant_schema.schema_name;
  
  -- Drop the schema with CASCADE
  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
  
  -- Delete tenant record (products will cascade delete due to FK)
  DELETE FROM public.tenants 
  WHERE tenants.schema_name = delete_tenant_schema.schema_name;
END;
$$;

COMMENT ON FUNCTION public.delete_tenant_schema IS 'Permanently deletes a tenant schema and all its data';

-- ============================================
-- 13. RPC FUNCTION: GRANT SCHEMA ACCESS
-- ============================================

CREATE OR REPLACE FUNCTION public.grant_schema_access(
  target_user_id UUID,
  target_schema TEXT,
  access_level TEXT DEFAULT 'read',
  expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_id UUID;
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can grant schema access';
  END IF;

  -- Validate access level
  IF access_level NOT IN ('read', 'write', 'admin') THEN
    RAISE EXCEPTION 'Invalid access level. Must be: read, write, or admin';
  END IF;

  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE schema_name = target_schema) THEN
    RAISE EXCEPTION 'Tenant schema "%" not found', target_schema;
  END IF;

  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Insert or update access
  INSERT INTO public.user_schema_access (user_id, tenant_schema, access_level, granted_by, expires_at)
  VALUES (target_user_id, target_schema, access_level, auth.uid(), grant_schema_access.expires_at)
  ON CONFLICT (user_id, tenant_schema) 
  DO UPDATE SET 
    access_level = EXCLUDED.access_level,
    granted_by = EXCLUDED.granted_by,
    granted_at = NOW(),
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO access_id;

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'GRANT_ACCESS', 'user_schema_access', access_id::TEXT, 
    jsonb_build_object('target_user', target_user_id, 'schema', target_schema, 'level', access_level));

  RETURN access_id;
END;
$$;

COMMENT ON FUNCTION public.grant_schema_access IS 'Grants a user access to a specific tenant schema';

-- ============================================
-- 14. RPC FUNCTION: REVOKE SCHEMA ACCESS
-- ============================================

CREATE OR REPLACE FUNCTION public.revoke_schema_access(
  target_user_id UUID,
  target_schema TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can revoke schema access';
  END IF;

  -- Delete access record
  DELETE FROM public.user_schema_access 
  WHERE user_id = target_user_id AND tenant_schema = target_schema;

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, details)
  VALUES (auth.uid(), 'REVOKE_ACCESS', 'user_schema_access', 
    jsonb_build_object('target_user', target_user_id, 'schema', target_schema));
END;
$$;

COMMENT ON FUNCTION public.revoke_schema_access IS 'Revokes a user''s access to a specific tenant schema';

-- ============================================
-- 15. RPC FUNCTION: GET CURRENT USER INFO
-- ============================================

CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  is_admin BOOLEAN,
  is_super_admin BOOLEAN,
  admin_role TEXT,
  accessible_schemas JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as user_id,
    (SELECT au.email FROM auth.users au WHERE au.id = auth.uid()) as email,
    public.is_admin() as is_admin,
    public.is_super_admin() as is_super_admin,
    (SELECT role FROM public.admin_users WHERE id = auth.uid()) as admin_role,
    (
      SELECT jsonb_agg(jsonb_build_object('schema', tenant_schema, 'level', access_level))
      FROM public.get_accessible_schemas()
    ) as accessible_schemas;
END;
$$;

-- ============================================
-- 16. TRIGGER: AUTO-CREATE ADMIN USER ON SIGNUP
-- ============================================

-- This trigger can auto-promote certain users to admin based on email domain
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Example: Auto-promote users with @yourdomain.com email to admin
  -- Modify the domain check as needed for your use case
  -- IF NEW.email LIKE '%@yourdomain.com' THEN
  --   INSERT INTO public.admin_users (id, email, full_name, role)
  --   VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'admin');
  -- END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger (uncomment if you want auto-admin creation)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 17. GRANT EXECUTE PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_schema_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_schemas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_info TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_tenant_schema TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_schema TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_schema_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_schema_access TO authenticated;

-- ============================================
-- 18. RPC FUNCTION: GET USER BY EMAIL (for access management UI)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_by_email(target_email TEXT)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can look up users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can look up users';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  WHERE au.email = target_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_by_email TO authenticated;

-- ============================================
-- 19. RPC FUNCTION: LIST ALL USERS (for admin UI)
-- ============================================

CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE(
  id UUID, 
  email TEXT, 
  created_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  admin_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can list users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: only administrators can list users';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    au.created_at,
    EXISTS (SELECT 1 FROM public.admin_users adm WHERE adm.id = au.id AND adm.is_active) as is_admin,
    (SELECT role FROM public.admin_users adm WHERE adm.id = au.id) as admin_role
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_users TO authenticated;

-- ============================================
-- 20. RPC FUNCTION: PROMOTE USER TO ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.promote_to_admin(
  target_user_id UUID,
  admin_role TEXT DEFAULT 'admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins can promote users
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: only super administrators can promote users to admin';
  END IF;

  -- Validate role
  IF admin_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role. Must be: admin or viewer';
  END IF;

  -- Get user email
  INSERT INTO public.admin_users (id, email, role)
  SELECT target_user_id, au.email, promote_to_admin.admin_role
  FROM auth.users au
  WHERE au.id = target_user_id
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    is_active = true,
    updated_at = NOW();

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'PROMOTE_ADMIN', 'admin_users', target_user_id::TEXT, 
    jsonb_build_object('role', admin_role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_to_admin TO authenticated;

-- ============================================
-- 21. RPC FUNCTION: REVOKE ADMIN ACCESS
-- ============================================

CREATE OR REPLACE FUNCTION public.revoke_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins can revoke admin access
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: only super administrators can revoke admin access';
  END IF;

  -- Can't revoke own access
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own admin access';
  END IF;

  -- Deactivate admin
  UPDATE public.admin_users 
  SET is_active = false, updated_at = NOW()
  WHERE id = target_user_id;

  -- Log the action
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id)
  VALUES (auth.uid(), 'REVOKE_ADMIN', 'admin_users', target_user_id::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_admin TO authenticated;

-- ============================================
-- 22. RPC FUNCTION: GET SCHEMA TABLES
-- ============================================

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
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = target_schema AND c.table_name = t.table_name)::BIGINT as column_count,
    0::BIGINT as row_count, -- We'll get actual counts separately for performance
    pg_size_pretty(pg_total_relation_size(quote_ident(target_schema) || '.' || quote_ident(t.table_name)))::TEXT as table_size,
    obj_description((quote_ident(target_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class')::TEXT as description
  FROM information_schema.tables t
  WHERE t.table_schema = target_schema
  AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_schema_tables TO authenticated;

-- ============================================
-- 23. RPC FUNCTION: GET TABLE COLUMNS
-- ============================================

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

GRANT EXECUTE ON FUNCTION public.get_table_columns TO authenticated;

-- ============================================
-- 24. RPC FUNCTION: GET TABLE ROW COUNT
-- ============================================

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

GRANT EXECUTE ON FUNCTION public.get_table_row_count TO authenticated;

-- ============================================
-- 25. CREATE FIRST SUPER ADMIN
-- ============================================
-- Run this AFTER creating your first user through Supabase Auth
-- Replace the UUID with your actual user ID from auth.users

/*
-- Find your user ID:
SELECT id, email FROM auth.users;

-- Then insert as super admin:
INSERT INTO public.admin_users (id, email, full_name, role)
VALUES (
  'YOUR-USER-UUID-HERE',  -- Replace with actual UUID
  'admin@example.com',     -- Replace with actual email
  'Super Admin',
  'super_admin'
);
*/

-- ============================================
-- 19. SAMPLE DATA (Optional)
-- ============================================

/*
-- Create some test tenants (must be logged in as admin):
SELECT public.create_tenant_schema('client_acme', ARRAY['inventory', 'crm', 'billing'], 'Acme Corporation');
SELECT public.create_tenant_schema('client_globex', ARRAY['crm', 'analytics'], 'Globex Inc');
SELECT public.create_tenant_schema('client_initech', ARRAY['inventory', 'hr', 'projects'], 'Initech LLC');
*/

-- ============================================
-- DONE!
-- ============================================

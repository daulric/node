-- =============================================================================
-- 02. ROW LEVEL SECURITY POLICIES
-- =============================================================================
-- Enable RLS and create policies for all tables
-- Run after 01_tables.sql and 03_helper_functions.sql
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schema_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Drop existing policies (for re-running)
-- =============================================================================

DO $$ 
BEGIN
  -- admin_users policies
  DROP POLICY IF EXISTS "Admin users: admins can view all" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can insert" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can update" ON public.admin_users;
  DROP POLICY IF EXISTS "Admin users: super_admin can delete" ON public.admin_users;
  
  -- tenants policies
  DROP POLICY IF EXISTS "Tenants: view accessible" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: admins can insert" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: admins can update" ON public.tenants;
  DROP POLICY IF EXISTS "Tenants: super_admin can delete" ON public.tenants;
  
  -- user_schema_access policies
  DROP POLICY IF EXISTS "Access: view own or admin" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can insert" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can update" ON public.user_schema_access;
  DROP POLICY IF EXISTS "Access: admins can delete" ON public.user_schema_access;
  
  -- audit_log policies
  DROP POLICY IF EXISTS "Audit: admins can view" ON public.admin_audit_log;
  DROP POLICY IF EXISTS "Audit: authenticated can insert" ON public.admin_audit_log;
END $$;

-- =============================================================================
-- Admin Users Policies
-- =============================================================================

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

-- =============================================================================
-- Tenants Policies
-- =============================================================================

CREATE POLICY "Tenants: view accessible" ON public.tenants
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

-- =============================================================================
-- User Schema Access Policies
-- =============================================================================

CREATE POLICY "Access: view own or admin" ON public.user_schema_access
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

-- =============================================================================
-- Audit Log Policies
-- =============================================================================

CREATE POLICY "Audit: admins can view" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Audit: authenticated can insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);


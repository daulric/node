-- =============================================================================
-- 03. HELPER FUNCTIONS
-- =============================================================================
-- Utility functions for checking permissions and access
-- Run after 01_tables.sql
-- =============================================================================

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

-- Get current user info
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_schema_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_schemas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_info TO authenticated;


-- =============================================================================
-- 05. ACCESS CONTROL FUNCTIONS
-- =============================================================================
-- Functions for managing user access to schemas and admin roles
-- Run after 03_helper_functions.sql
-- =============================================================================

-- =============================================================================
-- GET USER BY EMAIL
-- =============================================================================

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

-- =============================================================================
-- LIST USERS
-- =============================================================================

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

-- =============================================================================
-- GRANT SCHEMA ACCESS
-- =============================================================================

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

  -- Verify schema exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE schema_name = target_schema) THEN
    RAISE EXCEPTION 'Schema "%" not found', target_schema;
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

-- =============================================================================
-- REVOKE SCHEMA ACCESS
-- =============================================================================

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

-- =============================================================================
-- PROMOTE USER TO ADMIN
-- =============================================================================

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

  -- Get user email and insert/update admin record
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

-- =============================================================================
-- REVOKE ADMIN ACCESS
-- =============================================================================

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_schema_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_schema_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin TO authenticated;


-- =============================================================================
-- 01. TABLES
-- =============================================================================
-- Core tables for the multi-tenant schema management system
-- Run this first before any other scripts
-- =============================================================================

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

-- Tenants/Schemas table
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

-- User schema access (maps users to schemas they can access)
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
COMMENT ON COLUMN public.user_schema_access.access_level IS 'read: view only, write: CRUD, admin: full control';
COMMENT ON COLUMN public.user_schema_access.expires_at IS 'Optional expiration for temporary access';

CREATE INDEX IF NOT EXISTS idx_user_schema_access_user ON public.user_schema_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schema_access_schema ON public.user_schema_access(tenant_schema);

-- Audit log for tracking admin actions
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


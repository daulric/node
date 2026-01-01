/*
=============================================================================
SUPABASE SQL SETUP - Run these in your Supabase SQL Editor
=============================================================================

-- 1. Create the tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the tenant_products table
CREATE TABLE IF NOT EXISTS public.tenant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_schema TEXT NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(tenant_schema, product_name)
);

-- 3. Enable Row Level Security (optional, adjust as needed)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Allow authenticated read access" ON public.tenants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON public.tenant_products
  FOR SELECT TO authenticated USING (true);

-- 4. RPC Function: Create Tenant Schema
CREATE OR REPLACE FUNCTION public.create_tenant_schema(
  schema_name TEXT,
  products TEXT[] DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product TEXT;
BEGIN
  -- Validate schema name
  IF schema_name !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid schema name: must start with lowercase letter and contain only lowercase letters, numbers, and underscores';
  END IF;
  
  IF LENGTH(schema_name) < 3 OR LENGTH(schema_name) > 63 THEN
    RAISE EXCEPTION 'Schema name must be between 3 and 63 characters';
  END IF;
  
  -- Check reserved names
  IF schema_name IN ('public', 'auth', 'storage', 'graphql', 'realtime', 'supabase') 
     OR schema_name LIKE 'pg_%' THEN
    RAISE EXCEPTION 'Schema name is reserved';
  END IF;

  -- Create the schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- Create example tables in the tenant schema (customize as needed)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);
  
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT ''user'',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  -- Insert tenant record
  INSERT INTO public.tenants (schema_name, status)
  VALUES (schema_name, 'active');
  
  -- Insert products
  FOREACH product IN ARRAY products
  LOOP
    INSERT INTO public.tenant_products (tenant_schema, product_name, enabled)
    VALUES (schema_name, product, true);
  END LOOP;
  
  -- Grant usage to authenticated users (adjust as needed)
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', schema_name);
END;
$$;

-- 5. RPC Function: Suspend Tenant
CREATE OR REPLACE FUNCTION public.suspend_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = suspend_tenant.schema_name) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
  
  -- Revoke permissions
  EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM authenticated', schema_name);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', schema_name);
  
  -- Update status
  UPDATE public.tenants 
  SET status = 'suspended' 
  WHERE tenants.schema_name = suspend_tenant.schema_name;
END;
$$;

-- 6. RPC Function: Activate Tenant
CREATE OR REPLACE FUNCTION public.activate_tenant(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = activate_tenant.schema_name) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
  
  -- Grant permissions
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  
  -- Update status
  UPDATE public.tenants 
  SET status = 'active' 
  WHERE tenants.schema_name = activate_tenant.schema_name;
END;
$$;

-- 7. RPC Function: Delete Tenant Schema
CREATE OR REPLACE FUNCTION public.delete_tenant_schema(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE tenants.schema_name = delete_tenant_schema.schema_name) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
  
  -- Drop the schema with CASCADE
  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
  
  -- Delete tenant record (products will cascade delete)
  DELETE FROM public.tenants 
  WHERE tenants.schema_name = delete_tenant_schema.schema_name;
END;
$$;

-- 8. Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.create_tenant_schema TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_schema TO authenticated;

=============================================================================
*/

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { TenantWithProducts, TenantStatus } from '@/types/database'
import { TenantTable } from './components/tenant-table'
import { CreateTenantForm } from './components/create-tenant-form'
import { TenantTableSkeleton } from './components/tenant-table-skeleton'
import { UserNav } from './components/user-nav'
import { Database, Shield, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface UserInfo {
  email: string
  isAdmin: boolean
  isSuperAdmin: boolean
  role: string | null
}

async function getUser(): Promise<UserInfo | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if user is an admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const isAdmin = adminUser?.is_active === true
  const isSuperAdmin = adminUser?.role === 'super_admin' && adminUser?.is_active === true

  return {
    email: user.email || '',
    isAdmin,
    isSuperAdmin,
    role: adminUser?.role || null,
  }
}

async function getTenants(): Promise<TenantWithProducts[]> {
  const supabase = await createClient()
  
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (tenantsError) {
    console.error('Error fetching schemas:', tenantsError)
    return []
  }

  return tenants.map(tenant => ({
    ...tenant,
    status: tenant.status as TenantStatus,
    products: [], // Kept for type compatibility
  }))
}

async function TenantList() {
  const tenants = await getTenants()
  return <TenantTable initialTenants={tenants} />
}

export default async function TenantsPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Top Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold">Node</span>
            </div>
            <UserNav user={user} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Node Management</h1>
            {user.isAdmin && (
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                {user.isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Manage your multi-tenant database nodes. Create new client nodes, 
            configure product modules, and control access permissions.
          </p>
          {user.isAdmin && (
            <div className="flex gap-2 mt-4">
              <Link href="/tenants/access">
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Manage User Access
                </Button>
              </Link>
            </div>
          )}
        </div>

        {user.isAdmin ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Tenant List */}
            <div className="order-2 lg:order-1">
              <h2 className="text-lg font-semibold mb-4">Active Nodes</h2>
              <Suspense fallback={<TenantTableSkeleton />}>
                <TenantList />
              </Suspense>
            </div>

            {/* Create Form */}
            <div className="order-1 lg:order-2">
              <CreateTenantForm />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Required</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              You don&apos;t have administrator access to manage nodes. 
              Please contact a super administrator to request access.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


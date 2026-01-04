-- =============================================================================
-- 09. STORAGE BUCKETS (schema-linked)
-- =============================================================================
-- Adds a mapping between tenant schemas and Supabase Storage buckets, plus
-- strict Storage RLS policies that enforce schema access on objects.
--
-- Prereqs:
-- - tenants table exists (public.tenants)
-- - access table exists (public.user_schema_access)
-- - helper functions exist (public.is_admin())
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mapping table: one schema -> many buckets (bucket belongs to exactly one schema)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_schema TEXT NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_schema, bucket_id),
  UNIQUE (bucket_id)
);

ALTER TABLE public.tenant_buckets ENABLE ROW LEVEL SECURITY;

-- Users can view bucket links for schemas they can access (or admins).
DROP POLICY IF EXISTS "tenant_buckets_select" ON public.tenant_buckets;
CREATE POLICY "tenant_buckets_select"
  ON public.tenant_buckets
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_schema_access usa
      WHERE usa.user_id = auth.uid()
        AND usa.tenant_schema = tenant_buckets.tenant_schema
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  );

-- Only admins can manage bucket links.
DROP POLICY IF EXISTS "tenant_buckets_insert" ON public.tenant_buckets;
CREATE POLICY "tenant_buckets_insert"
  ON public.tenant_buckets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tenant_buckets_delete" ON public.tenant_buckets;
CREATE POLICY "tenant_buckets_delete"
  ON public.tenant_buckets
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage RLS: enforce schema access on objects via tenant_buckets mapping
-- -----------------------------------------------------------------------------
-- Notes:
-- - We intentionally do NOT rely on per-object metadata.
-- - Access is derived from storage.objects.bucket_id -> public.tenant_buckets.tenant_schema
-- - Admins are always allowed.
-- -----------------------------------------------------------------------------

-- READ: user must have any access to the linked schema.
DROP POLICY IF EXISTS "tenant_storage_read" ON storage.objects;
CREATE POLICY "tenant_storage_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_buckets tb
      JOIN public.user_schema_access usa
        ON usa.tenant_schema = tb.tenant_schema
      WHERE tb.bucket_id = storage.objects.bucket_id
        AND usa.user_id = auth.uid()
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  );

-- WRITE: user must have write/admin access to the linked schema.
DROP POLICY IF EXISTS "tenant_storage_insert" ON storage.objects;
CREATE POLICY "tenant_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_buckets tb
      JOIN public.user_schema_access usa
        ON usa.tenant_schema = tb.tenant_schema
      WHERE tb.bucket_id = storage.objects.bucket_id
        AND usa.user_id = auth.uid()
        AND usa.access_level IN ('write', 'admin')
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "tenant_storage_update" ON storage.objects;
CREATE POLICY "tenant_storage_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_buckets tb
      JOIN public.user_schema_access usa
        ON usa.tenant_schema = tb.tenant_schema
      WHERE tb.bucket_id = storage.objects.bucket_id
        AND usa.user_id = auth.uid()
        AND usa.access_level IN ('write', 'admin')
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_buckets tb
      JOIN public.user_schema_access usa
        ON usa.tenant_schema = tb.tenant_schema
      WHERE tb.bucket_id = storage.objects.bucket_id
        AND usa.user_id = auth.uid()
        AND usa.access_level IN ('write', 'admin')
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "tenant_storage_delete" ON storage.objects;
CREATE POLICY "tenant_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_buckets tb
      JOIN public.user_schema_access usa
        ON usa.tenant_schema = tb.tenant_schema
      WHERE tb.bucket_id = storage.objects.bucket_id
        AND usa.user_id = auth.uid()
        AND usa.access_level IN ('write', 'admin')
        AND (usa.expires_at IS NULL OR usa.expires_at > now())
    )
  );



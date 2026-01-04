import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string }>
}

// DELETE /api/tenants/[schema] - Delete a tenant schema permanently
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema } = await params

    const supabase = await createClient()

    // Verify tenant exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .eq('schema_name', schema)
      .single()

    if (fetchError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 404 }
      )
    }

    // Capture linked buckets BEFORE deleting tenant (tenant_buckets rows will be cascaded).
    const { data: bucketRows, error: bucketErr } = (supabase as any)
      .from('tenant_buckets')
      .select('bucket_id')
      .eq('tenant_schema', schema)

    if (bucketErr) {
      console.error('Fetch tenant buckets error:', bucketErr)
      return NextResponse.json(
        { error: 'Failed to fetch linked buckets.' },
        { status: 500 }
      )
    }

    const bucketIds: string[] = (bucketRows || []).map((r: any) => r.bucket_id).filter(Boolean)

    // If we have buckets to delete, ensure service role is configured before we delete the schema.
    if (bucketIds.length > 0 && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_SERVICE_ROLE_KEY; cannot delete linked Storage buckets.' },
        { status: 500 }
      )
    }

    // Call RPC to delete schema (CASCADE)
    const { error: rpcError } = await supabase.rpc('delete_tenant_schema', {
      schema_name: schema,
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to delete tenant schema.' },
        { status: 500 }
      )
    }

    // Delete associated Storage buckets (and all objects inside).
    if (bucketIds.length > 0) {
      const supabaseAdmin = createAdminClient()
      const failed: { bucketId: string; error: string }[] = []

      for (const bucketId of bucketIds) {
        try {
          // Empty the bucket (removes all objects). This is more reliable than manual traversal.
          const { error: emptyErr } = await (supabaseAdmin.storage as any).emptyBucket(bucketId)
          if (emptyErr) throw emptyErr

          const { error: delErr } = await supabaseAdmin.storage.deleteBucket(bucketId)
          if (delErr) throw delErr

          // Verify deletion (dashboard can appear stale, but API should reflect reality).
          const { data: stillThere, error: getErr } = await supabaseAdmin.storage.getBucket(bucketId)
          if (stillThere && !getErr) {
            throw new Error('Bucket still exists after deleteBucket()')
          }
        } catch (e) {
          failed.push({
            bucketId,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }

      if (failed.length > 0) {
        console.error('Bucket deletion failures:', failed)
        return NextResponse.json(
          {
            error: 'Schema deleted, but failed to delete one or more Storage buckets.',
            failed,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      message: 'Tenant schema deleted successfully.',
      deletedBuckets: bucketIds.length,
    })
  } catch (error) {
    console.error('Delete tenant error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}


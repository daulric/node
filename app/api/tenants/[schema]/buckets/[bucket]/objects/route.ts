import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string; bucket: string }>
}

function isValidSchemaName(schema: string) {
  return /^[a-z][a-z0-9_]{2,62}$/.test(schema)
}

function isValidBucketId(bucketId: string) {
  return /^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucketId)
}

function normalizePrefix(prefix: string | null): string {
  if (!prefix) return ''
  const trimmed = prefix.trim()
  if (!trimmed) return ''
  // Storage list() expects path without leading slash
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

// GET /api/tenants/[schema]/buckets/[bucket]/objects?prefix=path/to/folder
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema, bucket } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }
    if (!isValidBucketId(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
    }

    const prefix = normalizePrefix(request.nextUrl.searchParams.get('prefix'))

    const supabase = await createClient()
    const db = supabase as any

    // Ensure this bucket is linked to this schema.
    // RLS on tenant_buckets will hide rows users can't access.
    const { data: link, error: linkErr } = await db
      .from('tenant_buckets')
      .select('bucket_id')
      .eq('tenant_schema', schema)
      .eq('bucket_id', bucket)
      .maybeSingle()

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }
    if (!link) {
      return NextResponse.json({ error: 'Bucket not linked to this schema.' }, { status: 404 })
    }

    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const folders = (data || []).filter((i: any) => i?.id == null).map((i: any) => i.name)
    const files = (data || [])
      .filter((i: any) => i?.id != null)
      .map((i: any) => ({
        name: i.name,
        id: i.id,
        updated_at: i.updated_at ?? null,
        created_at: i.created_at ?? null,
        metadata: i.metadata ?? null,
      }))

    return NextResponse.json({
      bucket,
      schema,
      prefix,
      folders,
      files,
    })
  } catch (error) {
    console.error('List bucket objects error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



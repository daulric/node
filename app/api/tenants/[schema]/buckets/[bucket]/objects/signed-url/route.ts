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

function normalizePath(path: string | null): string | null {
  if (!path) return null
  const trimmed = path.trim().replace(/^\/+/, '')
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  return trimmed
}

// GET /api/tenants/[schema]/buckets/[bucket]/objects/signed-url?path=folder/file.png
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema, bucket } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }
    if (!isValidBucketId(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
    }

    const path = normalizePath(request.nextUrl.searchParams.get('path'))
    if (!path) {
      return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // Ensure this bucket is linked to this schema. RLS enforces access.
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

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'Failed to create signed URL.' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl, expiresIn: 60 })
  } catch (error) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



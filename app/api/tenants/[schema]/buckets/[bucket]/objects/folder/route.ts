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
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizeFolderName(name: string | null): string | null {
  if (!name) return null
  const trimmed = name.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  // Keep it simple; disallow nested creation in one go.
  if (trimmed.includes('/')) return null
  return trimmed
}

// POST /api/tenants/[schema]/buckets/[bucket]/objects/folder
// body: { prefix?: string, folderName: string }
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema, bucket } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }
    if (!isValidBucketId(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
    }

    const body = (await request.json()) as { prefix?: string; folderName?: string }
    const prefix = normalizePrefix(body.prefix ?? null)
    const folderName = normalizeFolderName(body.folderName ?? null)
    if (!folderName) {
      return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // Ensure this bucket is linked to this schema.
    const { data: link, error: linkErr } = await db
      .from('tenant_buckets')
      .select('bucket_id')
      .eq('tenant_schema', schema)
      .eq('bucket_id', bucket)
      .maybeSingle()

    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    if (!link) return NextResponse.json({ error: 'Bucket not linked to this schema.' }, { status: 404 })

    // Only allow admins or users with write/admin access to write objects.
    // Storage RLS will enforce as well, but we can fail fast with nicer errors.
    const { data: canWrite, error: accessErr } = await supabase.rpc('has_schema_access', {
      schema_name: schema,
      required_level: 'write',
    })
    if (accessErr) return NextResponse.json({ error: 'Failed to verify access.' }, { status: 500 })
    if (!canWrite) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    // Create a folder marker file. This makes the folder show up in list().
    const objectPath = `${prefix ? `${prefix}/` : ''}${folderName}/.keep`
    const blob = new Blob([''], { type: 'text/plain' })

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectPath, blob, {
      upsert: false,
      contentType: 'text/plain',
    })

    if (uploadErr) {
      const msg = uploadErr.message || 'Failed to create folder.'
      const lower = msg.toLowerCase()
      const isConflict = lower.includes('already exists') || lower.includes('duplicate')
      return NextResponse.json({ error: isConflict ? 'Folder already exists.' : msg }, { status: isConflict ? 409 : 500 })
    }

    return NextResponse.json({ message: 'Folder created.', path: objectPath }, { status: 201 })
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



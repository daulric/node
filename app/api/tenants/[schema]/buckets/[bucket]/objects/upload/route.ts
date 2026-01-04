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

function safeFileName(name: string): string | null {
  const trimmed = name.trim().replace(/^\/+/, '')
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  if (trimmed.includes('/')) return null
  return trimmed
}

// POST /api/tenants/[schema]/buckets/[bucket]/objects/upload
// form-data: file=<File>, prefix=<string optional>
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema, bucket } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }
    if (!isValidBucketId(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
    }

    const supabase = await createClient()

    // Ensure this bucket is linked to this schema.
    const { data: link, error: linkErr } = await supabase
      .from('tenant_buckets')
      .select('bucket_id')
      .eq('tenant_schema', schema)
      .eq('bucket_id', bucket)
      .maybeSingle()

    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    if (!link) return NextResponse.json({ error: 'Bucket not linked to this schema.' }, { status: 404 })

    // Only allow admins or users with write/admin access to write objects.
    const { data: canWrite, error: accessErr } = await supabase.rpc('has_schema_access', {
      schema_name: schema,
      required_level: 'write',
    })
    if (accessErr) return NextResponse.json({ error: 'Failed to verify access.' }, { status: 500 })
    if (!canWrite) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const form = await request.formData()
    const prefix = normalizePrefix((form.get('prefix') as string | null) ?? null)
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
    }

    const name = safeFileName(file.name)
    if (!name) {
      return NextResponse.json({ error: 'Invalid file name.' }, { status: 400 })
    }

    const objectPath = `${prefix ? `${prefix}/` : ''}${name}`

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
      upsert: false,
      contentType: file.type || undefined,
    })

    if (uploadErr) {
      const msg = uploadErr.message || 'Upload failed.'
      const lower = msg.toLowerCase()
      const isConflict = lower.includes('already exists') || lower.includes('duplicate')
      return NextResponse.json({ error: isConflict ? 'File already exists.' : msg }, { status: isConflict ? 409 : 500 })
    }

    return NextResponse.json({ message: 'Uploaded.', path: objectPath }, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



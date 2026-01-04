import { createClient } from '@/utils/supabase/server'
import { bucketExists } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string }>
}

function isValidSchemaName(schema: string) {
  return /^[a-z][a-z0-9_]{2,62}$/.test(schema)
}

function isValidBucketId(bucketId: string) {
  return /^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucketId)
}

// POST /api/tenants/[schema]/buckets/link - Link an existing bucket to a schema (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }

    const { bucketId } = (await request.json()) as { bucketId?: string }
    if (!bucketId || !isValidBucketId(bucketId)) {
      return NextResponse.json({ error: 'Invalid bucketId.' }, { status: 400 })
    }

    const supabase = await createClient()

    // Enforce admin-only management.
    const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin')
    if (adminErr) {
      return NextResponse.json({ error: 'Failed to verify admin status.' }, { status: 500 })
    }
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const exists = await bucketExists(bucketId)
    if (!exists) {
      return NextResponse.json({ error: 'Bucket does not exist.' }, { status: 404 })
    }

    const db = supabase as any
    const { error: linkError } = await db.from('tenant_buckets').insert({
      tenant_schema: schema,
      bucket_id: bucketId,
    })

    if (linkError) {
      const anyErr = linkError as { code?: string; message?: string }
      const msg = String(anyErr.message || '')
      const isUniqueViolation =
        anyErr.code === '23505' ||
        msg.toLowerCase().includes('duplicate key') ||
        msg.toLowerCase().includes('unique constraint') ||
        msg.toLowerCase().includes('already exists')

      if (isUniqueViolation) {
        return NextResponse.json({ error: 'Bucket Already Linked' }, { status: 409 })
      }

      return NextResponse.json({ error: msg || 'Failed to link bucket.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Bucket linked.', bucketId }, { status: 201 })
  } catch (error) {
    console.error('Link tenant bucket error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



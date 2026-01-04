import { createClient } from '@/utils/supabase/server'
import { createBucketIfMissing } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ schema: string }>
}

function isValidSchemaName(schema: string) {
  return /^[a-z][a-z0-9_]{2,62}$/.test(schema)
}

function isValidBucketId(bucketId: string) {
  // Supabase allows a fairly broad set; we constrain for consistency.
  // 3-63 chars, lowercase letters/numbers, underscore, hyphen.
  return /^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucketId)
}

// GET /api/tenants/[schema]/buckets - List buckets linked to a schema
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { schema } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }

    const supabase = await createClient()

    // NOTE: Database types may not include this table until types are regenerated.
    const { data, error } = await supabase
      .from('tenant_buckets')
      .select('bucket_id, created_at')
      .eq('tenant_schema', schema)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ schema, buckets: data || [] })
  } catch (error) {
    console.error('List tenant buckets error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}

// POST /api/tenants/[schema]/buckets - Create a new bucket and link it to a schema (admin only)
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

    // Create a private bucket if it doesn't exist.
    await createBucketIfMissing(bucketId, false)

    const { error: linkError } = await supabase.from('tenant_buckets').insert({
      tenant_schema: schema,
      bucket_id: bucketId,
    })

    if (linkError) {
      const msg = String(linkError.message || '')
      const isConflict =
        msg.toLowerCase().includes('duplicate key') ||
        msg.toLowerCase().includes('unique constraint') ||
        msg.toLowerCase().includes('already exists')

      return NextResponse.json(
        { error: linkError.message },
        { status: isConflict ? 409 : 500 }
      )
    }

    return NextResponse.json({ message: 'Bucket created and linked.', bucketId }, { status: 201 })
  } catch (error) {
    console.error('Create tenant bucket error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}



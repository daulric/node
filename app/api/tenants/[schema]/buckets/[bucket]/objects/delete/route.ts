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
  const trimmed = path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  return trimmed
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function collectAllObjectPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const storage = supabase.storage.from(bucket)
  const results: string[] = []

  const queue: string[] = [prefix] // prefixes without trailing slash
  while (queue.length) {
    const current = queue.shift() || ''
    const { data, error } = await storage.list(current, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error

    for (const item of data || []) {
      // folders: id is null, name is folder name
      if ((item as any)?.id == null) {
        const nextPrefix = current ? `${current}/${item.name}` : item.name
        queue.push(nextPrefix)
        continue
      }

      const objectPath = current ? `${current}/${item.name}` : item.name
      results.push(objectPath)
    }
  }

  return results
}

// POST /api/tenants/[schema]/buckets/[bucket]/objects/delete
// body: { kind: 'file' | 'folder', path: string }
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { schema, bucket } = await params
    if (!isValidSchemaName(schema)) {
      return NextResponse.json({ error: 'Invalid schema.' }, { status: 400 })
    }
    if (!isValidBucketId(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
    }

    const body = (await request.json()) as { kind?: 'file' | 'folder'; path?: string }
    const kind = body.kind
    const path = normalizePath(body.path ?? null)
    if (!kind || !path || (kind !== 'file' && kind !== 'folder')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // Ensure bucket is linked to schema.
    const { data: link, error: linkErr } = await db
      .from('tenant_buckets')
      .select('bucket_id')
      .eq('tenant_schema', schema)
      .eq('bucket_id', bucket)
      .maybeSingle()

    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    if (!link) return NextResponse.json({ error: 'Bucket not linked to this schema.' }, { status: 404 })

    // Require write access. Storage RLS also enforces, but fail fast.
    const { data: canWrite, error: accessErr } = await supabase.rpc('has_schema_access', {
      schema_name: schema,
      required_level: 'write',
    })
    if (accessErr) return NextResponse.json({ error: 'Failed to verify access.' }, { status: 500 })
    if (!canWrite) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const storage = supabase.storage.from(bucket)

    let pathsToDelete: string[] = []
    if (kind === 'file') {
      pathsToDelete = [path]
    } else {
      // folder: delete all objects under this prefix (including .keep markers)
      pathsToDelete = await collectAllObjectPaths(supabase, bucket, path)
      if (pathsToDelete.length === 0) {
        // If empty, still attempt to remove a marker file if present.
        pathsToDelete = [`${path}/.keep`]
      }
    }

    for (const batch of chunk(pathsToDelete, 100)) {
      const { error: removeErr } = await storage.remove(batch)
      if (removeErr) throw removeErr
    }

    return NextResponse.json({ message: 'Deleted.', deleted: pathsToDelete.length })
  } catch (error) {
    console.error('Delete objects error:', error)
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}



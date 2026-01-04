import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export function createAdminClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const anyErr = error as { statusCode?: number; status?: number; message?: string }
  return (
    anyErr.statusCode === 409 ||
    anyErr.status === 409 ||
    (typeof anyErr.message === 'string' && anyErr.message.toLowerCase().includes('already exists'))
  )
}

export async function createBucketIfMissing(bucketId: string, isPublic = false) {
  const supabaseAdmin = createAdminClient()

  // Fast path: if bucket exists, done.
  const { data: existing, error: getError } = await supabaseAdmin.storage.getBucket(bucketId)
  if (existing && !getError) return { created: false as const }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucketId, {
    public: isPublic,
  })

  if (createError && !isAlreadyExistsError(createError)) {
    throw createError
  }

  return { created: true as const }
}

export async function bucketExists(bucketId: string): Promise<boolean> {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.storage.getBucket(bucketId)
  return Boolean(data) && !error
}



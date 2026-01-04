# Client Examples

## Setup

### Install Supabase Client

```bash
npm install @supabase/supabase-js
# or
bun add @supabase/supabase-js
```

### Initialize Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

---

## Authentication + Tenant Profile

### Complete Auth Flow

```typescript
const TENANT_SCHEMA = 'acme_corp'

// Handle all auth events
supabase.auth.onAuthStateChange(async (event, session) => {
  if (!session?.user) {
    // User logged out
    return
  }

  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    // Ensure user has a profile in this tenant
    const { data: profile, error } = await supabase.rpc('ensure_user_profile', {
      target_schema: TENANT_SCHEMA,
      user_name: session.user.user_metadata?.full_name || null
    })

    if (error) {
      console.error('Failed to ensure profile:', error)
      return
    }

    const userProfile = profile?.[0]
    if (userProfile?.is_new) {
      console.log('Welcome! Your account was just set up.')
    } else {
      console.log('Welcome back,', userProfile?.name)
    }

    // Store profile in your app state
    setUserProfile(userProfile)
  }
})
```

### Recommended Tenant Client Login UX (Single Email Entry Point)

In multi-tenant apps, users often don’t know whether they already have an account. For tenant-facing clients, prefer **Supabase OTP** (`signInWithOtp`) and/or **OAuth** (`signInWithOAuth`) and avoid exposing whether an email is registered.

```typescript
async function continueWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Where the user should land after clicking the email link
      emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=/tenants`,
    },
  })

  // Always show the same UI message (avoid email enumeration):
  // "If an account exists, we sent you a link."
  if (error) throw error
}
```

```typescript
async function continueWithOAuth(provider: 'google' | 'github') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?redirectTo=/tenants`,
    },
  })

  if (error) throw error
}
```

After the user authenticates, use your normal post-auth flow:

- Call `ensure_user_profile` for the current tenant when operating inside a tenant context
- Route the user based on their tenant access (e.g. one tenant → redirect, multiple → picker, none → access required)

### Password Login (Not Recommended for Tenant Clients)

If you are building an internal/admin tool you may choose password auth, but tenant-facing clients should stick to **Supabase OTP** to reduce account confusion and avoid duplicate signup attempts.

### Sign Out

```typescript
async function signOut() {
  await supabase.auth.signOut()
}
```

---

## Checking Tenant Status

### Before Allowing Access

```typescript
async function checkTenantAccess(schemaName: string) {
  const { data: status, error } = await supabase.rpc('check_tenant_status', {
    p_schema: schemaName
  })

  if (error || !status) {
    return { accessible: false, reason: 'not_found' }
  }

  if (status === 'suspended') {
    return { accessible: false, reason: 'suspended' }
  }

  return { accessible: true, status }
}

// Usage
const access = await checkTenantAccess('acme_corp')
if (!access.accessible) {
  if (access.reason === 'suspended') {
    showSuspendedPage()
  } else {
    show404Page()
  }
}
```

---

## Querying Tenant Data

### Direct Table Access

```typescript
const SCHEMA = 'acme_corp'

// Get all orders
const { data: orders } = await supabase
  .from(`${SCHEMA}.orders`)
  .select('*')
  .order('created_at', { ascending: false })

// Get order with related user
const { data: orderWithUser } = await supabase
  .from(`${SCHEMA}.orders`)
  .select(`
    *,
    user:${SCHEMA}.users(id, name, email)
  `)
  .eq('id', orderId)
  .single()

// Insert new order
const { data: newOrder } = await supabase
  .from(`${SCHEMA}.orders`)
  .insert({
    user_id: userProfile.id,
    total: 99.99,
    status: 'pending'
  })
  .select()
  .single()

// Update order
await supabase
  .from(`${SCHEMA}.orders`)
  .update({ status: 'shipped' })
  .eq('id', orderId)

// Delete order
await supabase
  .from(`${SCHEMA}.orders`)
  .delete()
  .eq('id', orderId)
```

---

## Admin Dashboard Examples

### List All Tenants

```typescript
async function listTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return data
}
```

### Create New Tenant

```typescript
async function createTenant(schemaName: string, displayName: string) {
  const { data: tenantId, error } = await supabase.rpc('create_tenant_schema', {
    p_schema_name: schemaName,
    p_display_name: displayName
  })

  if (error) throw error
  return tenantId
}
```

### Suspend Tenant

```typescript
async function suspendTenant(schemaName: string) {
  const { error } = await supabase.rpc('suspend_tenant', {
    schema_name: schemaName
  })

  if (error) throw error
}
```

### Activate Tenant

```typescript
async function activateTenant(schemaName: string) {
  const { error } = await supabase.rpc('activate_tenant', {
    schema_name: schemaName
  })

  if (error) throw error
}
```

### Delete Tenant

```typescript
async function deleteTenant(schemaName: string) {
  // Show confirmation dialog first!
  const confirmed = await showConfirmDialog(
    `Are you sure you want to delete ${schemaName}? This cannot be undone.`
  )

  if (!confirmed) return

  const { error } = await supabase.rpc('delete_tenant_schema', {
    schema_name: schemaName
  })

  if (error) throw error
}
```

---

## User Access Management

### Grant Access

```typescript
async function grantAccess(
  userId: string, 
  schemaName: string, 
  level: 'read' | 'write' | 'admin'
) {
  const { error } = await supabase.rpc('grant_schema_access', {
    target_user_id: userId,
    target_schema: schemaName,
    access_level: level
  })

  if (error) throw error
}
```

### Revoke Access

```typescript
async function revokeAccess(userId: string, schemaName: string) {
  const { error } = await supabase.rpc('revoke_schema_access', {
    target_user_id: userId,
    target_schema: schemaName
  })

  if (error) throw error
}
```

### List User Access

```typescript
async function getUserAccess(userId: string) {
  const { data } = await supabase
    .from('user_schema_access')
    .select('tenant_schema, access_level, granted_at')
    .eq('user_id', userId)

  return data
}
```

---

## Schema Inspection

### Browse Tables

```typescript
async function getTables(schemaName: string) {
  const { data } = await supabase.rpc('get_schema_tables', {
    target_schema: schemaName
  })

  return data
}
```

### Get Table Structure

```typescript
async function getTableStructure(schemaName: string, tableName: string) {
  const [columnsResult, fksResult] = await Promise.all([
    supabase.rpc('get_table_columns', {
      target_schema: schemaName,
      target_table: tableName
    }),
    supabase.rpc('get_table_foreign_keys', {
      target_schema: schemaName,
      target_table: tableName
    })
  ])

  return {
    columns: columnsResult.data,
    foreignKeys: fksResult.data
  }
}
```

---

## React Hook Example

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  name: string | null
  role: string
  metadata: Record<string, unknown>
}

export function useUserProfile(schemaName: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data, error } = await supabase.rpc('ensure_user_profile', {
          target_schema: schemaName
        })

        if (error) throw error
        setProfile(data?.[0] || null)
      } catch (e) {
        setError(e as Error)
      } finally {
        setLoading(false)
      }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadProfile()
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // Initial load
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        loadProfile()
      } else {
        setLoading(false)
      }
    })
  }, [schemaName])

  return { profile, loading, error }
}

// Usage in component
function MyComponent() {
  const { profile, loading, error } = useUserProfile('acme_corp')

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!profile) return <div>Please log in</div>

  return <div>Welcome, {profile.name || profile.email}!</div>
}
```

---

## Error Handling

```typescript
async function safeRpc<T>(
  fn: () => Promise<{ data: T | null; error: Error | null }>
): Promise<T> {
  const { data, error } = await fn()

  if (error) {
    // Handle specific error codes
    if (error.message.includes('permission denied')) {
      throw new Error('You do not have access to this resource')
    }
    if (error.message.includes('suspended')) {
      throw new Error('This tenant is currently suspended')
    }
    throw error
  }

  if (!data) {
    throw new Error('No data returned')
  }

  return data
}

// Usage
try {
  const profile = await safeRpc(() => 
    supabase.rpc('ensure_user_profile', { target_schema: 'acme_corp' })
  )
  console.log('Profile:', profile)
} catch (e) {
  console.error('Failed:', e.message)
}
```


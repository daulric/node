# User & Auth Integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE AUTH                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  auth.users                                                          ││
│  │  ┌────────────────────────────────────────────────────────────────┐ ││
│  │  │ id (UUID)     │ email              │ created_at                │ ││
│  │  │───────────────│────────────────────│───────────────────────────│ ││
│  │  │ abc-123...    │ john@acme.com      │ 2024-01-15                │ ││
│  │  │ def-456...    │ jane@globex.com    │ 2024-02-20                │ ││
│  │  └────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                          │                           │
                          │ Foreign Key               │ Foreign Key
                          ▼                           ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  acme_corp.users                    │  │  globex.users                       │
│  ┌─────────────────────────────────┐│  │  ┌─────────────────────────────────┐│
│  │ id          │ auth_user_id      ││  │  │ id          │ auth_user_id      ││
│  │ (tenant PK) │ → auth.users(id)  ││  │  │ (tenant PK) │ → auth.users(id)  ││
│  │─────────────│───────────────────││  │  │─────────────│───────────────────││
│  │ xyz-789...  │ abc-123...        ││  │  │ qrs-012...  │ def-456...        ││
│  │ role: admin │ email, name, etc  ││  │  │ role: user  │ email, name, etc  ││
│  └─────────────────────────────────┘│  │  └─────────────────────────────────┘│
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

## The `{schema}.users` Table

Every tenant schema has a `users` table that links to Supabase Auth:

```sql
CREATE TABLE {schema}.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Column Purposes

| Column | Purpose |
|--------|---------|
| `id` | Tenant-specific user ID — use for FKs within this schema |
| `auth_user_id` | Link to `auth.users(id)` — the Supabase Auth UUID |
| `email` | Denormalized from auth for convenience |
| `role` | **Tenant-specific** role (same user can have different roles in different tenants) |
| `metadata` | Tenant-specific profile data (preferences, settings, etc.) |

---

## The Recommended Flow: `ensure_user_profile`

Use this single function for both signup AND login:

```typescript
// Works for new signups AND existing users
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    const { data: profile, error } = await supabase.rpc('ensure_user_profile', {
      target_schema: 'acme_corp',
      user_name: session.user.user_metadata?.full_name || null
    })

    if (profile?.[0]) {
      console.log('Profile:', profile[0])
      // {
      //   id: 'xyz-789...',
      //   auth_user_id: 'abc-123...',
      //   email: 'john@acme.com',
      //   name: 'John Doe',
      //   role: 'user',
      //   metadata: {},
      //   created_at: '2024-...',
      //   is_new: true  // or false if already existed
      // }
    }
  }
})
```

### Behavior

| Scenario | Result |
|----------|--------|
| New signup | Creates profile, `is_new = true` |
| Existing auth user, first time in this tenant | Creates profile, `is_new = true` |
| Returning user | Returns existing profile, `is_new = false` |
| Called multiple times | No error, just returns profile |

---

## Multi-Tenant Membership

The same Supabase Auth user can belong to **multiple tenants** with different roles:

```
auth.users:
  id: abc-123... (John)

acme_corp.users:
  auth_user_id: abc-123...
  role: 'admin'
  metadata: { department: 'Engineering' }

globex.users:
  auth_user_id: abc-123...
  role: 'viewer'
  metadata: { department: 'Sales' }
```

John has **ONE** Supabase login but **different profiles** in each tenant.

---

## Alternative Functions

### `create_user_profile`

Explicitly create a profile (fails if already exists):

```typescript
const { data: profileId } = await supabase.rpc('create_user_profile', {
  target_schema: 'acme_corp',
  user_email: 'john@acme.com',
  user_name: 'John Doe',
  user_role: 'admin',
  user_metadata: { department: 'Engineering' }
})
// Returns just the UUID
```

### `get_user_profile`

Get the current user's profile in a tenant:

```typescript
const { data: profile } = await supabase.rpc('get_user_profile', {
  target_schema: 'acme_corp'
})
// Returns full profile data
```

---

## Cascade Deletes

When an auth user is deleted from Supabase:

```sql
auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
```

All their tenant profiles are automatically deleted. No orphaned records.

---

## Best Practices

### 1. Always Call `ensure_user_profile` After Auth

```typescript
// In your app's auth handler
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    await supabase.rpc('ensure_user_profile', {
      target_schema: TENANT_SCHEMA,
      user_name: session.user.user_metadata?.name
    })
  }
})
```

### 2. Store Tenant-Specific Data in `metadata`

```typescript
// Update user's tenant-specific preferences
await supabase
  .from(`${TENANT_SCHEMA}.users`)
  .update({ 
    metadata: { 
      theme: 'dark', 
      notifications: true 
    } 
  })
  .eq('auth_user_id', session.user.id)
```

### 3. Use Tenant User ID for Internal FKs

```sql
-- In acme_corp schema
CREATE TABLE acme_corp.orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES acme_corp.users(id),  -- Use tenant user ID
  -- NOT auth_user_id
  ...
);
```

This keeps your tenant schema self-contained.


# Schema Management

## Creating a Tenant Schema

### Via RPC

```typescript
const { data: tenantId, error } = await supabase.rpc('create_tenant_schema', {
  p_schema_name: 'acme_corp',      // lowercase, letters/numbers/underscores
  p_display_name: 'Acme Corporation'  // Human-readable name
})
```

### What Gets Created

When you create a new schema, the following are automatically set up:

```sql
-- 1. The schema itself
CREATE SCHEMA acme_corp;

-- 2. Settings table
CREATE TABLE acme_corp.settings (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 3. Users table (linked to auth.users)
CREATE TABLE acme_corp.users (
  id UUID PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 4. Audit log
CREATE TABLE acme_corp.audit_log (
  id UUID PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ
);

-- 5. Permissions granted
GRANT USAGE ON SCHEMA acme_corp TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA acme_corp TO authenticated;
```

### Schema Name Rules

| Rule | Example |
|------|---------|
| Must start with lowercase letter | ✅ `acme_corp` ❌ `1acme` |
| Only lowercase letters, numbers, underscores | ✅ `my_tenant_1` ❌ `My-Tenant` |
| 3-63 characters | ✅ `abc` ❌ `ab` |
| Can't be reserved | ❌ `public`, `auth`, `pg_*`, `supabase_*` |

### Idempotent Behavior

The function handles existing schemas gracefully:

| Scenario | Behavior |
|----------|----------|
| Schema doesn't exist | Creates schema + tables + permissions |
| Schema exists but empty | Creates default tables + permissions |
| Schema exists with tables | Only registers in `tenants` table (no changes) |

---

## Suspending a Tenant

Suspending immediately revokes all access to the schema:

```typescript
await supabase.rpc('suspend_tenant', {
  schema_name: 'acme_corp'
})
```

### What Happens

1. `REVOKE USAGE ON SCHEMA` — Users can't even see the schema
2. `REVOKE ALL ON TABLES` — No read/write access
3. `REVOKE ALL ON SEQUENCES` — No auto-increment
4. Status → `'suspended'` in `tenants` table
5. Action logged in `admin_audit_log`

### Client Experience

Any query to a suspended tenant:

```typescript
const { data, error } = await supabase
  .from('acme_corp.orders')
  .select('*')

// error: { code: '42501', message: 'permission denied for schema acme_corp' }
```

---

## Activating a Tenant

Restore access to a suspended tenant:

```typescript
await supabase.rpc('activate_tenant', {
  schema_name: 'acme_corp'
})
```

### What Happens

1. `GRANT USAGE ON SCHEMA` — Schema visible again
2. `GRANT ALL ON TABLES` — Full read/write restored
3. `GRANT ALL ON SEQUENCES` — Auto-increment works
4. Status → `'active'` in `tenants` table
5. Action logged in `admin_audit_log`

---

## Deleting a Tenant

⚠️ **Destructive operation** — Only super admins can do this.

```typescript
await supabase.rpc('delete_tenant_schema', {
  schema_name: 'acme_corp'
})
```

### What Happens

1. Action logged BEFORE deletion (for audit trail)
2. All user access records removed from `user_schema_access`
3. `DROP SCHEMA acme_corp CASCADE` — Deletes schema and ALL tables
4. Tenant record removed from `tenants` table

**This cannot be undone!**

---

## Checking Tenant Status

### Quick Status Check

```typescript
const { data: status } = await supabase.rpc('check_tenant_status', {
  p_schema: 'acme_corp'
})
// status = 'active' | 'suspended' | null
```

### Full Tenant Info

```typescript
const { data: info } = await supabase.rpc('get_tenant_info', {
  p_schema: 'acme_corp'
})
// info = [{ schema_name, display_name, status, created_at }]
```

---

## Listing All Tenants

From the admin dashboard or via direct query:

```typescript
const { data: tenants } = await supabase
  .from('tenants')
  .select('*')
  .order('created_at', { ascending: false })
```

Returns:

```typescript
[
  {
    id: 'uuid...',
    schema_name: 'acme_corp',
    display_name: 'Acme Corporation',
    status: 'active',
    created_at: '2024-01-15T...',
    updated_at: '2024-01-15T...',
    created_by: 'admin-user-uuid'
  },
  // ...
]
```


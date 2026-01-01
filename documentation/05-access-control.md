# Access Control

## Two Levels of Access

### 1. Platform Level (Admin Users)

Who can manage tenants, users, and the platform itself.

| Role | Permissions |
|------|-------------|
| `super_admin` | Everything: create/delete schemas, manage all users |
| `admin` | Create schemas, suspend/activate, manage users |
| `viewer` | Read-only access to admin dashboard |

### 2. Tenant Level (Schema Access)

Who can access which tenant schemas.

| Permission | Allows |
|------------|--------|
| `read` | SELECT on all tables in schema |
| `write` | SELECT, INSERT, UPDATE, DELETE |
| `admin` | Full access + can manage other users' access |

---

## Platform Admin Management

### Making Someone an Admin

```typescript
await supabase.rpc('promote_to_admin', {
  target_user_id: 'user-uuid-here',
  admin_role: 'admin'  // 'super_admin' | 'admin' | 'viewer'
})
```

### Revoking Admin Access

```typescript
await supabase.rpc('revoke_admin', {
  target_user_id: 'user-uuid-here'
})
```

### Checking Admin Status

```typescript
// Helper functions available in SQL
SELECT public.is_admin();        -- Returns true if current user is any admin
SELECT public.is_super_admin();  -- Returns true if super_admin
```

---

## Tenant Schema Access

### Granting Access

```typescript
await supabase.rpc('grant_schema_access', {
  target_user_id: 'user-uuid-here',
  target_schema: 'acme_corp',
  access_level: 'write'  // 'read' | 'write' | 'admin'
})
```

### Revoking Access

```typescript
await supabase.rpc('revoke_schema_access', {
  target_user_id: 'user-uuid-here',
  target_schema: 'acme_corp'
})
```

### Checking Access

```typescript
// In SQL (used internally by RPC functions)
SELECT public.has_schema_access('acme_corp', 'read');   -- Can read?
SELECT public.has_schema_access('acme_corp', 'write');  -- Can write?
SELECT public.has_schema_access('acme_corp', 'admin');  -- Is admin?
```

---

## The `user_schema_access` Table

```sql
CREATE TABLE public.user_schema_access (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_schema TEXT NOT NULL,
  access_level TEXT DEFAULT 'read',  -- 'read' | 'write' | 'admin'
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tenant_schema)  -- One access level per user per schema
);
```

---

## Access Hierarchy

```
super_admin
    │
    ├── Can manage ALL schemas
    ├── Can create/delete schemas
    ├── Can promote/demote other admins
    │
    ▼
admin
    │
    ├── Can manage schemas (create, suspend, activate)
    ├── Can grant/revoke user access
    ├── Cannot delete schemas
    ├── Cannot modify super_admin users
    │
    ▼
viewer (platform level)
    │
    ├── Can view admin dashboard
    ├── Cannot make changes
    │
    ▼
schema admin (tenant level)
    │
    ├── Full access to specific schema
    ├── Can manage users for that schema
    │
    ▼
schema write
    │
    ├── Read/write access to schema data
    │
    ▼
schema read
    │
    ├── Read-only access to schema data
```

---

## Example: Complete User Setup

```typescript
// 1. User signs up via Supabase Auth
const { data: authData } = await supabase.auth.signUp({
  email: 'newuser@acme.com',
  password: 'secret123'
})

// 2. Admin grants them access to a tenant
await supabase.rpc('grant_schema_access', {
  target_user_id: authData.user.id,
  target_schema: 'acme_corp',
  access_level: 'write'
})

// 3. User logs in and gets their profile
await supabase.rpc('ensure_user_profile', {
  target_schema: 'acme_corp',
  user_name: 'New User'
})

// 4. User can now access acme_corp data
const { data } = await supabase
  .from('acme_corp.orders')
  .select('*')
// ✅ Works!
```

---

## Audit Trail

All access changes are logged in `admin_audit_log`:

```sql
SELECT * FROM public.admin_audit_log 
WHERE action IN ('GRANT_ACCESS', 'REVOKE_ACCESS', 'PROMOTE_ADMIN', 'REVOKE_ADMIN')
ORDER BY created_at DESC;
```

Returns:

```
action        | resource_type | resource_id | user_id      | details
--------------+---------------+-------------+--------------+---------------------------
GRANT_ACCESS  | schema_access | acme_corp   | admin-uuid   | {"level": "write", ...}
REVOKE_ACCESS | schema_access | acme_corp   | admin-uuid   | {"user": "user-uuid"}
PROMOTE_ADMIN | admin_user    | user-uuid   | super-uuid   | {"role": "admin"}
```


# API Reference

## Schema Management Functions

### `create_tenant_schema`

Creates a new tenant schema with default tables.

```typescript
supabase.rpc('create_tenant_schema', {
  p_schema_name: string,      // Required: lowercase, 3-63 chars
  p_display_name?: string     // Optional: human-readable name
})
```

**Returns:** `UUID` — The tenant ID

**Requires:** Admin role

---

### `suspend_tenant`

Suspends a tenant, revoking all access.

```typescript
supabase.rpc('suspend_tenant', {
  schema_name: string
})
```

**Returns:** `void`

**Requires:** Admin role

---

### `activate_tenant`

Activates a suspended tenant, restoring access.

```typescript
supabase.rpc('activate_tenant', {
  schema_name: string
})
```

**Returns:** `void`

**Requires:** Admin role

---

### `delete_tenant_schema`

Permanently deletes a tenant schema and all data.

```typescript
supabase.rpc('delete_tenant_schema', {
  schema_name: string
})
```

**Returns:** `void`

**Requires:** Super Admin role

---

### `check_tenant_status`

Returns the status of a tenant.

```typescript
supabase.rpc('check_tenant_status', {
  p_schema: string
})
```

**Returns:** `'active' | 'suspended' | null`

**Requires:** Any authenticated user (or anon)

---

### `get_tenant_info`

Returns detailed tenant information.

```typescript
supabase.rpc('get_tenant_info', {
  p_schema: string
})
```

**Returns:** `{ schema_name, display_name, status, created_at }[]`

**Requires:** Any authenticated user (or anon)

---

## User Profile Functions

### `ensure_user_profile`

Creates or returns the user's profile in a tenant. **Recommended for login/signup flows.**

```typescript
supabase.rpc('ensure_user_profile', {
  target_schema: string,
  user_name?: string
})
```

**Returns:**

```typescript
{
  id: UUID,
  auth_user_id: UUID,
  email: string,
  name: string | null,
  role: string,
  metadata: JSONB,
  created_at: timestamp,
  is_new: boolean  // true if just created
}[]
```

**Requires:** Authenticated user

---

### `create_user_profile`

Explicitly creates a user profile. Fails if already exists.

```typescript
supabase.rpc('create_user_profile', {
  target_schema: string,
  user_email: string,
  user_name?: string,
  user_role?: string,      // Default: 'user'
  user_metadata?: JSONB    // Default: {}
})
```

**Returns:** `UUID` — The profile ID

**Requires:** Authenticated user with write access

---

### `get_user_profile`

Gets the current user's profile in a tenant.

```typescript
supabase.rpc('get_user_profile', {
  target_schema: string
})
```

**Returns:**

```typescript
{
  id: UUID,
  auth_user_id: UUID,
  email: string,
  name: string | null,
  role: string,
  metadata: JSONB,
  created_at: timestamp
}[]
```

**Requires:** Authenticated user with read access

---

## Access Control Functions

### `grant_schema_access`

Grants a user access to a tenant schema.

```typescript
supabase.rpc('grant_schema_access', {
  target_user_id: UUID,
  target_schema: string,
  access_level: 'read' | 'write' | 'admin'
})
```

**Returns:** `void`

**Requires:** Admin role

---

### `revoke_schema_access`

Revokes a user's access to a tenant schema.

```typescript
supabase.rpc('revoke_schema_access', {
  target_user_id: UUID,
  target_schema: string
})
```

**Returns:** `void`

**Requires:** Admin role

---

### `promote_to_admin`

Makes a user a platform admin.

```typescript
supabase.rpc('promote_to_admin', {
  target_user_id: UUID,
  admin_role: 'super_admin' | 'admin' | 'viewer'
})
```

**Returns:** `void`

**Requires:** Super Admin role

---

### `revoke_admin`

Removes admin privileges from a user.

```typescript
supabase.rpc('revoke_admin', {
  target_user_id: UUID
})
```

**Returns:** `void`

**Requires:** Super Admin role

---

## Schema Inspection Functions

### `get_schema_tables`

Lists all tables in a schema.

```typescript
supabase.rpc('get_schema_tables', {
  target_schema: string
})
```

**Returns:** `{ table_name, column_count, row_count, table_size, description }[]`

---

### `get_table_columns`

Lists columns in a table.

```typescript
supabase.rpc('get_table_columns', {
  target_schema: string,
  target_table: string
})
```

**Returns:** `{ column_name, data_type, is_nullable, column_default, ordinal_position }[]`

---

### `get_table_foreign_keys`

Lists foreign keys for a table.

```typescript
supabase.rpc('get_table_foreign_keys', {
  target_schema: string,
  target_table: string
})
```

**Returns:** `{ constraint_name, column_name, foreign_table_schema, foreign_table_name, foreign_column_name, on_update, on_delete }[]`

---

### `get_schema_foreign_keys`

Lists all foreign keys in a schema.

```typescript
supabase.rpc('get_schema_foreign_keys', {
  target_schema: string
})
```

---

### `get_schema_summary`

Gets summary stats for a schema.

```typescript
supabase.rpc('get_schema_summary', {
  target_schema: string
})
```

**Returns:** `{ table_count, total_rows, total_size }[]`

---

## DDL Functions

### `create_table`

Creates a new table.

```typescript
supabase.rpc('create_table', {
  target_schema: string,
  target_table: string,
  columns: {
    name: string,
    type: string,
    nullable: boolean,
    default_value?: string,
    is_primary?: boolean
  }[]
})
```

---

### `add_column`

Adds a column to a table.

```typescript
supabase.rpc('add_column', {
  target_schema: string,
  target_table: string,
  column_name: string,
  column_type: string,
  is_nullable: boolean,
  default_value?: string
})
```

---

### `add_foreign_key`

Adds a foreign key constraint.

```typescript
supabase.rpc('add_foreign_key', {
  target_schema: string,
  target_table: string,
  column_name: string,
  ref_schema: string,
  ref_table: string,
  ref_column: string,
  on_delete?: string,  // CASCADE, SET NULL, RESTRICT, NO ACTION
  on_update?: string
})
```

---

### `drop_column`

Removes a column from a table.

```typescript
supabase.rpc('drop_column', {
  target_schema: string,
  target_table: string,
  column_name: string
})
```

---

### `drop_foreign_key`

Removes a foreign key constraint.

```typescript
supabase.rpc('drop_foreign_key', {
  target_schema: string,
  target_table: string,
  constraint_name: string
})
```

---

### `get_reference_tables`

Lists tables available for foreign key references.

```typescript
supabase.rpc('get_reference_tables', {
  target_schema: string
})
```

**Returns:** `{ table_schema, table_name }[]`

---

### `get_table_pk_columns`

Lists primary key columns of a table.

```typescript
supabase.rpc('get_table_pk_columns', {
  target_schema: string,
  target_table: string
})
```

**Returns:** `{ column_name, data_type }[]`


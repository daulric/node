# Schema Inspection

## Overview

The schema inspection functions allow you to browse the structure of tenant schemas — tables, columns, foreign keys — without needing direct database access.

---

## Listing Tables in a Schema

```typescript
const { data: tables } = await supabase.rpc('get_schema_tables', {
  target_schema: 'acme_corp'
})
```

Returns:

```typescript
[
  {
    table_name: 'users',
    column_count: 8,
    row_count: 150,
    table_size: '24 kB',
    description: null
  },
  {
    table_name: 'orders',
    column_count: 12,
    row_count: 5420,
    table_size: '1.2 MB',
    description: 'Customer orders'
  },
  // ...
]
```

---

## Getting Table Columns

```typescript
const { data: columns } = await supabase.rpc('get_table_columns', {
  target_schema: 'acme_corp',
  target_table: 'orders'
})
```

Returns:

```typescript
[
  {
    column_name: 'id',
    data_type: 'uuid',
    is_nullable: 'NO',
    column_default: 'gen_random_uuid()',
    ordinal_position: 1
  },
  {
    column_name: 'user_id',
    data_type: 'uuid',
    is_nullable: 'NO',
    column_default: null,
    ordinal_position: 2
  },
  {
    column_name: 'total',
    data_type: 'numeric',
    is_nullable: 'YES',
    column_default: '0',
    ordinal_position: 3
  },
  // ...
]
```

---

## Getting Foreign Keys

### For a Specific Table

```typescript
const { data: fks } = await supabase.rpc('get_table_foreign_keys', {
  target_schema: 'acme_corp',
  target_table: 'orders'
})
```

### For Entire Schema

```typescript
const { data: allFks } = await supabase.rpc('get_schema_foreign_keys', {
  target_schema: 'acme_corp'
})
```

Returns:

```typescript
[
  {
    constraint_name: 'orders_user_id_fkey',
    table_name: 'orders',
    column_name: 'user_id',
    foreign_table_schema: 'acme_corp',
    foreign_table_name: 'users',
    foreign_column_name: 'id',
    on_update: 'NO ACTION',
    on_delete: 'CASCADE'
  },
  // ...
]
```

---

## Getting Row Count

```typescript
const { data: count } = await supabase.rpc('get_table_row_count', {
  target_schema: 'acme_corp',
  target_table: 'orders'
})
// count = 5420
```

---

## Schema Summary

Get an overview of a schema:

```typescript
const { data: summary } = await supabase.rpc('get_schema_summary', {
  target_schema: 'acme_corp'
})
```

Returns:

```typescript
[
  {
    table_count: 8,
    total_rows: 15230,
    total_size: '4.5 MB'
  }
]
```

---

## Creating Tables

```typescript
await supabase.rpc('create_table', {
  target_schema: 'acme_corp',
  target_table: 'products',
  columns: [
    { name: 'id', type: 'UUID', nullable: false, default_value: 'gen_random_uuid()', is_primary: true },
    { name: 'name', type: 'TEXT', nullable: false },
    { name: 'price', type: 'NUMERIC', nullable: true, default_value: '0' },
    { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default_value: 'NOW()' }
  ]
})
```

---

## Adding Columns

```typescript
await supabase.rpc('add_column', {
  target_schema: 'acme_corp',
  target_table: 'products',
  column_name: 'description',
  column_type: 'TEXT',
  is_nullable: true,
  default_value: null
})
```

---

## Adding Foreign Keys

```typescript
await supabase.rpc('add_foreign_key', {
  target_schema: 'acme_corp',
  target_table: 'orders',
  column_name: 'product_id',
  ref_schema: 'acme_corp',
  ref_table: 'products',
  ref_column: 'id',
  on_delete: 'SET NULL',  // CASCADE | SET NULL | RESTRICT | NO ACTION
  on_update: 'NO ACTION'
})
```

---

## Dropping Columns

```typescript
await supabase.rpc('drop_column', {
  target_schema: 'acme_corp',
  target_table: 'products',
  column_name: 'deprecated_field'
})
```

---

## Dropping Foreign Keys

```typescript
await supabase.rpc('drop_foreign_key', {
  target_schema: 'acme_corp',
  target_table: 'orders',
  constraint_name: 'orders_product_id_fkey'
})
```

---

## Getting Reference Tables (for FK creation)

When building a UI to create foreign keys:

```typescript
const { data: refTables } = await supabase.rpc('get_reference_tables', {
  target_schema: 'acme_corp'
})
```

Returns tables from the current schema only (excludes public schema):

```typescript
[
  { table_schema: 'acme_corp', table_name: 'users' },
  { table_schema: 'acme_corp', table_name: 'products' },
  { table_schema: 'acme_corp', table_name: 'categories' },
  // ...
]
```

---

## Getting Primary Key Columns

For FK reference column selection:

```typescript
const { data: pkColumns } = await supabase.rpc('get_table_pk_columns', {
  target_schema: 'acme_corp',
  target_table: 'users'
})
```

Returns:

```typescript
[
  { column_name: 'id', data_type: 'uuid' }
]
```

---

## Access Requirements

| Function | Minimum Access |
|----------|----------------|
| `get_schema_tables` | `read` |
| `get_table_columns` | `read` |
| `get_table_foreign_keys` | `read` |
| `get_schema_foreign_keys` | `read` |
| `get_table_row_count` | `read` |
| `get_schema_summary` | `read` |
| `create_table` | `admin` |
| `add_column` | `admin` |
| `add_foreign_key` | `admin` |
| `drop_column` | `admin` |
| `drop_foreign_key` | `admin` |


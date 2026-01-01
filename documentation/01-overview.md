# Overview

## What is Multi-Tenant Architecture?

Multi-tenancy allows a single application to serve multiple customers (tenants) while keeping their data isolated. This system uses **schema-per-tenant** isolation, where each tenant gets their own PostgreSQL schema.

## Why Schema-per-Tenant?

| Approach | Pros | Cons |
|----------|------|------|
| **Shared tables** (row-level) | Simple, efficient | Complex RLS, risk of data leaks |
| **Schema-per-tenant** ✓ | Strong isolation, easy backup/restore | More schemas to manage |
| **Database-per-tenant** | Maximum isolation | Expensive, hard to manage |

Schema-per-tenant is the sweet spot: strong isolation with reasonable overhead.

## System Components

### 1. Public Schema Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Registry of all tenant schemas |
| `admin_users` | Platform administrators (super_admin, admin, viewer) |
| `user_schema_access` | User permissions per tenant schema |
| `admin_audit_log` | Audit trail of all admin actions |

### 2. Tenant Schema Tables (auto-created)

| Table | Purpose |
|-------|---------|
| `settings` | Key-value settings for the tenant |
| `users` | Tenant-specific user profiles (linked to auth.users) |
| `audit_log` | Audit trail for tenant data changes |

### 3. RPC Functions

| Category | Functions |
|----------|-----------|
| **Schema Management** | `create_tenant_schema`, `suspend_tenant`, `activate_tenant`, `delete_tenant_schema` |
| **User Profiles** | `create_user_profile`, `get_user_profile`, `ensure_user_profile` |
| **Access Control** | `grant_schema_access`, `revoke_schema_access`, `promote_to_admin`, `revoke_admin` |
| **Schema Inspection** | `get_schema_tables`, `get_table_columns`, `get_table_foreign_keys` |
| **DDL Operations** | `create_table`, `add_column`, `add_foreign_key`, `drop_column`, `drop_foreign_key` |
| **Tenant Status** | `check_tenant_status`, `get_tenant_info` |

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATION                              │
│                                                                          │
│  1. User signs up/logs in via Supabase Auth                              │
│                              │                                           │
│                              ▼                                           │
│  2. App calls ensure_user_profile('tenant_name')                         │
│     → Creates tenant profile if new, returns existing if not             │
│                              │                                           │
│                              ▼                                           │
│  3. App queries tenant data: SELECT * FROM tenant_name.orders            │
│     → Only works if tenant is active and user has access                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Security Model

### Authentication (Supabase Auth)
- Users authenticate via Supabase Auth (email/password, OAuth, etc.)
- Auth session provides `auth.uid()` for all subsequent operations

### Authorization (This System)
- **Platform level**: `admin_users` table defines who can manage tenants
- **Tenant level**: `user_schema_access` table defines who can access what
- **Database level**: PostgreSQL `GRANT`/`REVOKE` enforces schema access

### Suspension
When a tenant is suspended:
1. `REVOKE USAGE ON SCHEMA` — Can't even see the schema
2. `REVOKE ALL ON TABLES` — Can't read/write any data
3. Status set to `'suspended'` in `tenants` table

Queries to suspended tenant = **instant permission denied error**.


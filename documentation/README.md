# Multi-Tenant Schema Management System

A complete multi-tenant architecture for Supabase with schema-per-tenant isolation, role-based access control, and seamless Supabase Auth integration.

## Table of Contents

1. [Overview](./01-overview.md)
2. [Installation](./02-installation.md)
3. [Schema Management](./03-schema-management.md)
4. [User & Auth Integration](./04-user-auth-integration.md)
5. [Access Control](./05-access-control.md)
6. [Schema Inspection](./06-schema-inspection.md)
7. [API Reference](./07-api-reference.md)
8. [Client Examples](./08-client-examples.md)
9. [Tenant Service Integration](./09-tenant-service-integration.md)

## Quick Start

```bash
# 1. Run SQL scripts in order (in Supabase SQL Editor)
01_tables.sql
02_rls_policies.sql
03_helper_functions.sql
04_schema_management.sql
05_access_control.sql
06_schema_inspection.sql
07_setup_admin.sql

# 2. Set up your first admin
# See 07_setup_admin.sql

# 3. Create your first tenant
await supabase.rpc('create_tenant_schema', {
  p_schema_name: 'acme_corp',
  p_display_name: 'Acme Corporation'
})
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PROJECT                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   auth schema   │  │  public schema  │  │ tenant schemas  │        │
│  │                 │  │                 │  │                 │        │
│  │  • users        │  │  • tenants      │  │  • acme_corp    │        │
│  │  • sessions     │  │  • admin_users  │  │  • globex       │        │
│  │  • ...          │  │  • user_schema  │  │  • initech      │        │
│  │                 │  │    _access      │  │  • ...          │        │
│  │                 │  │  • admin_audit  │  │                 │        │
│  │                 │  │    _log         │  │  Each contains: │        │
│  │                 │  │                 │  │  • settings     │        │
│  │                 │  │  RPC Functions  │  │  • users        │        │
│  │                 │  │  for management │  │  • audit_log    │        │
│  │                 │  │                 │  │  • custom...    │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Schema-per-tenant isolation** — Each tenant gets their own PostgreSQL schema
- **Supabase Auth integration** — Link auth users to tenant-specific profiles
- **Role-based access control** — Super admins, admins, and viewers
- **Schema-level permissions** — Read, write, admin access per user per tenant
- **Suspend/Activate tenants** — Instantly revoke or restore access
- **Audit logging** — Track all administrative actions
- **Schema inspection** — Browse tables, columns, and foreign keys
- **DDL operations** — Create tables, columns, and relationships via RPC


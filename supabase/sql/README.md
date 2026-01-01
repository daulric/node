# Supabase SQL Scripts

Run these scripts in order in your Supabase SQL Editor.

## Installation Order

| # | File | Description |
|---|------|-------------|
| 1 | `01_tables.sql` | Creates core tables (admin_users, tenants, user_schema_access, audit_log) |
| 2 | `03_helper_functions.sql` | Utility functions for checking permissions |
| 3 | `02_rls_policies.sql` | Row Level Security policies (requires helper functions) |
| 4 | `04_schema_management.sql` | Create/suspend/activate/delete schema functions |
| 5 | `05_access_control.sql` | User access and admin management functions |
| 6 | `06_schema_inspection.sql` | Table and column browsing functions |
| 7 | `07_setup_admin.sql` | Set up your first super admin user |
| 8 | `08_register_existing_schema.sql` | Register existing schemas (optional) |

## Quick Start

1. Run scripts 01-06 in order
2. Sign up at `/signup` in the app
3. Run `07_setup_admin.sql` with your user UUID
4. Log in and start managing schemas!

## Script Details

### 01_tables.sql
Creates the database structure:
- `admin_users` - System administrators
- `tenants` - Registered schemas
- `user_schema_access` - Per-user schema permissions
- `admin_audit_log` - Action tracking

### 02_rls_policies.sql
Security policies that control who can:
- View/modify admin users (super_admin only)
- View/create/update/delete schemas
- View/manage user access

### 03_helper_functions.sql
Utility functions:
- `is_admin()` - Check if current user is admin
- `is_super_admin()` - Check if super admin
- `has_schema_access()` - Check schema permissions
- `get_accessible_schemas()` - List user's schemas

### 04_schema_management.sql
Schema lifecycle:
- `create_tenant_schema()` - Create new schema
- `suspend_tenant()` - Revoke access temporarily
- `activate_tenant()` - Restore access
- `delete_tenant_schema()` - Permanently delete

### 05_access_control.sql
User management:
- `grant_schema_access()` - Give user access
- `revoke_schema_access()` - Remove access
- `promote_to_admin()` - Make user admin
- `revoke_admin()` - Remove admin rights
- `list_users()` - See all users

### 06_schema_inspection.sql
Schema browsing:
- `get_schema_tables()` - List tables
- `get_table_columns()` - List columns
- `get_table_row_count()` - Count rows
- `get_schema_summary()` - Schema overview

## Troubleshooting

### "function is_admin does not exist"
Run `03_helper_functions.sql` before `02_rls_policies.sql`

### "permission denied"
Make sure you're logged in and have run `07_setup_admin.sql`

### Schema not showing up
Use `08_register_existing_schema.sql` to add existing schemas


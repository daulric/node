# b12 - Multi-Tenant SaaS Platform

A production-ready multi-tenant architecture using **schema-per-tenant isolation** built with Next.js, Supabase, and Bun.

## ✨ Features

- **Schema-per-tenant isolation** — Each tenant gets their own PostgreSQL schema
- **Role-based access control** — Super admin, admin, and viewer roles
- **User access management** — Grant/revoke schema access per user
- **Tenant lifecycle** — Create, suspend, activate, and delete tenants
- **Schema inspection** — Introspect tables, columns, and foreign keys
- **Audit logging** — Track all admin and tenant-level actions
- **Modern stack** — Next.js 16, React 19, Tailwind CSS, Radix UI

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- [Supabase](https://supabase.com/) project (cloud or self-hosted)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd b12
bun install
```

### 2. Set Up Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Initialize Database

Run the SQL scripts in order via Supabase SQL Editor:

```
supabase/sql/01_tables.sql
supabase/sql/02_rls_policies.sql
supabase/sql/03_helper_functions.sql
supabase/sql/04_schema_management.sql
supabase/sql/05_access_control.sql
supabase/sql/06_schema_inspection.sql
```

### 4. Create First Admin

After signing up, promote yourself to super admin:

```sql
INSERT INTO public.admin_users (user_id, role)
VALUES ('your-auth-user-uuid', 'super_admin');
```

### 5. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/
│   ├── api/tenants/        # API routes for tenant management
│   ├── tenants/            # Admin dashboard pages
│   ├── login/              # Authentication pages
│   └── signup/
├── components/ui/          # Radix UI components
├── supabase/sql/           # Database setup scripts
├── documentation/          # Detailed docs
├── lib/                    # Utilities
└── utils/supabase/         # Supabase client helpers
```

## 🏗️ Architecture

| Approach | This System |
|----------|-------------|
| **Isolation** | Schema-per-tenant (strong isolation, easy backup) |
| **Auth** | Supabase Auth (email, OAuth, magic links) |
| **Authorization** | PostgreSQL GRANT/REVOKE + RLS policies |
| **Suspension** | Revokes schema USAGE immediately |

### Public Schema Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Registry of all tenant schemas |
| `admin_users` | Platform administrators |
| `user_schema_access` | User permissions per tenant |
| `admin_audit_log` | Audit trail of admin actions |

## 📖 Documentation

See the [`documentation/`](./documentation/) folder for detailed guides:

- [Overview](./documentation/01-overview.md) — Architecture and concepts
- [Installation](./documentation/02-installation.md) — Setup guide
- [Schema Management](./documentation/03-schema-management.md) — CRUD operations
- [User Auth Integration](./documentation/04-user-auth-integration.md) — Auth flow
- [Access Control](./documentation/05-access-control.md) — Permissions
- [Schema Inspection](./documentation/06-schema-inspection.md) — Introspection
- [API Reference](./documentation/07-api-reference.md) — RPC functions
- [Client Examples](./documentation/08-client-examples.md) — Code samples

## 🛠️ Scripts

```bash
bun run dev      # Start development server
bun run build    # Build for production
bun run start    # Start production server
bun run lint     # Run ESLint
```

## 🔒 Security

- **Row Level Security (RLS)** enabled on all public tables
- **Schema-level isolation** via PostgreSQL GRANT/REVOKE
- **Audit logging** for compliance and debugging
- **Suspension** instantly revokes all access
- **Automated vulnerability scanning** via Dependabot and OSV-Scanner

See our [Security Policy](./SECURITY.md) for vulnerability reporting guidelines.

## 📜 Terms of Service

By using this software, you agree to our [Terms of Service](./TERMS.md), which includes:

- Limitation of liability for maintainers and contributors
- No warranty guarantees
- Indemnification clauses
- Protection for upstream authors and forkers

**Important:** If you fork this project, you must maintain the LICENSE and liability protections.

## 📄 License

[MIT License with Enhanced Liability Protection](./LICENSE)

This license protects the original authors, contributors, forkers, and anyone who builds upon this software. See [LICENSE](./LICENSE) for full details.


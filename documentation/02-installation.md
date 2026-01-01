# Installation

## Prerequisites

- Supabase project (cloud or self-hosted)
- Access to Supabase SQL Editor or `psql`
- Node.js 18+ for the admin dashboard

## Step 1: Run SQL Scripts

Execute these scripts **in order** in the Supabase SQL Editor:

```
supabase/sql/01_tables.sql       # Core tables
supabase/sql/02_rls_policies.sql # Row Level Security
supabase/sql/03_helper_functions.sql # Helper functions
supabase/sql/04_schema_management.sql # Schema CRUD
supabase/sql/05_access_control.sql # User access management
supabase/sql/06_schema_inspection.sql # Table/column inspection
```

## Step 2: Set Up First Admin

After running the scripts, you need to create your first super admin.

1. **Sign up** via your app or Supabase Auth UI
2. **Get your user ID** from the Supabase Dashboard → Authentication → Users
3. **Run this SQL** (replace with your actual user ID):

```sql
INSERT INTO public.admin_users (user_id, role)
VALUES ('your-auth-user-uuid-here', 'super_admin');
```

Or use the helper in `07_setup_admin.sql`:

```sql
-- Find user by email and make them super admin
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@yourcompany.com';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  INSERT INTO public.admin_users (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
  
  RAISE NOTICE 'User % is now a super admin', v_user_id;
END $$;
```

## Step 3: Environment Variables

Create `.env.local` in the Next.js project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Step 4: Install Dependencies

```bash
# Using bun
bun install

# Or npm
npm install
```

## Step 5: Run the Admin Dashboard

```bash
bun run dev
# or
npm run dev
```

Visit `http://localhost:3000/tenants` to access the admin dashboard.

## Registering Existing Schemas

If you have existing PostgreSQL schemas you want to manage:

```sql
-- Register an existing schema (won't create tables, just adds to registry)
SELECT public.create_tenant_schema('existing_schema_name', 'Display Name');
```

The function detects that the schema already has tables and only registers it in `public.tenants` without modifying anything.

## Verification

After installation, verify everything works:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenants', 'admin_users', 'user_schema_access', 'admin_audit_log');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check your admin status
SELECT * FROM public.admin_users WHERE user_id = auth.uid();
```


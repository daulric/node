# Tenant Service Integration (Supabase API + Auth Lifecycle)

This document explains how the **tenant service** (the Next.js server/API layer) integrates with **Supabase** for:

- tenant (schema) lifecycle
- storage bucket linking + signed URL access
- user authentication + session propagation
- creating tenant user profiles after auth

---

## What “tenant service” means in this repo

The tenant service is implemented as **Next.js Route Handlers** under `app/api/tenants/**`. It acts as a thin server-side layer that:

- calls Supabase **RPC functions** for schema operations
- uses Supabase **Storage** APIs for bucket lifecycle and object access
- relies on Supabase Auth cookies (SSR) for request authentication
- uses the **service role** key server-side only when it must perform privileged Storage actions

---

## Supabase clients used (and when)

### Client app (tenant UI)

You can use the same auth lifecycle in any client framework (Next.js, Vite React, React Native, etc). The main difference is **how sessions are persisted**:

- **Web (SPA/Next.js)**: cookies + `@supabase/ssr` helpers are convenient
- **React Native**: use `@supabase/supabase-js` with `AsyncStorage`

This repo provides a Next.js browser helper in `utils/supabase/client.ts`, but the patterns below work regardless of framework.

### Server client (tenant service / route handlers)

In this repo, the tenant service uses `utils/supabase/server.ts` inside Route Handlers and Server Components.

- Key: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Session: read/written from request cookies via `@supabase/ssr`

This is what enforces “current user” for RLS + RPC permissions.

### Admin client (service role)

Use `utils/supabase/admin.ts` when you must do privileged operations (e.g. create/delete Storage buckets).

- Key: `SUPABASE_SERVICE_ROLE_KEY`
- **Never** expose this key to the browser.

---

## Tenant lifecycle (schemas)

### Create a tenant

`POST /api/tenants`

The handler:

1. Validates the schema name format
2. Calls RPC `create_tenant_schema(p_schema_name, p_display_name)`
3. Creates a **private** Storage bucket (bucket id = schema name) using the **service role**
4. Links the bucket to the schema in `public.tenant_buckets`

This gives every tenant a default bucket immediately.

### List tenants

`GET /api/tenants`

Returns rows from `public.tenants` ordered by creation time.

### Delete a tenant

`DELETE /api/tenants/[schema]`

The handler:

1. Looks up all linked buckets in `public.tenant_buckets` for the schema
2. Calls RPC `delete_tenant_schema(schema_name)` (drops the schema and deletes registry rows)
3. Deletes each linked bucket via the **service role** client:
   - empty bucket
   - delete bucket

If `SUPABASE_SERVICE_ROLE_KEY` is missing and buckets are linked, the delete fails (to avoid orphaned buckets).

---

## Storage integration (buckets + signed URLs)

### Storage <-> tenant mapping

The linkage table is `public.tenant_buckets` (see `supabase/sql/09_storage_buckets.sql`).

This enables RLS policies on `storage.objects` to derive access from:

`storage.objects.bucket_id` → `public.tenant_buckets.tenant_schema` → `public.user_schema_access`

### List buckets for a tenant

`GET /api/tenants/[schema]/buckets`

Returns bucket ids linked to the tenant schema. Access is enforced by RLS.

### Create/link a bucket (admin only)

`POST /api/tenants/[schema]/buckets`

1. Verifies admin status via `public.is_admin()`
2. Creates a private bucket with the service role if missing
3. Inserts a link into `public.tenant_buckets`

### Create a signed URL (read access enforced)

`GET /api/tenants/[schema]/buckets/[bucket]/objects/signed-url?path=<objectPath>`

1. Confirms bucket is linked to schema (`tenant_buckets`)
2. Calls `supabase.storage.from(bucket).createSignedUrl(path, 60)`

RLS on `storage.objects` still applies to actual object access.

---

## Auth lifecycle (OTP/OAuth) and “auth change”

### Recommended tenant-user auth types

- **Email OTP**: `supabase.auth.signInWithOtp(...)` + `supabase.auth.verifyOtp(...)`
- **OAuth**: `supabase.auth.signInWithOAuth(...)`

Avoid password-based auth for tenant clients.

### Auth Provider pattern (framework-agnostic React)

Use a single provider to:

- track the current Supabase session/user
- react to `onAuthStateChange`
- ensure a tenant profile exists via `ensure_user_profile`

```tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

type TenantProfile = {
  id: string
  auth_user_id: string
  email: string
  name: string | null
  role: string
  metadata: Record<string, unknown>
  created_at: string
  is_new?: boolean
}

type AuthState = {
  user: User | null
  session: Session | null
  profile: TenantProfile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />")
  return ctx
}

export function AuthProvider({
  children,
  tenantSchema,
  supabase,
}: {
  children: React.ReactNode
  tenantSchema: string
  supabase: SupabaseClient
}) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function ensureProfile(currentUser: User) {
    const { data, error } = await supabase.schema("public").rpc("ensure_user_profile", {
      target_schema: tenantSchema,
      user_name: (currentUser.user_metadata as any)?.full_name ?? null,
    })

    if (error) throw error
    setProfile((data as any)?.[0] ?? null)
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return

      setSession(data.session)
      setUser(data.session?.user ?? null)

      if (data.session?.user) {
        try {
          await ensureProfile(data.session.user)
        } catch {
          // If user is signed in but doesn't have access to this tenant yet,
          // ensure_user_profile may fail based on your RLS/rpc rules.
          setProfile(null)
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    }

    bootstrap()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        try {
          await ensureProfile(newSession.user)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase, tenantSchema])

  const value: AuthState = {
    user,
    session,
    profile,
    loading,
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

#### Using it in web vs React Native

- **Web / Next.js**: pass a client created by your framework helper (e.g. `createBrowserClient`/`createClient`).
- **React Native**: pass a client created with `@supabase/supabase-js` and `AsyncStorage` (see below).

### React Native example (AsyncStorage + onAuthStateChange)

Create a Supabase client for native apps:

```ts
import { createClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)
```

Then use the same provider:

```tsx
<AuthProvider tenantSchema="acme_corp" supabase={supabase}>
  {children}
</AuthProvider>
```

OTP sign-in works the same in React Native (send code + verify code), and `ensure_user_profile` is the same RPC call once you have a session.

### OTP flow (email code)

1. User enters email
2. Client calls `signInWithOtp({ email, ... })`
3. User receives a code
4. Client verifies with:

```ts
await supabase.auth.verifyOtp({
  email,
  token,      // the code
  type: 'email'
})
```

> **Important:** Supabase will only email a code if your email template uses `{{ .Token }}`.

### Session propagation (browser → tenant service)

Once auth completes, Supabase sets an auth session and `@supabase/ssr` writes the session into cookies. From that point on:

- `utils/supabase/server.ts` can call `supabase.auth.getUser()` in route handlers/server components
- RLS policies apply to all `select/insert/update/delete` and RPC calls

> Tip: If you want route-level protection + automatic redirect behavior, implement a Next.js `middleware.ts` and follow the cookie/session pattern shown in `proxy.ts`.

---

## Creating users & tenant profiles after auth

There are **three** different concepts:

1. **Auth user** (`auth.users`): created when the user completes OTP/OAuth sign-in.
2. **Platform roles** (`public.admin_users`): who can manage tenants and access grants.
3. **Tenant membership** (`public.user_schema_access`): which tenants a user can access.

### Granting a user access to a tenant

Admins grant membership via:

```ts
await supabase.rpc('grant_schema_access', {
  target_user_id,
  target_schema,
  access_level: 'read' | 'write' | 'admin'
})
```

In the UI, this is done by looking up the user id by email, then calling `grant_schema_access`.

### Creating a tenant-scoped user profile (recommended)

After the user authenticates, create/ensure their per-tenant profile row inside `{schema}.users`:

```ts
const { data: profile } = await supabase.schema("public").rpc('ensure_user_profile', {
  target_schema: schemaName,
  user_name: session.user.user_metadata?.full_name ?? null
})
```

This is safe to call on every sign-in:

- first time in this tenant → creates profile (`is_new = true`)
- returning user → returns existing profile (`is_new = false`)

---

## Environment variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Required for bucket create/delete (server only):

- `SUPABASE_SERVICE_ROLE_KEY`

---

## Security notes

- Keep all privileged operations (bucket lifecycle, admin-only actions) on the server.
- Never ship `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Use RLS as the enforcement layer; the tenant service should be a thin orchestrator.



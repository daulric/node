-- =============================================================================
-- 07. SETUP FIRST ADMIN
-- =============================================================================
-- Run this AFTER creating your first user through Supabase Auth
-- Replace the placeholder values with your actual user information
-- =============================================================================

-- Step 1: Find your user ID
-- Run this query to see all users:
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Step 2: Insert yourself as super admin
-- Replace 'YOUR-USER-UUID-HERE' with the UUID from step 1
-- Replace 'your@email.com' with your actual email
-- Replace 'Your Name' with your name

/*
INSERT INTO public.admin_users (id, email, full_name, role)
VALUES (
  'YOUR-USER-UUID-HERE',  -- Replace with actual UUID from auth.users
  'your@email.com',       -- Replace with actual email
  'Your Name',            -- Replace with your name
  'super_admin'
);
*/

-- =============================================================================
-- EXAMPLE: If your user ID is 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- =============================================================================

/*
INSERT INTO public.admin_users (id, email, full_name, role)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@example.com',
  'Admin User',
  'super_admin'
);
*/

-- =============================================================================
-- VERIFY: Check that you're now an admin
-- =============================================================================

-- After inserting, run this to verify:
-- SELECT * FROM public.admin_users;

-- You should see your record with role = 'super_admin' and is_active = true


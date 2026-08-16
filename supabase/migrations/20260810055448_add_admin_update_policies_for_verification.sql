/*
# Add admin UPDATE policies for verification workflow

## Problem
The RLS UPDATE policies on `profiles`, `nurse_profiles`, and `hospitals`
only allow the row owner to update (`auth.uid() = id`). When an admin
clicks Verify/Reject in the Admin Portal, the update is silently blocked
by RLS because the admin's auth.uid() does not match the target profile's
id. The verification never takes effect.

## Fix
Add admin-scoped UPDATE policies on all three tables. These allow any
authenticated user whose profile role is 'admin' to update rows, alongside
the existing owner-only policies. Both policies are permissive (OR logic),
so the owner can still update their own row and the admin can update any
row for verification purposes.

## Data Safety
- No tables created or deleted.
- No columns added, removed, or renamed.
- No data modified.
- RLS remains enabled on all tables.
- Existing owner UPDATE policies are preserved.
*/

-- ============ profiles: admin can update ============
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ nurse_profiles: admin can update ============
DROP POLICY IF EXISTS "nurse_profiles_update_admin" ON nurse_profiles;
CREATE POLICY "nurse_profiles_update_admin" ON nurse_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ hospitals: admin can update ============
DROP POLICY IF EXISTS "hospitals_update_admin" ON hospitals;
CREATE POLICY "hospitals_update_admin" ON hospitals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

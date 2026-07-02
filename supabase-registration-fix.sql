-- ============================================================
-- PART 1: RLS Policies for Registration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Allow authenticated users to INSERT their own company
--    The company id pattern is: cop_{first_15_chars_of_user_id}
DROP POLICY IF EXISTS "users_can_insert_own_company" ON public.corevia_companies;
CREATE POLICY "users_can_insert_own_company" ON public.corevia_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = 'cop_' || substring(auth.uid()::text, 1, 15)
  );

-- 2. Allow authenticated users to SELECT their own company
DROP POLICY IF EXISTS "users_can_select_own_company" ON public.corevia_companies;
CREATE POLICY "users_can_select_own_company" ON public.corevia_companies
  FOR SELECT
  TO authenticated
  USING (
    id = 'cop_' || substring(auth.uid()::text, 1, 15)
    OR
    id IN (
      SELECT company_id FROM public.corevia_saas_users
      WHERE user_id = auth.uid()
    )
  );

-- 3. Allow authenticated users to UPDATE their own company
DROP POLICY IF EXISTS "users_can_update_own_company" ON public.corevia_companies;
CREATE POLICY "users_can_update_own_company" ON public.corevia_companies
  FOR UPDATE
  TO authenticated
  USING (
    id = 'cop_' || substring(auth.uid()::text, 1, 15)
    OR
    id IN (
      SELECT company_id FROM public.corevia_saas_users
      WHERE user_id = auth.uid()
    )
  );

-- 4. Allow authenticated users to INSERT their own user record
DROP POLICY IF EXISTS "users_can_insert_own_saas_user" ON public.corevia_saas_users;
CREATE POLICY "users_can_insert_own_saas_user" ON public.corevia_saas_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. Allow authenticated users to SELECT their own user record
DROP POLICY IF EXISTS "users_can_select_own_saas_user" ON public.corevia_saas_users;
CREATE POLICY "users_can_select_own_saas_user" ON public.corevia_saas_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR email = auth.email());

-- 6. Allow authenticated users to UPDATE their own user record
DROP POLICY IF EXISTS "users_can_update_own_saas_user" ON public.corevia_saas_users;
CREATE POLICY "users_can_update_own_saas_user" ON public.corevia_saas_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- 7. Service role bypass (already exists by default for service_role key)
--    The service_role key inherently bypasses all RLS policies.

-- 8. Revoke anon access to the tables (prevents unauthenticated reads)
DROP POLICY IF EXISTS "anon_read_companies" ON public.corevia_companies;
DROP POLICY IF EXISTS "anon_read_saas_users" ON public.corevia_saas_users;

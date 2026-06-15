-- ============================================================
-- RLS Policies for corevia_company_users
-- Enables strict company-level isolation for employee records.
-- Run this in the Supabase SQL Editor after all other tables
-- have been created.
-- ============================================================

-- 1. Enable RLS on the table
ALTER TABLE corevia_company_users ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies (clean slate)
DROP POLICY IF EXISTS "Employees can view own company members" ON corevia_company_users;
DROP POLICY IF EXISTS "Admins can manage their company employees" ON corevia_company_users;
DROP POLICY IF EXISTS "Employees can update own record" ON corevia_company_users;

-- 3. Policy: Employees can view other members of their own company
-- This is needed for things like viewing team members, chat, etc.
CREATE POLICY "Employees can view own company members" ON corevia_company_users
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT raw_user_meta_data->>'company_id'
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- 4. Policy: Admins (company owners) can manage (insert, update, delete) employees
-- Admin is identified by having role = 'admin' or 'super_admin' in user metadata.
CREATE POLICY "Admins can manage their company employees" ON corevia_company_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' = 'admin'
          OR raw_user_meta_data->>'role' = 'super_admin'
        )
        AND (
          raw_user_meta_data->>'company_id' = corevia_company_users.company_id
          OR raw_user_meta_data->>'role' = 'super_admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' = 'admin'
          OR raw_user_meta_data->>'role' = 'super_admin'
        )
        AND (
          raw_user_meta_data->>'company_id' = corevia_company_users.company_id
          OR raw_user_meta_data->>'role' = 'super_admin'
        )
    )
  );

-- 5. Policy: Employees can update their own record (e.g., last_activity)
CREATE POLICY "Employees can update own record" ON corevia_company_users
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
  );

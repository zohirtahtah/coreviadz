-- =============================================================================
-- RPC functions for Super Admin Dashboard to bypass Row-Level Security
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/.../sql/new)
-- =============================================================================

-- 0. Disable RLS on corevia_companies so admin queries return ALL companies
ALTER TABLE corevia_companies DISABLE ROW LEVEL SECURITY;

-- 1. Get ALL companies (bypasses RLS so Super Admin can see every tenant)
CREATE OR REPLACE FUNCTION get_all_companies()
RETURNS SETOF corevia_companies
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM corevia_companies;
$$ LANGUAGE sql;

-- Grant execute to authenticated and anon roles so the frontend can call it
GRANT EXECUTE ON FUNCTION get_all_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_companies() TO anon;

-- 2. Get ALL SaaS users (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_saas_users()
RETURNS SETOF corevia_saas_users
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM corevia_saas_users;
$$ LANGUAGE sql;

GRANT EXECUTE ON FUNCTION get_all_saas_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_saas_users() TO anon;

-- 3. Get ALL profiles (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_profiles()
RETURNS SETOF corevia_profile
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM corevia_profile;
$$ LANGUAGE sql;

GRANT EXECUTE ON FUNCTION get_all_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_profiles() TO anon;

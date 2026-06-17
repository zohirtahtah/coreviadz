/*
  Run this FIRST in Supabase Dashboard SQL Editor before running test_user_rbac.mjs
  Creates the per-user permission override table that allows each employee
  to have a unique permission set independent from their role.
*/

CREATE TABLE IF NOT EXISTS corevia_user_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES corevia_workers(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES corevia_permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, worker_id, permission_id)
);

ALTER TABLE corevia_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE corevia_user_permissions FORCE ROW LEVEL SECURITY;

-- Super admin bypass (service_role key)
CREATE POLICY "super_admin_all_user_perms" ON corevia_user_permissions
  FOR ALL USING (is_super_admin());

-- Company users can SELECT their own company's user permissions
CREATE POLICY "company_access_user_perms" ON corevia_user_permissions
  FOR SELECT USING (company_id = get_current_company_id());

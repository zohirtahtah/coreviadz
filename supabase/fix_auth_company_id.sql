-- Fix: Update get_current_company_id() with fallback lookups
-- This makes RLS work even if auth metadata doesn't have company_id

CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.current_tenant_id', true),
    (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
    (SELECT company_id::text FROM corevia_saas_users WHERE user_id = auth.uid()::text LIMIT 1),
    (SELECT company_id::text FROM corevia_company_users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- Update existing auth metadata to include company_id for corevia_saas_users
UPDATE auth.users SET raw_user_meta_data = 
  raw_user_meta_data || 
  jsonb_build_object('company_id', (SELECT company_id FROM corevia_saas_users WHERE user_id = auth.users.id::text))
WHERE id IN (SELECT id::uuid FROM corevia_saas_users WHERE company_id IS NOT NULL)
  AND (raw_user_meta_data->>'company_id' IS NULL OR raw_user_meta_data->>'company_id' = '');

-- Update existing auth metadata for employees in corevia_company_users
UPDATE auth.users SET raw_user_meta_data = 
  raw_user_meta_data || 
  jsonb_build_object('company_id', (SELECT company_id FROM corevia_company_users WHERE auth_user_id = auth.users.id))
WHERE id IN (SELECT auth_user_id FROM corevia_company_users WHERE auth_user_id IS NOT NULL AND company_id IS NOT NULL)
  AND (raw_user_meta_data->>'company_id' IS NULL OR raw_user_meta_data->>'company_id' = '');

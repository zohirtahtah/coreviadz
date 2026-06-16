-- Fix RLS functions: add SECURITY DEFINER so anon role can use them
-- Without SECURITY DEFINER, the anon role cannot query auth.users

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

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('super_admin', 'SuperAdmin')
  );
$$;

-- Grant execute to anon role (though SECURITY DEFINER should handle it)
GRANT EXECUTE ON FUNCTION get_current_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon, authenticated;

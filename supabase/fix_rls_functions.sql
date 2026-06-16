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
    (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
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

-- Corevia ERP v5 — Force Terminate Employee Sessions
-- Run AFTER supabase-migration-v4.sql has been executed.

CREATE OR REPLACE FUNCTION force_logout_user_by_id(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Revoke all refresh tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = user_uuid;
  -- Delete all active sessions
  DELETE FROM auth.sessions WHERE user_id = user_uuid;
  RETURN TRUE;
END;
$$;

-- Grant execution to authenticated users (admins/super_admins)
GRANT EXECUTE ON FUNCTION force_logout_user_by_id TO authenticated;

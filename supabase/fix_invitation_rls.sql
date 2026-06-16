-- Fix: Allow unauthenticated users to look up invitation tokens
-- Without this, the invite link flow is broken (anon can't SELECT from corevia_company_users)

DROP POLICY IF EXISTS "rls_select_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_select_company_users_invitation" ON corevia_company_users
  FOR SELECT USING ("invitation_token" IS NOT NULL AND "invitation_used" = false);

-- Also allow UPDATE for claim-invite on the matched record
DROP POLICY IF EXISTS "rls_update_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_update_company_users_invitation" ON corevia_company_users
  FOR UPDATE USING ("invitation_token" IS NOT NULL AND "invitation_used" = false)
  WITH CHECK ("invitation_token" IS NOT NULL);

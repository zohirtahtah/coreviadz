-- =====================================================
-- Migration: Fix missing columns for corevia_companies
-- and corevia_company_users
-- Run this in Supabase SQL Editor.
-- =====================================================

-- =====================================================
-- PART 1: Fix corevia_companies (add missing columns)
-- =====================================================
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS "accountStatus" TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "seatsLimit" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT 'Standard_Monthly',
  ADD COLUMN IF NOT EXISTS "expirationDate" DATE,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "otp_code" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

-- =====================================================
-- PART 2: Fix corevia_company_users (add missing columns)
-- =====================================================
ALTER TABLE corevia_company_users
  ADD COLUMN IF NOT EXISTS "invitation_token" TEXT,
  ADD COLUMN IF NOT EXISTS "invitation_expires" TEXT,
  ADD COLUMN IF NOT EXISTS "invitation_used" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "auth_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "assigned_responsibilities" TEXT,
  ADD COLUMN IF NOT EXISTS "last_activity" TEXT,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- Index for invitation token lookup (used in Auth.tsx)
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_token ON corevia_company_users("invitation_token");

-- Index for auth_user_id lookup (used in App.tsx permission re-verification)
CREATE INDEX IF NOT EXISTS idx_company_users_auth_user_id ON corevia_company_users("auth_user_id");

-- =====================================================
-- PART 3: Create subscription management tables
-- =====================================================
CREATE TABLE IF NOT EXISTS corevia_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'Free',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_months INTEGER NOT NULL DEFAULT 1,
  end_date DATE NOT NULL,
  seats_limit INTEGER NOT NULL DEFAULT 5,
  seats_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  renewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON corevia_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON corevia_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON corevia_subscriptions(status);

CREATE TABLE IF NOT EXISTS corevia_subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  renewal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_months INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  seats_purchased INTEGER NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_user TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_history_company_id ON corevia_subscription_history(company_id);

CREATE TABLE IF NOT EXISTS corevia_subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  days_before INTEGER NOT NULL,
  message TEXT NOT NULL,
  sent_to_super_admin BOOLEAN NOT NULL DEFAULT true,
  sent_to_company_owner BOOLEAN NOT NULL DEFAULT true,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_notif_company_id ON corevia_subscription_notifications(company_id);

CREATE TABLE IF NOT EXISTS corevia_company_seat_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL UNIQUE,
  current_seats_limit INTEGER NOT NULL DEFAULT 5,
  used_seats INTEGER NOT NULL DEFAULT 0,
  available_seats INTEGER NOT NULL DEFAULT 5,
  increased_at TIMESTAMPTZ,
  decreased_at TIMESTAMPTZ,
  custom_set_at TIMESTAMPTZ,
  last_modified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seat_mgmt_company_id ON corevia_company_seat_management(company_id);

-- =====================================================
-- PART 4: Seat limit check function
-- =====================================================
CREATE OR REPLACE FUNCTION check_seat_limit_v1(p_company_id TEXT)
RETURNS TABLE(seats_limit INTEGER, used_seats BIGINT, can_create BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_used BIGINT;
BEGIN
  SELECT COALESCE(c."seatsLimit", 5) INTO v_limit
  FROM corevia_companies c
  WHERE c.id = p_company_id;

  SELECT COUNT(*) INTO v_used
  FROM corevia_company_users e
  WHERE e.company_id = p_company_id AND e.deleted_at IS NULL;

  RETURN QUERY SELECT v_limit, v_used, (v_used < v_limit);
END;
$$;

-- =====================================================
-- PART 5: Enable RLS and add policies for corevia_company_users
-- (Safe to run multiple times; uses IF NOT EXISTS)
-- =====================================================
ALTER TABLE corevia_company_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own company members" ON corevia_company_users;
DROP POLICY IF EXISTS "Admins can manage their company employees" ON corevia_company_users;
DROP POLICY IF EXISTS "Employees can update own record" ON corevia_company_users;

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

CREATE POLICY "Employees can update own record" ON corevia_company_users
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
  );

-- =====================================================
-- PART 6: Enable RLS for corevia_companies
-- =====================================================
ALTER TABLE corevia_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company owners can view own company" ON corevia_companies;
DROP POLICY IF EXISTS "Super admins can manage all companies" ON corevia_companies;

CREATE POLICY "Company owners can view own company" ON corevia_companies
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT raw_user_meta_data->>'company_id'
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage all companies" ON corevia_companies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

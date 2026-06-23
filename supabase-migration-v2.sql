-- Corevia ERP v2 Migration — توسيع وتحديث قاعدة البيانات
-- Adapted to merge with existing corevia_* schema
-- Run in Supabase SQL Editor (safe for production data)

-- SECTION 1: Expand corevia_companies (الشركات)
-- Add new columns for subscription tracking, locks, country
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT,
  ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS current_seats INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_lock_password TEXT DEFAULT '1234',
  ADD COLUMN IF NOT EXISTS locked_pages TEXT[] DEFAULT '{}';

-- Normalize status: add new status field alongside existing accountStatus
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unverified';

-- Sync status from accountStatus for existing rows where status is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corevia_companies' AND column_name = 'accountstatus'
  ) THEN
    UPDATE corevia_companies SET status = LOWER(accountStatus) WHERE status IS NULL AND accountStatus IS NOT NULL;
  END IF;
END $$;

-- SECTION 2: Expand/Update Profiles
-- corevia_profile = business info, corevia_saas_users = admin
-- corevia_company_users = employees

-- Add profile extension columns (rc1, rc2, nif, logo_url, passcode)
ALTER TABLE corevia_profile
  ADD COLUMN IF NOT EXISTS rc1 TEXT,
  ADD COLUMN IF NOT EXISTS rc2 TEXT,
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS passcode TEXT;

-- Add is_employee flag to corevia_saas_users for admin/employee distinction
ALTER TABLE corevia_saas_users
  ADD COLUMN IF NOT EXISTS is_employee BOOLEAN DEFAULT FALSE;

-- Add allowed_pages as direct column (already in jsonb, add text[] for direct queries)
ALTER TABLE corevia_company_users
  ADD COLUMN IF NOT EXISTS allowed_pages_array TEXT[] DEFAULT '{}';

-- SECTION 3: Add SKU, Price, Alert Threshold to existing inventory
-- Single corevia_inventory table (replaces the old three-table split)
ALTER TABLE corevia_inventory ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE corevia_inventory ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE corevia_inventory ADD COLUMN IF NOT EXISTS alert_threshold INTEGER DEFAULT 0;

-- SECTION 4: Create corevia_invoices (فواتير المشتريات/المبيعات/المرتجعات)
-- New table for unified invoice tracking with SKU-level detail
CREATE TABLE IF NOT EXISTS corevia_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT DEFAULT 'cop_default',
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('purchase', 'sale', 'return')),
  target_table TEXT NOT NULL CHECK (target_table IN ('table_1', 'table_2', 'table_3')),
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- SECTION 5: Create/heal corevia_activity_center (سجل العمليات البسيط)
-- Lightweight audit log
CREATE TABLE IF NOT EXISTS corevia_activity_center (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT DEFAULT 'cop_default',
  user_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  page_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Heal columns if table was pre-existing with different schema
ALTER TABLE corevia_activity_center ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE corevia_activity_center ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE corevia_activity_center DROP CONSTRAINT IF EXISTS corevia_activity_center_action_type_check;

-- Add page_name + details columns to existing corevia_activity_logs for compatibility
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'corevia_activity_logs') THEN
    ALTER TABLE corevia_activity_logs
      ADD COLUMN IF NOT EXISTS page_name TEXT,
      ADD COLUMN IF NOT EXISTS details TEXT;
  END IF;
END $$;

-- SECTION 6: Enable RLS on new tables
ALTER TABLE corevia_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE corevia_activity_center ENABLE ROW LEVEL SECURITY;

-- SECTION 7: RLS Policies for new tables

-- Policy for corevia_invoices: company_id isolation
DROP POLICY IF EXISTS tenant_isolation_policy ON corevia_invoices;
CREATE POLICY tenant_isolation_policy ON corevia_invoices FOR ALL
  USING (
    company_id = COALESCE(
      (SELECT company_id FROM corevia_saas_users WHERE user_id = auth.uid()::text LIMIT 1),
      (SELECT company_id FROM corevia_company_users WHERE id = auth.uid()::text LIMIT 1),
      company_id
    )
  );

-- Policy for corevia_activity_center: company_id isolation
DROP POLICY IF EXISTS tenant_isolation_policy ON corevia_activity_center;
CREATE POLICY tenant_isolation_policy ON corevia_activity_center FOR ALL
  USING (
    company_id = COALESCE(
      (SELECT company_id FROM corevia_saas_users WHERE user_id = auth.uid()::text LIMIT 1),
      (SELECT company_id FROM corevia_company_users WHERE id = auth.uid()::text LIMIT 1),
      company_id
    )
  );

-- Allow Super Admin to read all rows (via SECURITY DEFINER or direct)
-- Note: If RLS was disabled on corevia_companies by supabase-rpc-fix.sql, it stays disabled

-- SECTION 8: Helper RPC for seat counting
CREATE OR REPLACE FUNCTION sync_current_seats(p_company_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM corevia_company_users
  WHERE company_id = p_company_id AND (archived_at IS NULL);

  UPDATE corevia_companies
  SET current_seats = v_count + 1
  WHERE id = p_company_id;

  RETURN v_count + 1;
END;
$$;

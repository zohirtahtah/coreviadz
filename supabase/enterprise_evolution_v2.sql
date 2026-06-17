-- COREVIA ENTERPRISE v2 – Enterprise Evolution Migration
-- Builds on top of final_migration.sql.
-- Adds 28 new tables for multi-warehouse, HR, accounting, billing, and audit.
BEGIN;

RAISE NOTICE 'Starting enterprise_evolution_v2 migration...';

-- =============================================================================
-- PART 1: TABLES
-- =============================================================================

-- 1. corevia_warehouses
CREATE TABLE IF NOT EXISTS corevia_warehouses (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT,
  address    TEXT,
  city       TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_warehouses ready';

-- 2. corevia_warehouse_stock
CREATE TABLE IF NOT EXISTS corevia_warehouse_stock (
  id                TEXT PRIMARY KEY,
  company_id        TEXT NOT NULL,
  warehouse_id      TEXT REFERENCES corevia_warehouses(id) ON DELETE CASCADE,
  product_id        TEXT,
  quantity          NUMERIC(12,2) DEFAULT 0,
  reserved_quantity NUMERIC(12,2) DEFAULT 0,
  unit_cost         NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, warehouse_id, product_id)
);
RAISE NOTICE 'Table corevia_warehouse_stock ready';

-- 3. corevia_warehouse_transfers
CREATE TABLE IF NOT EXISTS corevia_warehouse_transfers (
  id                TEXT PRIMARY KEY,
  company_id        TEXT NOT NULL,
  from_warehouse_id TEXT,
  to_warehouse_id   TEXT,
  product_id        TEXT,
  quantity          NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_by      TEXT,
  approved_by       TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);
RAISE NOTICE 'Table corevia_warehouse_transfers ready';

-- 4. corevia_stock_reservations
CREATE TABLE IF NOT EXISTS corevia_stock_reservations (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  warehouse_id TEXT,
  product_id   TEXT,
  order_id     TEXT,
  quantity     NUMERIC(12,2),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_stock_reservations ready';

-- 5. corevia_inventory_snapshots
CREATE TABLE IF NOT EXISTS corevia_inventory_snapshots (
  id                 TEXT PRIMARY KEY,
  company_id         TEXT NOT NULL,
  warehouse_id       TEXT,
  snapshot_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id         TEXT,
  expected_quantity  NUMERIC(12,2),
  actual_quantity    NUMERIC(12,2),
  variance           NUMERIC(12,2) GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
  notes              TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_inventory_snapshots ready';

-- 6. corevia_departments
CREATE TABLE IF NOT EXISTS corevia_departments (
  id                TEXT PRIMARY KEY,
  company_id        TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT,
  description       TEXT,
  manager_worker_id TEXT REFERENCES corevia_workers(id) ON DELETE SET NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_departments ready';

-- 7. corevia_contract_types
CREATE TABLE IF NOT EXISTS corevia_contract_types (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  duration_days INTEGER,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_contract_types ready';

-- 8. corevia_employment_history
CREATE TABLE IF NOT EXISTS corevia_employment_history (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  worker_id       TEXT REFERENCES corevia_workers(id) ON DELETE CASCADE,
  department_id   TEXT REFERENCES corevia_departments(id) ON DELETE SET NULL,
  contract_type_id TEXT REFERENCES corevia_contract_types(id) ON DELETE SET NULL,
  position        TEXT,
  salary          NUMERIC(12,2),
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_employment_history ready';

-- 9. corevia_employment_status_history
CREATE TABLE IF NOT EXISTS corevia_employment_status_history (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  worker_id       TEXT REFERENCES corevia_workers(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status      TEXT NOT NULL,
  changed_by      TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_employment_status_history ready';

-- 10. corevia_order_audit
CREATE TABLE IF NOT EXISTS corevia_order_audit (
  id                BIGSERIAL PRIMARY KEY,
  order_id          TEXT REFERENCES corevia_orders(id) ON DELETE CASCADE,
  company_id        TEXT NOT NULL,
  changed_by        TEXT,
  changed_by_name   TEXT,
  change_type       TEXT NOT NULL CHECK (change_type IN ('status_change', 'item_modified', 'price_modified', 'cancelled', 'returned', 'approved')),
  old_value         JSONB,
  new_value         JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_order_audit ready';

-- 11. corevia_order_approvals
CREATE TABLE IF NOT EXISTS corevia_order_approvals (
  id            TEXT PRIMARY KEY,
  order_id      TEXT REFERENCES corevia_orders(id) ON DELETE CASCADE,
  company_id    TEXT NOT NULL,
  requested_by  TEXT,
  approved_by   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at    TIMESTAMPTZ
);
RAISE NOTICE 'Table corevia_order_approvals ready';

-- 12. corevia_cancellation_reasons
CREATE TABLE IF NOT EXISTS corevia_cancellation_reasons (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('cancellation', 'return')),
  reason     TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_cancellation_reasons ready';

-- 13. corevia_chart_of_accounts
CREATE TABLE IF NOT EXISTS corevia_chart_of_accounts (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id  TEXT REFERENCES corevia_chart_of_accounts(id) ON DELETE SET NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_chart_of_accounts ready';

-- 14. corevia_journal_entries
CREATE TABLE IF NOT EXISTS corevia_journal_entries (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  entry_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  reference    TEXT,
  description  TEXT,
  total_debit  NUMERIC(14,2) DEFAULT 0,
  total_credit NUMERIC(14,2) DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  created_by   TEXT,
  posted_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_journal_entries ready';

-- 15. corevia_journal_entry_lines
CREATE TABLE IF NOT EXISTS corevia_journal_entry_lines (
  id               TEXT PRIMARY KEY,
  journal_entry_id TEXT REFERENCES corevia_journal_entries(id) ON DELETE CASCADE,
  account_id       TEXT REFERENCES corevia_chart_of_accounts(id) ON DELETE SET NULL,
  debit            NUMERIC(14,2) DEFAULT 0,
  credit           NUMERIC(14,2) DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_journal_entry_lines ready';

-- 16. corevia_payment_methods
CREATE TABLE IF NOT EXISTS corevia_payment_methods (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT CHECK (type IN ('cash', 'bank_transfer', 'check', 'credit_card', 'mobile_money', 'other')),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_payment_methods ready';

-- 17. corevia_receivables
CREATE TABLE IF NOT EXISTS corevia_receivables (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  order_id     TEXT REFERENCES corevia_orders(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount       NUMERIC(14,2) NOT NULL,
  paid_amount  NUMERIC(14,2) DEFAULT 0,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'written_off')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_receivables ready';

-- 18. corevia_payables
CREATE TABLE IF NOT EXISTS corevia_payables (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  supplier_id  TEXT REFERENCES corevia_suppliers(id) ON DELETE SET NULL,
  invoice_ref  TEXT,
  amount       NUMERIC(14,2) NOT NULL,
  paid_amount  NUMERIC(14,2) DEFAULT 0,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_payables ready';

-- 19. corevia_cash_bank_accounts
CREATE TABLE IF NOT EXISTS corevia_cash_bank_accounts (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           TEXT CHECK (type IN ('cash', 'bank', 'mobile_money')),
  account_number TEXT,
  bank_name      TEXT,
  currency       TEXT DEFAULT 'DZD',
  balance        NUMERIC(14,2) DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_cash_bank_accounts ready';

-- 20. corevia_billing_plans
CREATE TABLE IF NOT EXISTS corevia_billing_plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  price_monthly NUMERIC(10,2),
  price_yearly  NUMERIC(10,2),
  max_seats     INTEGER DEFAULT 5,
  max_warehouses INTEGER DEFAULT 1,
  features      JSONB,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_billing_plans ready';

-- 21. corevia_subscription_audit
CREATE TABLE IF NOT EXISTS corevia_subscription_audit (
  id              BIGSERIAL PRIMARY KEY,
  company_id      TEXT NOT NULL,
  subscription_tier TEXT,
  previous_tier   TEXT,
  action          TEXT NOT NULL,
  reason          TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_subscription_audit ready';

-- 22. corevia_invoices
CREATE TABLE IF NOT EXISTS corevia_invoices (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  plan_id     TEXT REFERENCES corevia_billing_plans(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL,
  tax_amount  NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_invoices ready';

-- 23. corevia_notification_center
CREATE TABLE IF NOT EXISTS corevia_notification_center (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL,
  recipient_id   TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'user' CHECK (recipient_type IN ('all', 'role', 'user')),
  title          TEXT NOT NULL,
  body           TEXT,
  type           TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  category       TEXT CHECK (category IN ('system', 'order', 'inventory', 'hr', 'subscription', 'accounting')),
  link           TEXT,
  is_read        BOOLEAN DEFAULT false,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_notification_center ready';

-- 24. corevia_notification_preferences
CREATE TABLE IF NOT EXISTS corevia_notification_preferences (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL,
  company_user_id  TEXT REFERENCES corevia_company_users(id) ON DELETE CASCADE,
  in_app           BOOLEAN DEFAULT true,
  email            BOOLEAN DEFAULT false,
  sms              BOOLEAN DEFAULT false,
  categories       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_notification_preferences ready';

-- 25. corevia_audit_log_immutable
CREATE TABLE IF NOT EXISTS corevia_audit_log_immutable (
  id          BIGSERIAL PRIMARY KEY,
  company_id  TEXT,
  actor_id    TEXT,
  actor_name  TEXT,
  actor_ip    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_audit_log_immutable ready';

-- 26. corevia_permissions
CREATE TABLE IF NOT EXISTS corevia_permissions (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT,
  description TEXT,
  module      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_permissions ready';

-- 27. corevia_role_permissions
CREATE TABLE IF NOT EXISTS corevia_role_permissions (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee', 'viewer')),
  permission_id TEXT REFERENCES corevia_permissions(id) ON DELETE CASCADE,
  company_id    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id, company_id)
);
RAISE NOTICE 'Table corevia_role_permissions ready';

-- 28. corevia_company_settings
CREATE TABLE IF NOT EXISTS corevia_company_settings (
  id          TEXT PRIMARY KEY,
  company_id  TEXT UNIQUE NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
RAISE NOTICE 'Table corevia_company_settings ready';

-- =============================================================================
-- PART 2: ROW LEVEL SECURITY
-- =============================================================================

-- Helper: ensure RLS is enabled and policies are applied for standard company-scoped tables
DO $$
DECLARE
  tbl TEXT;
  standard_tables TEXT[] := ARRAY[
    'corevia_warehouses', 'corevia_warehouse_stock', 'corevia_warehouse_transfers',
    'corevia_stock_reservations', 'corevia_inventory_snapshots', 'corevia_departments',
    'corevia_contract_types', 'corevia_employment_history', 'corevia_employment_status_history',
    'corevia_order_audit', 'corevia_order_approvals', 'corevia_cancellation_reasons',
    'corevia_chart_of_accounts', 'corevia_journal_entries', 'corevia_journal_entry_lines',
    'corevia_payment_methods', 'corevia_receivables', 'corevia_payables',
    'corevia_cash_bank_accounts', 'corevia_invoices', 'corevia_notification_center',
    'corevia_notification_preferences', 'corevia_role_permissions', 'corevia_company_settings',
    'corevia_subscription_audit'
  ];
BEGIN
  FOREACH tbl IN ARRAY standard_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_select_' || tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_insert_' || tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_update_' || tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_delete_' || tbl, tbl);

      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_select_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_super_admin() OR company_id = get_current_company_id())', 'rls_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_update_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_delete_' || tbl, tbl);
    END IF;
  END LOOP;
END;
$$;
RAISE NOTICE 'Standard RLS policies applied';

-- corevia_audit_log_immutable: INSERT and SELECT only (append-only)
ALTER TABLE IF EXISTS corevia_audit_log_immutable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_audit_log_immutable" ON corevia_audit_log_immutable;
DROP POLICY IF EXISTS "rls_insert_corevia_audit_log_immutable" ON corevia_audit_log_immutable;
DROP POLICY IF EXISTS "rls_update_corevia_audit_log_immutable" ON corevia_audit_log_immutable;
DROP POLICY IF EXISTS "rls_delete_corevia_audit_log_immutable" ON corevia_audit_log_immutable;
CREATE POLICY "rls_select_corevia_audit_log_immutable" ON corevia_audit_log_immutable FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id());
CREATE POLICY "rls_insert_corevia_audit_log_immutable" ON corevia_audit_log_immutable FOR INSERT WITH CHECK (is_super_admin() OR company_id = get_current_company_id());
-- No UPDATE/DELETE policies — append-only
RAISE NOTICE 'Append-only RLS for corevia_audit_log_immutable';

-- corevia_permissions: system-wide — all authenticated users can read, only super_admin can write
ALTER TABLE IF EXISTS corevia_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_permissions" ON corevia_permissions;
DROP POLICY IF EXISTS "rls_insert_corevia_permissions" ON corevia_permissions;
DROP POLICY IF EXISTS "rls_update_corevia_permissions" ON corevia_permissions;
DROP POLICY IF EXISTS "rls_delete_corevia_permissions" ON corevia_permissions;
CREATE POLICY "rls_select_corevia_permissions" ON corevia_permissions FOR SELECT USING (true);
CREATE POLICY "rls_insert_corevia_permissions" ON corevia_permissions FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "rls_update_corevia_permissions" ON corevia_permissions FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_permissions" ON corevia_permissions FOR DELETE USING (is_super_admin());
RAISE NOTICE 'RLS for corevia_permissions (system-wide)';

-- corevia_billing_plans: anyone can read, only super_admin can write
ALTER TABLE IF EXISTS corevia_billing_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_billing_plans" ON corevia_billing_plans;
DROP POLICY IF EXISTS "rls_insert_corevia_billing_plans" ON corevia_billing_plans;
DROP POLICY IF EXISTS "rls_update_corevia_billing_plans" ON corevia_billing_plans;
DROP POLICY IF EXISTS "rls_delete_corevia_billing_plans" ON corevia_billing_plans;
CREATE POLICY "rls_select_corevia_billing_plans" ON corevia_billing_plans FOR SELECT USING (true);
CREATE POLICY "rls_insert_corevia_billing_plans" ON corevia_billing_plans FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "rls_update_corevia_billing_plans" ON corevia_billing_plans FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_billing_plans" ON corevia_billing_plans FOR DELETE USING (is_super_admin());
RAISE NOTICE 'RLS for corevia_billing_plans (public read)';

-- corevia_notification_center: users see their own, role-wide, or company-all notifications
DROP POLICY IF EXISTS "rls_select_corevia_notification_center_relevant" ON corevia_notification_center;
CREATE POLICY "rls_select_corevia_notification_center_relevant" ON corevia_notification_center
  FOR SELECT USING (
    is_super_admin()
    OR company_id = get_current_company_id()
    AND (
      recipient_type = 'all'
      OR (recipient_type = 'user' AND recipient_id = auth.uid()::text)
      OR (recipient_type = 'role' AND recipient_id = get_current_user_role())
    )
  );
RAISE NOTICE 'Notification center RLS extended for role/user targeting';

-- =============================================================================
-- PART 3: UPDATED_AT TRIGGERS
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'corevia_warehouses', 'corevia_warehouse_stock', 'corevia_warehouse_transfers',
    'corevia_stock_reservations', 'corevia_departments', 'corevia_contract_types',
    'corevia_employment_history', 'corevia_order_approvals', 'corevia_chart_of_accounts',
    'corevia_journal_entries', 'corevia_receivables', 'corevia_payables',
    'corevia_cash_bank_accounts', 'corevia_billing_plans', 'corevia_invoices',
    'corevia_notification_preferences', 'corevia_company_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl, tbl);
    END IF;
  END LOOP;
END;
$$;
RAISE NOTICE 'Updated_at triggers applied';

-- =============================================================================
-- PART 4: AUDIT TRIGGERS (logs to corevia_audit_log_immutable)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_audit_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id TEXT;
  v_entity_type TEXT;
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
  v_entity_id TEXT;
BEGIN
  v_entity_type := TG_TABLE_NAME;
  v_entity_id := COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_company_id := NEW.company_id;
    v_new := to_jsonb(NEW);
    v_old := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_company_id := NEW.company_id;
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_company_id := OLD.company_id;
    v_new := NULL;
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO corevia_audit_log_immutable (company_id, actor_id, actor_name, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    v_company_id,
    COALESCE(current_setting('app.current_user_id', true), 'system'),
    COALESCE(current_setting('app.current_user_name', true), 'system'),
    v_action,
    v_entity_type,
    v_entity_id,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Apply audit triggers to key operational tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'corevia_warehouses', 'corevia_warehouse_stock', 'corevia_warehouse_transfers',
    'corevia_stock_reservations', 'corevia_inventory_snapshots', 'corevia_departments',
    'corevia_contract_types', 'corevia_employment_history', 'corevia_order_approvals',
    'corevia_chart_of_accounts', 'corevia_journal_entries', 'corevia_receivables',
    'corevia_payables', 'corevia_cash_bank_accounts', 'corevia_invoices',
    'corevia_company_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s_insert ON %I', tbl, tbl);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s_update ON %I', tbl, tbl);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s_delete ON %I', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_audit_%s_insert AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trigger_audit_immutable()', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_audit_%s_update AFTER UPDATE ON %I FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_audit_immutable()', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_audit_%s_delete AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_audit_immutable()', tbl, tbl);
    END IF;
  END LOOP;
END;
$$;
RAISE NOTICE 'Audit triggers applied to key tables';

-- =============================================================================
-- PART 5: PERFORMANCE INDEXES
-- =============================================================================

-- corevia_warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON corevia_warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON corevia_warehouses(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON corevia_warehouses(code);

-- corevia_warehouse_stock
CREATE INDEX IF NOT EXISTS idx_ws_company ON corevia_warehouse_stock(company_id);
CREATE INDEX IF NOT EXISTS idx_ws_warehouse ON corevia_warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ws_product ON corevia_warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_ws_company_warehouse ON corevia_warehouse_stock(company_id, warehouse_id);

-- corevia_warehouse_transfers
CREATE INDEX IF NOT EXISTS idx_wt_company ON corevia_warehouse_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_wt_from WH ON corevia_warehouse_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wt_to_wh ON corevia_warehouse_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wt_status ON corevia_warehouse_transfers(status);
CREATE INDEX IF NOT EXISTS idx_wt_product ON corevia_warehouse_transfers(product_id);

-- corevia_stock_reservations
CREATE INDEX IF NOT EXISTS idx_sr_company ON corevia_stock_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_sr_warehouse ON corevia_stock_reservations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sr_product ON corevia_stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_sr_order ON corevia_stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_sr_status ON corevia_stock_reservations(status);

-- corevia_inventory_snapshots
CREATE INDEX IF NOT EXISTS idx_is_company ON corevia_inventory_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_is_warehouse ON corevia_inventory_snapshots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_is_product ON corevia_inventory_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_is_date ON corevia_inventory_snapshots(snapshot_date DESC);

-- corevia_departments
CREATE INDEX IF NOT EXISTS idx_depts_company ON corevia_departments(company_id);
CREATE INDEX IF NOT EXISTS idx_depts_manager ON corevia_departments(manager_worker_id);
CREATE INDEX IF NOT EXISTS idx_depts_active ON corevia_departments(is_active);

-- corevia_contract_types
CREATE INDEX IF NOT EXISTS idx_ct_company ON corevia_contract_types(company_id);
CREATE INDEX IF NOT EXISTS idx_ct_active ON corevia_contract_types(is_active);

-- corevia_employment_history
CREATE INDEX IF NOT EXISTS idx_eh_company ON corevia_employment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_eh_worker ON corevia_employment_history(worker_id);
CREATE INDEX IF NOT EXISTS idx_eh_dept ON corevia_employment_history(department_id);
CREATE INDEX IF NOT EXISTS idx_eh_current ON corevia_employment_history(is_current);
CREATE INDEX IF NOT EXISTS idx_eh_dates ON corevia_employment_history(start_date, end_date);

-- corevia_employment_status_history
CREATE INDEX IF NOT EXISTS idx_esh_company ON corevia_employment_status_history(company_id);
CREATE INDEX IF NOT EXISTS idx_esh_worker ON corevia_employment_status_history(worker_id);
CREATE INDEX IF NOT EXISTS idx_esh_created ON corevia_employment_status_history(created_at DESC);

-- corevia_order_audit
CREATE INDEX IF NOT EXISTS idx_oa_order ON corevia_order_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_oa_company ON corevia_order_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_oa_type ON corevia_order_audit(change_type);
CREATE INDEX IF NOT EXISTS idx_oa_created ON corevia_order_audit(created_at DESC);

-- corevia_order_approvals
CREATE INDEX IF NOT EXISTS idx_oappr_order ON corevia_order_approvals(order_id);
CREATE INDEX IF NOT EXISTS idx_oappr_company ON corevia_order_approvals(company_id);
CREATE INDEX IF NOT EXISTS idx_oappr_status ON corevia_order_approvals(status);

-- corevia_cancellation_reasons
CREATE INDEX IF NOT EXISTS idx_cr_company ON corevia_cancellation_reasons(company_id);
CREATE INDEX IF NOT EXISTS idx_cr_type ON corevia_cancellation_reasons(type);
CREATE INDEX IF NOT EXISTS idx_cr_active ON corevia_cancellation_reasons(is_active);

-- corevia_chart_of_accounts
CREATE INDEX IF NOT EXISTS idx_coa_company ON corevia_chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON corevia_chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_type ON corevia_chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS idx_coa_code ON corevia_chart_of_accounts(code);

-- corevia_journal_entries
CREATE INDEX IF NOT EXISTS idx_je_company ON corevia_journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_je_date ON corevia_journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_status ON corevia_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_reference ON corevia_journal_entries(reference);

-- corevia_journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_jel_entry ON corevia_journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON corevia_journal_entry_lines(account_id);

-- corevia_payment_methods
CREATE INDEX IF NOT EXISTS idx_pm_company ON corevia_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_pm_type ON corevia_payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_pm_active ON corevia_payment_methods(is_active);

-- corevia_receivables
CREATE INDEX IF NOT EXISTS idx_rec_company ON corevia_receivables(company_id);
CREATE INDEX IF NOT EXISTS idx_rec_order ON corevia_receivables(order_id);
CREATE INDEX IF NOT EXISTS idx_rec_status ON corevia_receivables(status);
CREATE INDEX IF NOT EXISTS idx_rec_due ON corevia_receivables(due_date);

-- corevia_payables
CREATE INDEX IF NOT EXISTS idx_pay_company ON corevia_payables(company_id);
CREATE INDEX IF NOT EXISTS idx_pay_supplier ON corevia_payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON corevia_payables(status);
CREATE INDEX IF NOT EXISTS idx_pay_due ON corevia_payables(due_date);

-- corevia_cash_bank_accounts
CREATE INDEX IF NOT EXISTS idx_cba_company ON corevia_cash_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_cba_type ON corevia_cash_bank_accounts(type);
CREATE INDEX IF NOT EXISTS idx_cba_active ON corevia_cash_bank_accounts(is_active);

-- corevia_billing_plans
CREATE INDEX IF NOT EXISTS idx_bp_active ON corevia_billing_plans(is_active);

-- corevia_subscription_audit
CREATE INDEX IF NOT EXISTS idx_sa_company ON corevia_subscription_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_sa_created ON corevia_subscription_audit(created_at DESC);

-- corevia_invoices
CREATE INDEX IF NOT EXISTS idx_inv_company ON corevia_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_plan ON corevia_invoices(plan_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON corevia_invoices(status);
CREATE INDEX IF NOT EXISTS idx_inv_due ON corevia_invoices(due_date);

-- corevia_notification_center
CREATE INDEX IF NOT EXISTS idx_nc_company ON corevia_notification_center(company_id);
CREATE INDEX IF NOT EXISTS idx_nc_recipient ON corevia_notification_center(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_nc_read ON corevia_notification_center(is_read);
CREATE INDEX IF NOT EXISTS idx_nc_category ON corevia_notification_center(category);
CREATE INDEX IF NOT EXISTS idx_nc_created ON corevia_notification_center(created_at DESC);

-- corevia_notification_preferences
CREATE INDEX IF NOT EXISTS idx_np_company ON corevia_notification_preferences(company_id);
CREATE INDEX IF NOT EXISTS idx_np_user ON corevia_notification_preferences(company_user_id);

-- corevia_audit_log_immutable
CREATE INDEX IF NOT EXISTS idx_ali_company ON corevia_audit_log_immutable(company_id);
CREATE INDEX IF NOT EXISTS idx_ali_actor ON corevia_audit_log_immutable(actor_id);
CREATE INDEX IF NOT EXISTS idx_ali_action ON corevia_audit_log_immutable(action);
CREATE INDEX IF NOT EXISTS idx_ali_entity ON corevia_audit_log_immutable(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ali_created ON corevia_audit_log_immutable(created_at DESC);

-- corevia_permissions
CREATE INDEX IF NOT EXISTS idx_perm_code ON corevia_permissions(code);
CREATE INDEX IF NOT EXISTS idx_perm_module ON corevia_permissions(module);

-- corevia_role_permissions
CREATE INDEX IF NOT EXISTS idx_rp_role ON corevia_role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_rp_permission ON corevia_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_rp_company ON corevia_role_permissions(company_id);

-- corevia_company_settings
CREATE INDEX IF NOT EXISTS idx_cs_company ON corevia_company_settings(company_id);

RAISE NOTICE 'All performance indexes created';

-- =============================================================================
-- PART 6: DEFAULT PERMISSIONS
-- =============================================================================

INSERT INTO corevia_permissions (id, code, name, description, module) VALUES
  -- Orders
  ('perm_orders_create',    'orders.create',    'Create Orders',    'Create new orders',             'orders'),
  ('perm_orders_read',      'orders.read',      'Read Orders',      'View order details',            'orders'),
  ('perm_orders_update',    'orders.update',    'Update Orders',    'Modify existing orders',        'orders'),
  ('perm_orders_delete',    'orders.delete',    'Delete Orders',    'Remove orders from system',     'orders'),
  ('perm_orders_approve',   'orders.approve',   'Approve Orders',   'Approve pending orders',        'orders'),
  ('perm_orders_export',    'orders.export',    'Export Orders',    'Export order data',             'orders'),
  -- Workers
  ('perm_workers_create',   'workers.create',   'Create Workers',   'Add new workers',               'workers'),
  ('perm_workers_read',     'workers.read',     'Read Workers',     'View worker profiles',          'workers'),
  ('perm_workers_update',   'workers.update',   'Update Workers',   'Edit worker details',           'workers'),
  ('perm_workers_delete',   'workers.delete',   'Delete Workers',   'Remove worker records',         'workers'),
  ('perm_workers_export',   'workers.export',   'Export Workers',   'Export worker data',            'workers'),
  -- Products
  ('perm_products_create',  'products.create',  'Create Products',  'Add new products',              'products'),
  ('perm_products_read',    'products.read',    'Read Products',    'View product catalog',          'products'),
  ('perm_products_update',  'products.update',  'Update Products',  'Modify product details',        'products'),
  ('perm_products_delete',  'products.delete',  'Delete Products',  'Remove products from catalog',  'products'),
  ('perm_products_export',  'products.export',  'Export Products',  'Export product data',           'products'),
  -- Inventory
  ('perm_inventory_create', 'inventory.create', 'Create Inventory', 'Add inventory records',         'inventory'),
  ('perm_inventory_read',   'inventory.read',   'Read Inventory',   'View inventory levels',         'inventory'),
  ('perm_inventory_update', 'inventory.update', 'Update Inventory', 'Adjust inventory quantities',   'inventory'),
  ('perm_inventory_delete', 'inventory.delete', 'Delete Inventory', 'Remove inventory records',      'inventory'),
  ('perm_inventory_export', 'inventory.export', 'Export Inventory', 'Export inventory data',         'inventory'),
  -- Suppliers
  ('perm_suppliers_create', 'suppliers.create', 'Create Suppliers', 'Add new suppliers',             'suppliers'),
  ('perm_suppliers_read',   'suppliers.read',   'Read Suppliers',   'View supplier information',     'suppliers'),
  ('perm_suppliers_update', 'suppliers.update', 'Update Suppliers', 'Modify supplier details',       'suppliers'),
  ('perm_suppliers_delete', 'suppliers.delete', 'Delete Suppliers', 'Remove supplier records',       'suppliers'),
  ('perm_suppliers_export', 'suppliers.export', 'Export Suppliers', 'Export supplier data',          'suppliers'),
  -- Expenses
  ('perm_expenses_create',  'expenses.create',  'Create Expenses',  'Record new expenses',           'expenses'),
  ('perm_expenses_read',    'expenses.read',    'Read Expenses',    'View expense records',          'expenses'),
  ('perm_expenses_update',  'expenses.update',  'Update Expenses',  'Modify expense entries',        'expenses'),
  ('perm_expenses_delete',  'expenses.delete',  'Delete Expenses',  'Remove expense records',        'expenses'),
  ('perm_expenses_export',  'expenses.export',  'Export Expenses',  'Export expense data',           'expenses'),
  -- Subscriptions
  ('perm_subs_create',      'subscriptions.create', 'Create Subs',     'Create subscriptions',           'subscriptions'),
  ('perm_subs_read',        'subscriptions.read',   'Read Subs',       'View subscription details',     'subscriptions'),
  ('perm_subs_update',      'subscriptions.update', 'Update Subs',     'Modify subscriptions',          'subscriptions'),
  ('perm_subs_delete',      'subscriptions.delete', 'Delete Subs',     'Cancel subscriptions',          'subscriptions'),
  -- Accounting
  ('perm_accounting_create', 'accounting.create', 'Create Journal',  'Create journal entries',        'accounting'),
  ('perm_accounting_read',   'accounting.read',   'Read Journal',    'View journal entries',          'accounting'),
  ('perm_accounting_update', 'accounting.update', 'Update Journal',  'Modify journal entries',        'accounting'),
  ('perm_accounting_delete', 'accounting.delete', 'Delete Journal',  'Remove journal entries',        'accounting'),
  ('perm_accounting_export', 'accounting.export', 'Export Journal',  'Export accounting data',        'accounting'),
  -- HR
  ('perm_hr_create',        'hr.create',        'Create HR',       'Create HR records',             'hr'),
  ('perm_hr_read',          'hr.read',          'Read HR',         'View HR records',               'hr'),
  ('perm_hr_update',        'hr.update',        'Update HR',       'Modify HR records',             'hr'),
  ('perm_hr_delete',        'hr.delete',        'Delete HR',       'Remove HR records',             'hr'),
  ('perm_hr_export',        'hr.export',        'Export HR',       'Export HR data',                'hr'),
  -- Settings
  ('perm_settings_create',  'settings.create',  'Create Settings', 'Create company settings',       'settings'),
  ('perm_settings_read',    'settings.read',    'Read Settings',   'View company settings',         'settings'),
  ('perm_settings_update',  'settings.update',  'Update Settings', 'Modify company settings',       'settings'),
  ('perm_settings_delete',  'settings.delete',  'Delete Settings', 'Reset company settings',        'settings'),
  -- Chat
  ('perm_chat_create',      'chat.create',      'Send Messages',   'Send chat messages',            'chat'),
  ('perm_chat_read',        'chat.read',        'Read Messages',   'View chat messages',            'chat'),
  ('perm_chat_delete',      'chat.delete',      'Delete Messages', 'Delete chat messages',          'chat'),
  -- Notifications
  ('perm_notif_create',     'notifications.create', 'Create Notif',    'Send notifications',            'notifications'),
  ('perm_notif_read',       'notifications.read',   'Read Notif',      'Read notifications',           'notifications'),
  ('perm_notif_update',     'notifications.update', 'Update Notif',    'Update notification settings',  'notifications'),
  ('perm_notif_delete',     'notifications.delete', 'Delete Notif',    'Clear notifications',          'notifications'),
  -- Warehouses
  ('perm_wh_create',        'warehouses.create', 'Create WH',      'Create warehouses',             'warehouses'),
  ('perm_wh_read',          'warehouses.read',   'Read WH',        'View warehouses',               'warehouses'),
  ('perm_wh_update',        'warehouses.update', 'Update WH',      'Modify warehouses',             'warehouses'),
  ('perm_wh_delete',        'warehouses.delete', 'Delete WH',      'Remove warehouses',             'warehouses'),
  -- Departments
  ('perm_dept_create',      'departments.create', 'Create Dept',    'Create departments',             'departments'),
  ('perm_dept_read',        'departments.read',   'Read Dept',      'View departments',              'departments'),
  ('perm_dept_update',      'departments.update', 'Update Dept',    'Modify departments',            'departments'),
  ('perm_dept_delete',      'departments.delete', 'Delete Dept',    'Remove departments',            'departments'),
  -- Reports
  ('perm_reports_read',     'reports.read',     'Read Reports',    'View reports',                  'reports'),
  ('perm_reports_export',   'reports.export',   'Export Reports',  'Export report data',            'reports')
ON CONFLICT (code) DO NOTHING;
RAISE NOTICE 'Default permissions inserted';

-- =============================================================================
-- PART 7: DEFAULT BILLING PLANS
-- =============================================================================

INSERT INTO corevia_billing_plans (id, name, description, price_monthly, price_yearly, max_seats, max_warehouses, features) VALUES
  ('plan_free',       'Free',       'Basic plan for small businesses',            0,    0,    5,  1,  '{"inventory": true, "orders": true, "workers": true, "reports": false, "multi_warehouse": false, "accounting": false}'::JSONB),
  ('plan_starter',    'Starter',    'Growing businesses with more users',         29,   290,  15, 3,  '{"inventory": true, "orders": true, "workers": true, "reports": true, "multi_warehouse": true, "accounting": false}'::JSONB),
  ('plan_professional', 'Professional', 'Full-featured for established companies', 99,   990,  50, 10, '{"inventory": true, "orders": true, "workers": true, "reports": true, "multi_warehouse": true, "accounting": true}'::JSONB),
  ('plan_enterprise', 'Enterprise', 'Unlimited everything for large enterprises',  299,  2990, 999, 999, '{"inventory": true, "orders": true, "workers": true, "reports": true, "multi_warehouse": true, "accounting": true, "api_access": true, "custom_integrations": true}'::JSONB)
ON CONFLICT (id) DO NOTHING;
RAISE NOTICE 'Default billing plans inserted';

-- =============================================================================
-- PART 8: GRANT EXECUTE ON FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION trigger_set_updated_at() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION trigger_audit_immutable() TO anon, authenticated;

RAISE NOTICE 'Enterprise Evolution v2 migration complete';

COMMIT;

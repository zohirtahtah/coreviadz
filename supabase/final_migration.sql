-- COREVIA ENTERPRISE – FINAL COMPREHENSIVE MIGRATION
BEGIN;

-- PART 0: CREATE MISSING TABLES (safe: IF NOT EXISTS)

-- corevia_expenses
CREATE TABLE IF NOT EXISTS corevia_expenses (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  description   TEXT NOT NULL DEFAULT '',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT '',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by       TEXT DEFAULT '',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- corevia_subscription_logs
CREATE TABLE IF NOT EXISTS corevia_subscription_logs (
  id              BIGSERIAL PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  previous_state  JSONB,
  new_state       JSONB,
  created_by      TEXT NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- corevia_saas_users (admin / super-admin login records)
CREATE TABLE IF NOT EXISTS corevia_saas_users (
  user_id                   TEXT PRIMARY KEY,
  company_id                TEXT REFERENCES corevia_companies(id) ON DELETE SET NULL,
  email                     TEXT NOT NULL DEFAULT '',
  username                  TEXT DEFAULT '',
  role                      TEXT NOT NULL DEFAULT 'admin'
                              CHECK (role IN ('admin','super_admin','developer')),
  has_completed_onboarding  BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- corevia_activity_center (audit trail / activity log)
CREATE TABLE IF NOT EXISTS corevia_activity_center (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES corevia_companies(id) ON DELETE CASCADE,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name       TEXT NOT NULL DEFAULT '',
  user_id         TEXT NOT NULL DEFAULT '',
  job_title       TEXT DEFAULT '',
  action_type     TEXT NOT NULL DEFAULT '',
  page_name       TEXT DEFAULT '',
  affected_record TEXT,
  previous_value  TEXT,
  new_value       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 1: MIGRATE REMAINING _old DATA

-- Migrate workers from _old
DO $$
BEGIN
  INSERT INTO corevia_workers (id, company_id, full_name, phone, position, salary, status, created_at, updated_at)
  SELECT w.id, w.company_id,
    COALESCE(w.name, ''),
    COALESCE(w.phone, ''),
    COALESCE(w.role, ''),
    COALESCE(w.base_salary, 0),
    'active',
    COALESCE(w.created_at, now()),
    COALESCE(w.updated_at, now())
  FROM corevia_workers_old w
  WHERE w.company_id IN (SELECT id FROM corevia_companies)
    AND NOT EXISTS (SELECT 1 FROM corevia_workers t WHERE t.id = w.id);
  RAISE NOTICE 'Migrated % workers from _old', SQL%ROWCOUNT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Workers migration skipped: %', SQLERRM;
END;
$$;

-- Migrate chat messages from _old
DO $$
BEGIN
  INSERT INTO corevia_chat_messages (id, company_id, sender_id, sender_name, message, created_at)
  SELECT m.id, m.company_id,
    COALESCE(m.sender_id, 'system'),
    COALESCE(m.sender_name, ''),
    COALESCE(m.content, ''),
    COALESCE(m.created_at, now())
  FROM corevia_chat_messages_old m
  WHERE m.company_id IN (SELECT id FROM corevia_companies)
    AND NOT EXISTS (SELECT 1 FROM corevia_chat_messages t WHERE t.id = m.id);
  RAISE NOTICE 'Migrated % chat messages from _old', SQL%ROWCOUNT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Chat messages migration skipped: %', SQLERRM;
END;
$$;

-- Migrate audit logs from _old
DO $$
BEGIN
  INSERT INTO corevia_audit_logs (company_id, actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
  SELECT COALESCE(a.company_id, (SELECT id FROM corevia_companies LIMIT 1)),
    COALESCE(a.admin_id, 'system'),
    a.action,
    CASE WHEN a.action LIKE 'employee%' THEN 'worker'
         WHEN a.action LIKE 'company%' THEN 'company'
         ELSE 'general'
    END,
    COALESCE(a.new_data->>'id', a.old_data->>'id', a.id::TEXT),
    a.old_data,
    a.new_data,
    COALESCE(a.created_at, now())
  FROM corevia_admin_audit_logs_old a
  WHERE NOT EXISTS (SELECT 1 FROM corevia_audit_logs t WHERE t.id = a.id);
  RAISE NOTICE 'Migrated % audit logs from _old', SQL%ROWCOUNT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Audit logs migration skipped: %', SQLERRM;
END;
$$;

-- Migrate products from _old (fill in missing details)
DO $$
BEGIN
  INSERT INTO corevia_products (id, company_id, name, description, price, cost, category, unit, created_at, updated_at)
  SELECT p.id, p.company_id,
    COALESCE(p.name, ''),
    '',
    COALESCE(p.retail_price, p.wholesale_price, 0),
    COALESCE(p.retail_cost_price, p.wholesale_cost_price, 0),
    '',
    '',
    COALESCE(p.created_at, now()),
    COALESCE(p.updated_at, now())
  FROM corevia_products_old p
  WHERE p.company_id IN (SELECT id FROM corevia_companies)
    AND NOT EXISTS (SELECT 1 FROM corevia_products t WHERE t.id = p.id);
  RAISE NOTICE 'Migrated % products from _old', SQL%ROWCOUNT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Products migration skipped: %', SQLERRM;
END;
$$;

-- Migrate suppliers from _old (fill in missing details)
DO $$
BEGIN
  INSERT INTO corevia_suppliers (id, company_id, name, contact_name, phone, email, address, created_at, updated_at)
  SELECT s.id, s.company_id,
    COALESCE(s.name, ''),
    '',
    COALESCE(s.phone, ''),
    COALESCE(s.email, ''),
    COALESCE(s.address, ''),
    COALESCE(s.created_at, now()),
    COALESCE(s.updated_at, now())
  FROM corevia_suppliers_old s
  WHERE s.company_id IN (SELECT id FROM corevia_companies)
    AND NOT EXISTS (SELECT 1 FROM corevia_suppliers t WHERE t.id = s.id);
  RAISE NOTICE 'Migrated % suppliers from _old', SQL%ROWCOUNT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Suppliers migration skipped: %', SQLERRM;
END;
$$;

-- Ensure corevia_companies has best data from all sources
DO $$
BEGIN
  UPDATE corevia_companies c
  SET
    owner_email = COALESCE(NULLIF(c.owner_email, ''), (SELECT email FROM companies WHERE id = c.id), (SELECT email FROM corevia_companies_old WHERE id = c.id), c.owner_email),
    phone       = COALESCE(NULLIF(c.phone, ''), (SELECT phone FROM companies WHERE id = c.id), (SELECT phone FROM corevia_companies_old WHERE id = c.id), c.phone),
    country     = COALESCE(NULLIF(c.country, ''), (SELECT country FROM corevia_companies_old WHERE id = c.id), c.country),
    name        = COALESCE(NULLIF(c.name, ''), (SELECT company_name FROM companies WHERE id = c.id), (SELECT name FROM corevia_companies_old WHERE id = c.id), c.name)
  WHERE c.id IN (SELECT id FROM companies) OR c.id IN (SELECT id FROM corevia_companies_old);
  RAISE NOTICE 'Updated corevia_companies from source tables';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Companies enrichment skipped: %', SQLERRM;
END;
$$;

-- Insert owner as SaaS user if not exists
DO $$
BEGIN
  INSERT INTO corevia_saas_users (user_id, company_id, email, username, role, has_completed_onboarding)
  SELECT
    COALESCE((SELECT owner_id FROM companies LIMIT 1), c.id),
    c.id,
    COALESCE(c.owner_email, ''),
    c.owner_name,
    'admin',
    true
  FROM corevia_companies c
  WHERE NOT EXISTS (SELECT 1 FROM corevia_saas_users s WHERE s.company_id = c.id);
  RAISE NOTICE 'Inserted SaaS user for company';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SaaS user insert skipped: %', SQLERRM;
END;
$$;

-- PART 2: FUNCTIONS (SEAT ENFORCEMENT & HELPERS)

CREATE OR REPLACE FUNCTION count_active_company_users(p_company_id TEXT)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM corevia_company_users
  WHERE company_id = p_company_id
    AND status IN ('active', 'read_only')
    AND archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION can_create_company_user(p_company_id TEXT)
RETURNS TABLE(seats_limit INTEGER, active_count INTEGER, can_create BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_active INTEGER;
BEGIN
  SELECT COALESCE(c.seats_limit, 5) INTO v_limit FROM corevia_companies c WHERE c.id = p_company_id;
  SELECT COUNT(*)::INTEGER INTO v_active
  FROM corevia_company_users u
  WHERE u.company_id = p_company_id AND u.status IN ('active', 'read_only') AND u.archived_at IS NULL;
  RETURN QUERY SELECT v_limit, v_active, (v_active < v_limit);
END;
$$;

CREATE OR REPLACE FUNCTION get_company_status(p_company_id TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT status FROM corevia_companies WHERE id = p_company_id; $$;

CREATE OR REPLACE FUNCTION is_company_active(p_company_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM corevia_companies WHERE id = p_company_id AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.current_tenant_id', true),
    (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
    (SELECT company_id::text FROM corevia_saas_users WHERE user_id = auth.uid()::text LIMIT 1),
    (SELECT company_id::text FROM corevia_company_users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_role', true),
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    (SELECT role::text FROM corevia_company_users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('super_admin', 'SuperAdmin')
  );
$$;

-- PART 3: ROW LEVEL SECURITY (applied via helper function)

CREATE OR REPLACE FUNCTION apply_company_rls(p_table TEXT)
RETURNS VOID LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_select_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_insert_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_update_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_delete_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_select_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_super_admin() OR company_id = get_current_company_id())', 'rls_insert_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_update_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_delete_' || p_table, p_table);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped RLS for %: %', p_table, SQLERRM;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'corevia_workers','corevia_company_users','corevia_orders','corevia_order_items',
    'corevia_products','corevia_suppliers','corevia_inventory','corevia_stock_movements',
    'corevia_expenses','corevia_chat_messages','corevia_notifications','corevia_subscription_logs',
    'corevia_activity_center'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      PERFORM apply_company_rls(tbl);
    END IF;
  END LOOP;
END;
$$;

-- corevia_companies specific RLS
ALTER TABLE IF EXISTS corevia_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_insert_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_update_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_delete_corevia_companies" ON corevia_companies;
CREATE POLICY "rls_select_corevia_companies" ON corevia_companies FOR SELECT USING (is_super_admin() OR id = get_current_company_id());
CREATE POLICY "rls_insert_corevia_companies" ON corevia_companies FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "rls_update_corevia_companies" ON corevia_companies FOR UPDATE USING (is_super_admin() OR id = get_current_company_id());
CREATE POLICY "rls_delete_corevia_companies" ON corevia_companies FOR DELETE USING (is_super_admin());

-- corevia_company_users specific RLS (own record access for non-admins)
DROP POLICY IF EXISTS "rls_select_corevia_company_users" ON corevia_company_users;
DROP POLICY IF EXISTS "rls_update_corevia_company_users" ON corevia_company_users;
CREATE POLICY "rls_select_corevia_company_users" ON corevia_company_users FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id() OR auth_user_id = auth.uid());
CREATE POLICY "rls_update_corevia_company_users" ON corevia_company_users FOR UPDATE USING (is_super_admin() OR company_id = get_current_company_id() OR auth_user_id = auth.uid());

-- Invitation access on corevia_company_users (unauthenticated users can verify invites)
DROP POLICY IF EXISTS "rls_select_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_select_company_users_invitation" ON corevia_company_users FOR SELECT USING (invitation_token IS NOT NULL AND invitation_used = false);
DROP POLICY IF EXISTS "rls_update_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_update_company_users_invitation" ON corevia_company_users FOR UPDATE USING (invitation_token IS NOT NULL AND invitation_used = false) WITH CHECK (invitation_token IS NOT NULL);

-- corevia_audit_logs specific RLS
ALTER TABLE IF EXISTS corevia_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_insert_corevia_audit_logs" ON corevia_audit_logs;
DROP POLICY IF EXISTS "rls_select_corevia_audit_logs" ON corevia_audit_logs;
DROP POLICY IF EXISTS "rls_update_corevia_audit_logs" ON corevia_audit_logs;
DROP POLICY IF EXISTS "rls_delete_corevia_audit_logs" ON corevia_audit_logs;
CREATE POLICY "rls_insert_corevia_audit_logs" ON corevia_audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "rls_select_corevia_audit_logs" ON corevia_audit_logs FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id());
CREATE POLICY "rls_update_corevia_audit_logs" ON corevia_audit_logs FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_audit_logs" ON corevia_audit_logs FOR DELETE USING (is_super_admin());

-- corevia_saas_users specific RLS
ALTER TABLE IF EXISTS corevia_saas_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_saas_users" ON corevia_saas_users;
DROP POLICY IF EXISTS "rls_update_corevia_saas_users" ON corevia_saas_users;
CREATE POLICY "rls_select_corevia_saas_users" ON corevia_saas_users FOR SELECT USING (is_super_admin() OR user_id = auth.uid()::text);
CREATE POLICY "rls_update_corevia_saas_users" ON corevia_saas_users FOR UPDATE USING (is_super_admin() OR user_id = auth.uid()::text);

-- corevia_subscription_logs specific RLS
ALTER TABLE IF EXISTS corevia_subscription_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_subscription_logs" ON corevia_subscription_logs;
DROP POLICY IF EXISTS "rls_insert_corevia_subscription_logs" ON corevia_subscription_logs;
DROP POLICY IF EXISTS "rls_update_corevia_subscription_logs" ON corevia_subscription_logs;
DROP POLICY IF EXISTS "rls_delete_corevia_subscription_logs" ON corevia_subscription_logs;
CREATE POLICY "rls_select_corevia_subscription_logs" ON corevia_subscription_logs FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id());
CREATE POLICY "rls_insert_corevia_subscription_logs" ON corevia_subscription_logs FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "rls_update_corevia_subscription_logs" ON corevia_subscription_logs FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_subscription_logs" ON corevia_subscription_logs FOR DELETE USING (is_super_admin());

-- PART 4: FORCE ROW LEVEL SECURITY

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'corevia_companies','corevia_workers','corevia_company_users','corevia_orders',
    'corevia_order_items','corevia_products','corevia_suppliers','corevia_inventory',
    'corevia_stock_movements','corevia_expenses','corevia_chat_messages','corevia_notifications',
    'corevia_subscription_logs','corevia_audit_logs','corevia_saas_users','corevia_activity_center'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END;
$$;

-- PART 5: PERFORMANCE INDEXES

CREATE INDEX IF NOT EXISTS idx_workers_company ON corevia_workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON corevia_workers(status);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON corevia_company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_worker ON corevia_company_users(worker_id);
CREATE INDEX IF NOT EXISTS idx_company_users_auth ON corevia_company_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_email ON corevia_company_users(email);
CREATE INDEX IF NOT EXISTS idx_company_users_role ON corevia_company_users(role);
CREATE INDEX IF NOT EXISTS idx_company_users_status ON corevia_company_users(status);
CREATE INDEX IF NOT EXISTS idx_company_users_invite_token ON corevia_company_users(invitation_token);
CREATE INDEX IF NOT EXISTS idx_company_users_invite_expires ON corevia_company_users(invitation_expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_company ON corevia_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON corevia_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON corevia_orders(customer);
CREATE INDEX IF NOT EXISTS idx_orders_created ON corevia_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON corevia_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON corevia_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON corevia_products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON corevia_products(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON corevia_suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON corevia_suppliers(category);
CREATE INDEX IF NOT EXISTS idx_inventory_company ON corevia_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON corevia_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON corevia_inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON corevia_inventory(warehouse);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON corevia_stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON corevia_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON corevia_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON corevia_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON corevia_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON corevia_expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON corevia_expenses(category);
CREATE INDEX IF NOT EXISTS idx_chat_company ON corevia_chat_messages(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON corevia_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON corevia_notifications(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON corevia_notifications(notif_type);
CREATE INDEX IF NOT EXISTS idx_audit_company ON corevia_audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON corevia_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON corevia_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON corevia_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON corevia_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_logs_company ON corevia_subscription_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saas_users_company ON corevia_saas_users(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_users_email ON corevia_saas_users(email);
CREATE INDEX IF NOT EXISTS idx_activity_center_company ON corevia_activity_center(company_id, timestamp DESC);

-- PART 6: AUDIT TRIGGERS

CREATE OR REPLACE FUNCTION trigger_audit_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO corevia_audit_logs (company_id, actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    NEW.id,
    COALESCE(current_setting('app.current_user_id', true), 'system'),
    CASE WHEN TG_OP = 'INSERT' THEN 'company_created' ELSE 'company_updated' END,
    'company', NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('status', OLD.status, 'seats_limit', OLD.seats_limit, 'name', OLD.name) ELSE NULL END,
    jsonb_build_object('status', NEW.status, 'seats_limit', NEW.seats_limit, 'name', NEW.name)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_company_insert ON corevia_companies;
DROP TRIGGER IF EXISTS trg_audit_company_update ON corevia_companies;
CREATE TRIGGER trg_audit_company_insert AFTER INSERT ON corevia_companies FOR EACH ROW EXECUTE FUNCTION trigger_audit_company();
CREATE TRIGGER trg_audit_company_update AFTER UPDATE ON corevia_companies FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_audit_company();

CREATE OR REPLACE FUNCTION trigger_audit_company_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'user_created';
  ELSIF TG_OP = 'DELETE' THEN v_action := 'user_deleted';
  ELSE
    IF OLD.status IS DISTINCT FROM NEW.status THEN v_action := 'user_status_changed';
    ELSIF OLD.role IS DISTINCT FROM NEW.role THEN v_action := 'user_role_changed';
    ELSE v_action := 'user_updated'; END IF;
  END IF;
  INSERT INTO corevia_audit_logs (company_id, actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    COALESCE(current_setting('app.current_user_id', true), 'system'),
    v_action, 'company_user', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('email', OLD.email, 'role', OLD.role, 'status', OLD.status)
         WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('email', OLD.email, 'role', OLD.role, 'status', OLD.status)
         ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('email', NEW.email, 'role', NEW.role, 'status', NEW.status) END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_company_user_insert ON corevia_company_users;
DROP TRIGGER IF EXISTS trg_audit_company_user_update ON corevia_company_users;
DROP TRIGGER IF EXISTS trg_audit_company_user_delete ON corevia_company_users;
CREATE TRIGGER trg_audit_company_user_insert AFTER INSERT ON corevia_company_users FOR EACH ROW EXECUTE FUNCTION trigger_audit_company_user();
CREATE TRIGGER trg_audit_company_user_update AFTER UPDATE ON corevia_company_users FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_audit_company_user();
CREATE TRIGGER trg_audit_company_user_delete AFTER DELETE ON corevia_company_users FOR EACH ROW EXECUTE FUNCTION trigger_audit_company_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE tbl TEXT; tables TEXT[] := ARRAY[
  'corevia_companies','corevia_workers','corevia_company_users','corevia_orders',
  'corevia_products','corevia_suppliers','corevia_inventory','corevia_expenses',
  'corevia_saas_users'
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

-- PART 7: GRANT EXECUTE ON FUNCTIONS

GRANT EXECUTE ON FUNCTION get_current_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_company_active(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_company_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_active_company_users(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION can_create_company_user(TEXT) TO anon, authenticated;

-- PART 8: CLEANUP - remove deprecated files

-- Drop old source tables & their FK dependencies
DROP TABLE IF EXISTS corevia_admin_audit_logs_old CASCADE;
DROP TABLE IF EXISTS corevia_companies_old CASCADE;
DROP TABLE IF EXISTS corevia_chat_messages_old CASCADE;
DROP TABLE IF EXISTS corevia_workers_old CASCADE;
DROP TABLE IF EXISTS corevia_products_old CASCADE;
DROP TABLE IF EXISTS corevia_suppliers_old CASCADE;
DROP TABLE IF EXISTS corevia_orders_old CASCADE;
DROP TABLE IF EXISTS corevia_expenses_old CASCADE;
DROP TABLE IF EXISTS corevia_company_users_old CASCADE;
DROP TABLE IF EXISTS corevia_subscription_logs_old CASCADE;
DROP TABLE IF EXISTS corevia_company_notifications_old CASCADE;
DROP TABLE IF EXISTS corevia_salary_sheets CASCADE;
DROP TABLE IF EXISTS corevia_employee_submissions CASCADE;
DROP TABLE IF EXISTS corevia_profile CASCADE;
DROP TABLE IF EXISTS corevia_subscription_reminders CASCADE;

-- Drop the old 'companies' table (data merged into corevia_companies)
DROP TABLE IF EXISTS companies CASCADE;

COMMIT;

-- COREVIA ERP – COMPLETE PRODUCTION MIGRATION (HARDENED)
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS / OR REPLACE)
-- Paste into Supabase SQL Editor and click RUN once.
BEGIN;

-- PART 1: UPGRADE corevia_companies
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS "accountStatus" TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "seatsLimit" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT 'Standard_Monthly',
  ADD COLUMN IF NOT EXISTS "subscriptionStartDate" DATE,
  ADD COLUMN IF NOT EXISTS "subscriptionDurationMonths" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "subscriptionEndDate" DATE,
  ADD COLUMN IF NOT EXISTS "trialStartDate" DATE,
  ADD COLUMN IF NOT EXISTS "trialEndDate" DATE,
  ADD COLUMN IF NOT EXISTS "companyLogo" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPaymentDate" DATE,
  ADD COLUMN IF NOT EXISTS "nextRenewalDate" DATE,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "suspendedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- Backfill timestamps
UPDATE corevia_companies SET "createdAt" = created_at WHERE "createdAt" IS NULL AND created_at IS NOT NULL;
UPDATE corevia_companies SET "updatedAt" = now() WHERE "updatedAt" IS NULL;

-- CHECK constraints
ALTER TABLE corevia_companies DROP CONSTRAINT IF EXISTS chk_companies_account_status;
ALTER TABLE corevia_companies ADD CONSTRAINT chk_companies_account_status
  CHECK ("accountStatus" IN ('Active', 'Expired', 'Suspended', 'Read Only', 'Pending Verification', 'Disabled'));

ALTER TABLE corevia_companies DROP CONSTRAINT IF EXISTS chk_companies_subscription_plan;
ALTER TABLE corevia_companies ADD CONSTRAINT chk_companies_subscription_plan
  CHECK ("subscriptionPlan" IN ('Starter', 'Professional', 'Business', 'Enterprise', 'Standard_Monthly', 'Trial'));

ALTER TABLE corevia_companies DROP CONSTRAINT IF EXISTS chk_companies_seats_positive;
ALTER TABLE corevia_companies ADD CONSTRAINT chk_companies_seats_positive
  CHECK ("seatsLimit" IS NULL OR "seatsLimit" >= 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_account_status ON corevia_companies("accountStatus");
CREATE INDEX IF NOT EXISTS idx_companies_subscription_end ON corevia_companies("subscriptionEndDate");
CREATE INDEX IF NOT EXISTS idx_companies_seats_limit ON corevia_companies("seatsLimit");
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON corevia_companies("createdAt");

-- PART 2: UPGRADE corevia_company_users
ALTER TABLE corevia_company_users
  ADD COLUMN IF NOT EXISTS "invitation_token" TEXT,
  ADD COLUMN IF NOT EXISTS "invitation_used" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "password_set" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "employee_role" TEXT DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS "employee_status" TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- invitation_expires_at: add as TIMESTAMPTZ, convert existing TEXT data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corevia_company_users' AND column_name = 'invitation_expires_at'
  ) THEN
    ALTER TABLE corevia_company_users ADD COLUMN "invitation_expires_at" TIMESTAMPTZ;
  ELSE
    -- If column exists as TEXT, convert to TIMESTAMPTZ
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'corevia_company_users'
        AND column_name = 'invitation_expires_at'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE corevia_company_users
        ALTER COLUMN "invitation_expires_at" TYPE TIMESTAMPTZ
        USING CASE
          WHEN "invitation_expires_at" ~ '^\d{4}-\d{2}-\d{2}' THEN "invitation_expires_at"::TIMESTAMPTZ
          ELSE NULL
        END;
    END IF;
  END IF;
END;
$$;

-- auth_user_id: add as UUID, convert existing TEXT data, reference auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corevia_company_users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE corevia_company_users ADD COLUMN "auth_user_id" UUID;
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'corevia_company_users'
        AND column_name = 'auth_user_id'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE corevia_company_users
        ALTER COLUMN "auth_user_id" TYPE UUID
        USING CASE
          WHEN "auth_user_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN "auth_user_id"::UUID
          ELSE NULL
        END;
    END IF;
  END IF;
END;
$$;

-- Backfill: migrate old invitation_expires (TEXT) to invitation_expires_at (TIMESTAMPTZ)
-- Protected: invitation_expires column may not exist (not part of original schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corevia_company_users' AND column_name = 'invitation_expires'
  ) THEN
    UPDATE corevia_company_users
      SET "invitation_expires_at" = invitation_expires::TIMESTAMPTZ
      WHERE "invitation_expires_at" IS NULL
        AND invitation_expires IS NOT NULL
        AND invitation_expires ~ '^\d{4}-\d{2}-\d{2}';
  END IF;
END;
$$;

-- Backfill: employee_status and password_set
UPDATE corevia_company_users SET "employee_status" = status WHERE "employee_status" IS NULL AND status IS NOT NULL;
UPDATE corevia_company_users SET "updated_at" = now() WHERE "updated_at" IS NULL;
UPDATE corevia_company_users SET "password_set" = true
  WHERE password IS NOT NULL AND password != '' AND ("password_set" IS NULL OR "password_set" = false);

-- Normalize employee_status to canonical lowercase values
DO $$
BEGIN
  UPDATE corevia_company_users SET "employee_status" = 'active'
    WHERE "employee_status" IN ('Active', 'Read Only');
  UPDATE corevia_company_users SET "employee_status" = 'pending'
    WHERE "employee_status" = 'Pending';
  UPDATE corevia_company_users SET "employee_status" = 'suspended'
    WHERE "employee_status" = 'Suspended';
  UPDATE corevia_company_users SET "employee_status" = 'inactive'
    WHERE "employee_status" = 'Disabled';
END;
$$;

-- CHECK constraints
ALTER TABLE corevia_company_users DROP CONSTRAINT IF EXISTS chk_company_users_employee_role;
ALTER TABLE corevia_company_users ADD CONSTRAINT chk_company_users_employee_role
  CHECK ("employee_role" IN ('owner', 'admin', 'manager', 'employee', 'viewer'));

ALTER TABLE corevia_company_users DROP CONSTRAINT IF EXISTS chk_company_users_employee_status;
ALTER TABLE corevia_company_users ADD CONSTRAINT chk_company_users_employee_status
  CHECK ("employee_status" IN ('active', 'inactive', 'pending', 'suspended'));

ALTER TABLE corevia_company_users DROP CONSTRAINT IF EXISTS chk_company_users_invitation_used_not_null;
ALTER TABLE corevia_company_users ADD CONSTRAINT chk_company_users_invitation_used_not_null
  CHECK ("invitation_used" IS NOT NULL);

-- Foreign key: company_id references corevia_companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_company_users_company'
      AND table_name = 'corevia_company_users'
  ) THEN
    DELETE FROM corevia_company_users
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_company_users
      ADD CONSTRAINT fk_company_users_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

-- Foreign key: auth_user_id references auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_company_users_auth'
      AND table_name = 'corevia_company_users'
  ) THEN
    ALTER TABLE corevia_company_users
      ADD CONSTRAINT fk_company_users_auth
      FOREIGN KEY ("auth_user_id") REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON corevia_company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_token ON corevia_company_users("invitation_token");
CREATE INDEX IF NOT EXISTS idx_company_users_auth_user_id ON corevia_company_users("auth_user_id");
CREATE INDEX IF NOT EXISTS idx_company_users_employee_status ON corevia_company_users("employee_status");
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_expiry ON corevia_company_users("invitation_expires_at");
CREATE INDEX IF NOT EXISTS idx_company_users_email ON corevia_company_users(email);
CREATE INDEX IF NOT EXISTS idx_company_users_username ON corevia_company_users(username);
CREATE INDEX IF NOT EXISTS idx_company_users_phone ON corevia_company_users(phone);

-- PART 3: FOREIGN KEYS ON EXISTING TABLES

-- corevia_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_orders_company' AND table_name = 'corevia_orders'
  ) THEN
    DELETE FROM corevia_orders
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_orders
      ADD CONSTRAINT fk_orders_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_products_company' AND table_name = 'corevia_products'
  ) THEN
    DELETE FROM corevia_products
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_products
      ADD CONSTRAINT fk_products_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_suppliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_suppliers_company' AND table_name = 'corevia_suppliers'
  ) THEN
    DELETE FROM corevia_suppliers
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_suppliers
      ADD CONSTRAINT fk_suppliers_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_workers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_workers_company' AND table_name = 'corevia_workers'
  ) THEN
    -- Remove orphan rows whose company_id does not exist in corevia_companies
    DELETE FROM corevia_workers
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_workers
      ADD CONSTRAINT fk_workers_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_salary_sheets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_salary_company' AND table_name = 'corevia_salary_sheets'
  ) THEN
    DELETE FROM corevia_salary_sheets
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_salary_sheets
      ADD CONSTRAINT fk_salary_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_expenses_company' AND table_name = 'corevia_expenses'
  ) THEN
    DELETE FROM corevia_expenses
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_expenses
      ADD CONSTRAINT fk_expenses_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_employee_submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_emp_submissions_company' AND table_name = 'corevia_employee_submissions'
  ) THEN
    DELETE FROM corevia_employee_submissions
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_employee_submissions
      ADD CONSTRAINT fk_emp_submissions_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_chat_company' AND table_name = 'corevia_chat_messages'
  ) THEN
    DELETE FROM corevia_chat_messages
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_chat_messages
      ADD CONSTRAINT fk_chat_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- corevia_profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_profile_company' AND table_name = 'corevia_profile'
  ) THEN
    DELETE FROM corevia_profile
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_profile
      ADD CONSTRAINT fk_profile_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- PART 4: SUBSCRIPTION & AUDIT TABLES

-- 4a. corevia_subscription_logs
CREATE TABLE IF NOT EXISTS corevia_subscription_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  old_plan TEXT,
  new_plan TEXT,
  old_seats INTEGER,
  new_seats INTEGER,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sub_logs_company' AND table_name = 'corevia_subscription_logs'
  ) THEN
    ALTER TABLE corevia_subscription_logs
      ADD CONSTRAINT fk_sub_logs_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_sub_logs_company_id ON corevia_subscription_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_sub_logs_created_at ON corevia_subscription_logs(created_at);

-- 4b. corevia_company_notifications
CREATE TABLE IF NOT EXISTS corevia_company_notifications (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_company_notifs_company' AND table_name = 'corevia_company_notifications'
  ) THEN
    ALTER TABLE corevia_company_notifications
      ADD CONSTRAINT fk_company_notifs_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_company_notifs_company ON corevia_company_notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_company_notifs_read ON corevia_company_notifications(read);

-- 4c. corevia_subscription_reminders
CREATE TABLE IF NOT EXISTS corevia_subscription_reminders (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  reminder_date DATE NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'expiry',
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sub_reminders_company' AND table_name = 'corevia_subscription_reminders'
  ) THEN
    ALTER TABLE corevia_subscription_reminders
      ADD CONSTRAINT fk_sub_reminders_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_sub_reminders_company ON corevia_subscription_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_sub_reminders_date ON corevia_subscription_reminders(reminder_date);

-- 4d. corevia_admin_audit_logs
CREATE TABLE IF NOT EXISTS corevia_admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL,
  company_id TEXT,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_admin_audit_company' AND table_name = 'corevia_admin_audit_logs'
  ) THEN
    ALTER TABLE corevia_admin_audit_logs
      ADD CONSTRAINT fk_admin_audit_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE SET NULL;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON corevia_admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_company ON corevia_admin_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON corevia_admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON corevia_admin_audit_logs(created_at);

-- PART 5: INVENTORY TABLES (ALTER TABLE for tables created by SettingsView.tsx)
-- All operations protected: tables may not exist (created by app at runtime)

-- 5a. corevia_inventory_basic – add migration columns if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_basic'
  ) THEN
    ALTER TABLE corevia_inventory_basic
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS warehouse TEXT,
      ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unit TEXT,
      ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_basic'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_inv_basic_company' AND table_name = 'corevia_inventory_basic'
    ) THEN
      ALTER TABLE corevia_inventory_basic
        ADD CONSTRAINT fk_inv_basic_company
        FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_basic'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_inv_basic_company ON corevia_inventory_basic(company_id);
    CREATE INDEX IF NOT EXISTS idx_inv_basic_product ON corevia_inventory_basic(product_id);
  END IF;
END;
$$;

-- 5b. corevia_inventory_sub
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_sub'
  ) THEN
    ALTER TABLE corevia_inventory_sub
      ADD COLUMN IF NOT EXISTS parent_id TEXT,
      ADD COLUMN IF NOT EXISTS warehouse TEXT,
      ADD COLUMN IF NOT EXISTS unit TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_sub'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_inv_sub_company' AND table_name = 'corevia_inventory_sub'
    ) THEN
      ALTER TABLE corevia_inventory_sub
        ADD CONSTRAINT fk_inv_sub_company
        FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_sub'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_inv_sub_company ON corevia_inventory_sub(company_id);
    CREATE INDEX IF NOT EXISTS idx_inv_sub_parent ON corevia_inventory_sub(parent_id);
  END IF;
END;
$$;

-- 5c. corevia_inventory_return
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_return'
  ) THEN
    ALTER TABLE corevia_inventory_return
      ADD COLUMN IF NOT EXISTS product_id TEXT,
      ADD COLUMN IF NOT EXISTS reason TEXT,
      ADD COLUMN IF NOT EXISTS return_date DATE,
      ADD COLUMN IF NOT EXISTS supplier_id TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_return'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_inv_return_company' AND table_name = 'corevia_inventory_return'
    ) THEN
      ALTER TABLE corevia_inventory_return
        ADD CONSTRAINT fk_inv_return_company
        FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_inventory_return'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_inv_return_company ON corevia_inventory_return(company_id);
    CREATE INDEX IF NOT EXISTS idx_inv_return_status ON corevia_inventory_return(status);
  END IF;
END;
$$;

-- 5d. corevia_stock_movements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_stock_movements'
  ) THEN
    ALTER TABLE corevia_stock_movements
      ADD COLUMN IF NOT EXISTS product_id TEXT,
      ADD COLUMN IF NOT EXISTS product_name TEXT,
      ADD COLUMN IF NOT EXISTS movement_type TEXT,
      ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS from_warehouse TEXT,
      ADD COLUMN IF NOT EXISTS to_warehouse TEXT,
      ADD COLUMN IF NOT EXISTS reference_type TEXT,
      ADD COLUMN IF NOT EXISTS reference_id TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_by TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_stock_movements'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_stock_moves_company' AND table_name = 'corevia_stock_movements'
    ) THEN
      ALTER TABLE corevia_stock_movements
        ADD CONSTRAINT fk_stock_moves_company
        FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_stock_movements'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_stock_moves_company ON corevia_stock_movements(company_id);
    CREATE INDEX IF NOT EXISTS idx_stock_moves_product ON corevia_stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_moves_type ON corevia_stock_movements(movement_type);
    CREATE INDEX IF NOT EXISTS idx_stock_moves_created ON corevia_stock_movements(created_at);
  END IF;
END;
$$;

-- PART 6: corevia_activity_center (CREATE – no existing definition in codebase)
CREATE TABLE IF NOT EXISTS corevia_activity_center (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name TEXT,
  user_id TEXT,
  job_title TEXT,
  action_type TEXT NOT NULL DEFAULT 'info',
  page_name TEXT,
  affected_record TEXT,
  previous_value JSONB,
  new_value JSONB
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_activity_center_company' AND table_name = 'corevia_activity_center'
  ) THEN
    DELETE FROM corevia_activity_center
    WHERE company_id IS NOT NULL
      AND company_id NOT IN (SELECT id FROM corevia_companies);
    ALTER TABLE corevia_activity_center
      ADD CONSTRAINT fk_activity_center_company
      FOREIGN KEY (company_id) REFERENCES corevia_companies(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_activity_company ON corevia_activity_center(company_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_user ON corevia_activity_center(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON corevia_activity_center(action_type);

-- PART 7: SQL FUNCTIONS – SEAT ENFORCEMENT
CREATE OR REPLACE FUNCTION get_active_employee_count(p_company_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM corevia_company_users
  WHERE company_id = p_company_id
    AND ("employee_status" IS NULL OR "employee_status" = 'active')
    AND "deleted_at" IS NULL;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION can_create_employee(p_company_id TEXT)
RETURNS TABLE(seats_limit INTEGER, active_count INTEGER, can_create BOOLEAN)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_limit INTEGER;
  v_active INTEGER;
BEGIN
  SELECT COALESCE(c."seatsLimit", 5) INTO v_limit
  FROM corevia_companies c WHERE c.id = p_company_id;
  SELECT COUNT(*) INTO v_active
  FROM corevia_company_users
  WHERE company_id = p_company_id
    AND ("employee_status" IS NULL OR "employee_status" = 'active')
    AND "deleted_at" IS NULL;
  RETURN QUERY SELECT v_limit, v_active, (v_active < v_limit);
END;
$$;

-- PART 8: SUBSCRIPTION EXPIRATION FUNCTION (FIXED)
-- Captures old_status BEFORE update to produce correct audit data.
CREATE OR REPLACE FUNCTION check_subscription_status()
RETURNS TABLE(company_id TEXT, old_status TEXT, new_status TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, "accountStatus"
    FROM corevia_companies
    WHERE "accountStatus" IN ('Active', 'Read Only')
      AND "subscriptionEndDate" IS NOT NULL
      AND "subscriptionEndDate" < CURRENT_DATE
    FOR UPDATE
  LOOP
    -- Capture old status before update
    UPDATE corevia_companies
    SET "accountStatus" = 'Expired', "updatedAt" = now()
    WHERE id = rec.id;

    -- Write audit log using pre-captured old status
    INSERT INTO corevia_admin_audit_logs (admin_id, company_id, action, old_data, new_data)
    VALUES (
      'system',
      rec.id,
      'company_updated',
      jsonb_build_object('accountStatus', rec."accountStatus"),
      jsonb_build_object('accountStatus', 'Expired')
    );

    -- Return row
    company_id := rec.id;
    old_status := rec."accountStatus";
    new_status := 'Expired';
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- PART 9: TRIGGER FUNCTIONS FOR AUDIT LOGGING

-- 9a. Audit: company changes
CREATE OR REPLACE FUNCTION audit_company_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO corevia_admin_audit_logs (admin_id, company_id, action, old_data, new_data)
  VALUES (
    COALESCE(NEW."suspendedBy", current_setting('app.current_user_id', true), 'system'),
    NEW.id,
    'company_updated',
    jsonb_build_object(
      'accountStatus', OLD."accountStatus",
      'seatsLimit', OLD."seatsLimit",
      'subscriptionPlan', OLD."subscriptionPlan",
      'subscriptionEndDate', OLD."subscriptionEndDate"
    ),
    jsonb_build_object(
      'accountStatus', NEW."accountStatus",
      'seatsLimit', NEW."seatsLimit",
      'subscriptionPlan', NEW."subscriptionPlan",
      'subscriptionEndDate', NEW."subscriptionEndDate"
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_company_change ON corevia_companies;
CREATE TRIGGER trg_audit_company_change
  AFTER UPDATE ON corevia_companies
  FOR EACH ROW
  WHEN (
    (OLD."accountStatus" IS DISTINCT FROM NEW."accountStatus") OR
    (OLD."seatsLimit" IS DISTINCT FROM NEW."seatsLimit") OR
    (OLD."subscriptionPlan" IS DISTINCT FROM NEW."subscriptionPlan") OR
    (OLD."subscriptionEndDate" IS DISTINCT FROM NEW."subscriptionEndDate")
  )
  EXECUTE FUNCTION audit_company_change();

-- 9b. Audit: employee changes (FIXED: handles DELETE where NEW is NULL)
CREATE OR REPLACE FUNCTION audit_employee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_action TEXT;
BEGIN
  -- Determine action and safely get company_id (NEW is NULL on DELETE)
  IF TG_OP = 'DELETE' THEN
    v_action := 'employee_deleted';
    v_company_id := OLD.company_id;
    v_old_data := jsonb_build_object(
      'id', OLD.id,
      'full_name', OLD.full_name,
      'status', OLD.status,
      'employee_status', OLD."employee_status",
      'email', OLD.email,
      'phone', OLD.phone
    );
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'employee_created';
    v_company_id := NEW.company_id;
    v_old_data := NULL;
    v_new_data := jsonb_build_object(
      'id', NEW.id,
      'full_name', NEW.full_name,
      'status', NEW.status,
      'employee_status', NEW."employee_status",
      'email', NEW.email,
      'phone', NEW.phone,
      'auth_user_id', NEW."auth_user_id"
    );
  ELSE
    v_action := 'employee_updated';
    v_company_id := NEW.company_id;
    v_old_data := jsonb_build_object(
      'id', OLD.id, 'full_name', OLD.full_name,
      'status', OLD.status, 'employee_status', OLD."employee_status",
      'invitation_used', OLD."invitation_used", 'auth_user_id', OLD."auth_user_id"
    );
    v_new_data := jsonb_build_object(
      'id', NEW.id, 'full_name', NEW.full_name,
      'status', NEW.status, 'employee_status', NEW."employee_status",
      'invitation_used', NEW."invitation_used", 'auth_user_id', NEW."auth_user_id"
    );
  END IF;

  INSERT INTO corevia_admin_audit_logs (admin_id, company_id, action, old_data, new_data)
  VALUES (
    COALESCE(current_setting('app.current_user_id', true), 'system'),
    v_company_id,
    v_action,
    v_old_data,
    v_new_data
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_employee_insert ON corevia_company_users;
CREATE TRIGGER trg_audit_employee_insert
  AFTER INSERT ON corevia_company_users
  FOR EACH ROW
  EXECUTE FUNCTION audit_employee_change();

DROP TRIGGER IF EXISTS trg_audit_employee_delete ON corevia_company_users;
CREATE TRIGGER trg_audit_employee_delete
  AFTER DELETE ON corevia_company_users
  FOR EACH ROW
  EXECUTE FUNCTION audit_employee_change();

DROP TRIGGER IF EXISTS trg_audit_employee_update ON corevia_company_users;
CREATE TRIGGER trg_audit_employee_update
  AFTER UPDATE ON corevia_company_users
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION audit_employee_change();

-- 9c. Auto-update updatedAt on companies
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON corevia_companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON corevia_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- 9d. Auto-update updated_at on company_users
CREATE OR REPLACE FUNCTION update_company_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_users_updated_at ON corevia_company_users;
CREATE TRIGGER trg_company_users_updated_at
  BEFORE UPDATE ON corevia_company_users
  FOR EACH ROW
  EXECUTE FUNCTION update_company_users_updated_at();

-- PART 10: ROW LEVEL SECURITY – ALL TABLES

-- Helper: get current user's company_id from auth.users metadata
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

-- Helper: check if current user is super_admin
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

-- Helper: apply company_isolation policies to a table (DRY)
CREATE OR REPLACE FUNCTION apply_company_rls(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  sel_pol TEXT;
  ins_pol TEXT;
  upd_pol TEXT;
  del_pol TEXT;
BEGIN
  -- Drop existing policies
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_select_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_insert_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_update_' || p_table, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'rls_delete_' || p_table, p_table);

  -- Create new policies
  EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_select_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_super_admin() OR company_id = get_current_company_id())', 'rls_insert_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_update_' || p_table, p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (is_super_admin() OR company_id = get_current_company_id())', 'rls_delete_' || p_table, p_table);
END;
$$;

-- Apply RLS to all company-scoped tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- corevia_companies excluded: uses id not company_id — handled as special case below
    'corevia_company_users',
    'corevia_orders',
    'corevia_products',
    'corevia_suppliers',
    'corevia_workers',
    'corevia_salary_sheets',
    'corevia_inventory_basic',
    'corevia_inventory_sub',
    'corevia_inventory_return',
    'corevia_stock_movements',
    'corevia_employee_submissions',
    'corevia_chat_messages',
    'corevia_company_notifications',
    'corevia_expenses',
    'corevia_profile',
    'corevia_saas_users',
    'corevia_activity_logs',
    'corevia_subscriptions',
    'corevia_subscription_history',
    'corevia_subscription_notifications',
    'corevia_company_seat_management',
    'corevia_subscription_logs',
    'corevia_subscription_reminders',
    'corevia_admin_audit_logs',
    'corevia_activity_center'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      PERFORM apply_company_rls(tbl);
    END IF;
  END LOOP;
END;
$$;

-- Special case: corevia_company_users needs additional check for auth_user_id on SELECT and UPDATE
DROP POLICY IF EXISTS "rls_select_corevia_company_users" ON corevia_company_users;
DROP POLICY IF EXISTS "rls_update_corevia_company_users" ON corevia_company_users;

CREATE POLICY "rls_select_corevia_company_users" ON corevia_company_users
  FOR SELECT USING (
    is_super_admin()
    OR company_id = get_current_company_id()
    OR "auth_user_id" = auth.uid()
  );

CREATE POLICY "rls_update_corevia_company_users" ON corevia_company_users
  FOR UPDATE USING (
    is_super_admin()
    OR company_id = get_current_company_id()
    OR "auth_user_id" = auth.uid()
  );

-- Allow unauthenticated invitation token lookups (required for invite link flow)
DROP POLICY IF EXISTS "rls_select_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_select_company_users_invitation" ON corevia_company_users
  FOR SELECT USING ("invitation_token" IS NOT NULL AND "invitation_used" = false);

DROP POLICY IF EXISTS "rls_update_company_users_invitation" ON corevia_company_users;
CREATE POLICY "rls_update_company_users_invitation" ON corevia_company_users
  FOR UPDATE USING ("invitation_token" IS NOT NULL AND "invitation_used" = false)
  WITH CHECK ("invitation_token" IS NOT NULL);

-- Special case: corevia_profile has id OR company_id as identifier
DROP POLICY IF EXISTS "rls_select_corevia_profile" ON corevia_profile;
DROP POLICY IF EXISTS "rls_update_corevia_profile" ON corevia_profile;
DROP POLICY IF EXISTS "rls_insert_corevia_profile" ON corevia_profile;
DROP POLICY IF EXISTS "rls_delete_corevia_profile" ON corevia_profile;

CREATE POLICY "rls_select_corevia_profile" ON corevia_profile
  FOR SELECT USING (is_super_admin() OR company_id = get_current_company_id() OR id = get_current_company_id());
CREATE POLICY "rls_insert_corevia_profile" ON corevia_profile
  FOR INSERT WITH CHECK (is_super_admin() OR company_id = get_current_company_id() OR id = get_current_company_id());
CREATE POLICY "rls_update_corevia_profile" ON corevia_profile
  FOR UPDATE USING (is_super_admin() OR company_id = get_current_company_id() OR id = get_current_company_id());
CREATE POLICY "rls_delete_corevia_profile" ON corevia_profile
  FOR DELETE USING (is_super_admin() OR company_id = get_current_company_id() OR id = get_current_company_id());

-- Special case: corevia_companies uses id as identifier, NOT company_id
ALTER TABLE corevia_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_select_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_insert_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_update_corevia_companies" ON corevia_companies;
DROP POLICY IF EXISTS "rls_delete_corevia_companies" ON corevia_companies;

CREATE POLICY "rls_select_corevia_companies" ON corevia_companies
  FOR SELECT USING (is_super_admin() OR id = get_current_company_id());
CREATE POLICY "rls_insert_corevia_companies" ON corevia_companies
  FOR INSERT WITH CHECK (is_super_admin() OR id = get_current_company_id());
CREATE POLICY "rls_update_corevia_companies" ON corevia_companies
  FOR UPDATE USING (is_super_admin() OR id = get_current_company_id());
CREATE POLICY "rls_delete_corevia_companies" ON corevia_companies
  FOR DELETE USING (is_super_admin() OR id = get_current_company_id());

-- Special case: corevia_admin_audit_logs allows all inserts (from triggers)
DROP POLICY IF EXISTS "rls_insert_corevia_admin_audit_logs" ON corevia_admin_audit_logs;
CREATE POLICY "rls_insert_corevia_admin_audit_logs" ON corevia_admin_audit_logs
  FOR INSERT WITH CHECK (true);

-- Special case: subscription_reminders and subscription_logs updates/deletes restricted to super_admin
DROP POLICY IF EXISTS "rls_update_corevia_subscription_logs" ON corevia_subscription_logs;
DROP POLICY IF EXISTS "rls_delete_corevia_subscription_logs" ON corevia_subscription_logs;
DROP POLICY IF EXISTS "rls_update_corevia_subscription_reminders" ON corevia_subscription_reminders;
DROP POLICY IF EXISTS "rls_delete_corevia_subscription_reminders" ON corevia_subscription_reminders;
DROP POLICY IF EXISTS "rls_update_corevia_admin_audit_logs" ON corevia_admin_audit_logs;
DROP POLICY IF EXISTS "rls_delete_corevia_admin_audit_logs" ON corevia_admin_audit_logs;

CREATE POLICY "rls_update_corevia_subscription_logs" ON corevia_subscription_logs
  FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_subscription_logs" ON corevia_subscription_logs
  FOR DELETE USING (is_super_admin());
CREATE POLICY "rls_update_corevia_subscription_reminders" ON corevia_subscription_reminders
  FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_subscription_reminders" ON corevia_subscription_reminders
  FOR DELETE USING (is_super_admin());
CREATE POLICY "rls_update_corevia_admin_audit_logs" ON corevia_admin_audit_logs
  FOR UPDATE USING (is_super_admin());
CREATE POLICY "rls_delete_corevia_admin_audit_logs" ON corevia_admin_audit_logs
  FOR DELETE USING (is_super_admin());

-- Special case: corevia_saas_users needs user_id = auth.uid() self-read
DROP POLICY IF EXISTS "rls_select_corevia_saas_users" ON corevia_saas_users;
DROP POLICY IF EXISTS "rls_update_corevia_saas_users" ON corevia_saas_users;

CREATE POLICY "rls_select_corevia_saas_users" ON corevia_saas_users
  FOR SELECT USING (
    is_super_admin()
    OR company_id = get_current_company_id()
    OR user_id = auth.uid()::TEXT
  );

CREATE POLICY "rls_update_corevia_saas_users" ON corevia_saas_users
  FOR UPDATE USING (
    is_super_admin()
    OR company_id = get_current_company_id()
    OR user_id = auth.uid()::TEXT
  );

-- Special case: corevia_activity_logs allows all inserts (from application triggers)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_activity_logs'
  ) THEN
    DROP POLICY IF EXISTS "rls_insert_corevia_activity_logs" ON corevia_activity_logs;
    CREATE POLICY "rls_insert_corevia_activity_logs" ON corevia_activity_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

-- Special case: subscription tables allow company-scoped SELECT/INSERT; UPDATE/DELETE restricted to super_admin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corevia_subscriptions') THEN
    DROP POLICY IF EXISTS "rls_update_corevia_subscriptions" ON corevia_subscriptions;
    DROP POLICY IF EXISTS "rls_delete_corevia_subscriptions" ON corevia_subscriptions;
    CREATE POLICY "rls_update_corevia_subscriptions" ON corevia_subscriptions
      FOR UPDATE USING (is_super_admin());
    CREATE POLICY "rls_delete_corevia_subscriptions" ON corevia_subscriptions
      FOR DELETE USING (is_super_admin());
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corevia_subscription_history') THEN
    DROP POLICY IF EXISTS "rls_update_corevia_subscription_history" ON corevia_subscription_history;
    DROP POLICY IF EXISTS "rls_delete_corevia_subscription_history" ON corevia_subscription_history;
    CREATE POLICY "rls_update_corevia_subscription_history" ON corevia_subscription_history
      FOR UPDATE USING (is_super_admin());
    CREATE POLICY "rls_delete_corevia_subscription_history" ON corevia_subscription_history
      FOR DELETE USING (is_super_admin());
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corevia_subscription_notifications') THEN
    DROP POLICY IF EXISTS "rls_update_corevia_subscription_notifications" ON corevia_subscription_notifications;
    DROP POLICY IF EXISTS "rls_delete_corevia_subscription_notifications" ON corevia_subscription_notifications;
    CREATE POLICY "rls_update_corevia_subscription_notifications" ON corevia_subscription_notifications
      FOR UPDATE USING (is_super_admin());
    CREATE POLICY "rls_delete_corevia_subscription_notifications" ON corevia_subscription_notifications
      FOR DELETE USING (is_super_admin());
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corevia_company_seat_management') THEN
    DROP POLICY IF EXISTS "rls_update_corevia_company_seat_management" ON corevia_company_seat_management;
    DROP POLICY IF EXISTS "rls_delete_corevia_company_seat_management" ON corevia_company_seat_management;
    CREATE POLICY "rls_update_corevia_company_seat_management" ON corevia_company_seat_management
      FOR UPDATE USING (is_super_admin());
    CREATE POLICY "rls_delete_corevia_company_seat_management" ON corevia_company_seat_management
      FOR DELETE USING (is_super_admin());
  END IF;
END;
$$;

-- PART 11: FORCE ROW LEVEL SECURITY ON ALL TENANT-SCOPED TABLES
-- FORCE RLS ensures even table owners cannot bypass tenant isolation.
-- Superusers (postgres) and roles with BYPASSRLS (service_role) still bypass,
-- so admin/background operations are unaffected.
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- corevia_companies included: FORCE RLS is safe here (no column references)
    'corevia_companies',
    'corevia_company_users',
    'corevia_orders',
    'corevia_products',
    'corevia_suppliers',
    'corevia_workers',
    'corevia_salary_sheets',
    'corevia_inventory_basic',
    'corevia_inventory_sub',
    'corevia_inventory_return',
    'corevia_stock_movements',
    'corevia_employee_submissions',
    'corevia_chat_messages',
    'corevia_company_notifications',
    'corevia_expenses',
    'corevia_profile',
    'corevia_saas_users',
    'corevia_activity_logs',
    'corevia_subscriptions',
    'corevia_subscription_history',
    'corevia_subscription_notifications',
    'corevia_company_seat_management',
    'corevia_subscription_logs',
    'corevia_subscription_reminders',
    'corevia_admin_audit_logs',
    'corevia_activity_center'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END;
$$;

-- PART 12: PERFORMANCE INDEXES

-- corevia_orders
CREATE INDEX IF NOT EXISTS idx_orders_company_date ON corevia_orders(company_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON corevia_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_agent ON corevia_orders(agent_name);
CREATE INDEX IF NOT EXISTS idx_orders_source ON corevia_orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_deleted ON corevia_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON corevia_orders(customer_name);

-- corevia_products
CREATE INDEX IF NOT EXISTS idx_products_company ON corevia_products(company_id, name);

-- corevia_suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON corevia_suppliers(company_id, name);

-- corevia_workers
CREATE INDEX IF NOT EXISTS idx_workers_company ON corevia_workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_code ON corevia_workers(code);

-- corevia_salary_sheets
CREATE INDEX IF NOT EXISTS idx_salary_company ON corevia_salary_sheets(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_worker ON corevia_salary_sheets(worker_id);
CREATE INDEX IF NOT EXISTS idx_salary_month ON corevia_salary_sheets(month_year);

-- corevia_expenses
CREATE INDEX IF NOT EXISTS idx_expenses_company ON corevia_expenses(company_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON corevia_expenses(type);

-- corevia_employee_submissions
CREATE INDEX IF NOT EXISTS idx_emp_submissions_company ON corevia_employee_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_submissions_employee ON corevia_employee_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_submissions_status ON corevia_employee_submissions(status);

-- corevia_chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_company ON corevia_chat_messages(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON corevia_chat_messages(sender_id);

-- corevia_profile
CREATE INDEX IF NOT EXISTS idx_profile_company ON corevia_profile(company_id);

-- corevia_saas_users
CREATE INDEX IF NOT EXISTS idx_saas_users_company ON corevia_saas_users(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_users_email ON corevia_saas_users(email);
CREATE INDEX IF NOT EXISTS idx_saas_users_role ON corevia_saas_users(role);

-- corevia_activity_logs (table may not exist — created by app at runtime)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_activity_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON corevia_activity_logs(company_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON corevia_activity_logs(actor_name);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON corevia_activity_logs(created_at DESC);
  END IF;
END;
$$;

-- corevia_subscriptions (may not exist — created by fix_schema.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_subscriptions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON corevia_subscriptions(company_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON corevia_subscriptions(end_date);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON corevia_subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_name ON corevia_subscriptions(plan_name);
  END IF;
END;
$$;

-- corevia_subscription_history (may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_subscription_history'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sub_history_company_id ON corevia_subscription_history(company_id);
    CREATE INDEX IF NOT EXISTS idx_sub_history_renewal_date ON corevia_subscription_history(renewal_date);
    CREATE INDEX IF NOT EXISTS idx_sub_history_created_at ON corevia_subscription_history(created_at);
  END IF;
END;
$$;

-- corevia_subscription_notifications (may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_subscription_notifications'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sub_notif_company_id ON corevia_subscription_notifications(company_id);
    CREATE INDEX IF NOT EXISTS idx_sub_notif_days_before ON corevia_subscription_notifications(days_before);
    CREATE INDEX IF NOT EXISTS idx_sub_notif_acknowledged ON corevia_subscription_notifications(acknowledged);
  END IF;
END;
$$;

-- corevia_company_seat_management (may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corevia_company_seat_management'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_seat_mgmt_company_id ON corevia_company_seat_management(company_id);
    CREATE INDEX IF NOT EXISTS idx_seat_mgmt_available ON corevia_company_seat_management(available_seats);
  END IF;
END;
$$;

-- corevia_company_notifications
CREATE INDEX IF NOT EXISTS idx_company_notifs_read_company ON corevia_company_notifications(company_id, read);
CREATE INDEX IF NOT EXISTS idx_company_notifs_created ON corevia_company_notifications(created_at);

-- corevia_subscription_logs
CREATE INDEX IF NOT EXISTS idx_sub_logs_action ON corevia_subscription_logs(company_id, created_at);

-- corevia_subscription_reminders
CREATE INDEX IF NOT EXISTS idx_sub_reminders_sent ON corevia_subscription_reminders(company_id, sent);

-- corevia_admin_audit_logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON corevia_admin_audit_logs(created_at DESC);

COMMIT;

-- Grant function execute to anon role (required for RLS policies with SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION get_current_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon, authenticated;

-- VERIFICATION QUERIES (run after migration)
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'corevia_companies' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'corevia_company_users' ORDER BY ordinal_position;
--
-- SELECT conname, conrelid::regclass AS table_name, contype
-- FROM pg_constraint WHERE contype IN ('f', 'c') ORDER BY conname;
--
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname FROM pg_policies ORDER BY tablename, policyname;

-- =====================================================
-- Subscription & Seat Management System
-- Tables, Indexes, and Performance Optimizations
-- =====================================================

-- 1. corevia_subscriptions
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
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_name ON corevia_subscriptions(plan_name);

-- 2. corevia_subscription_history (never deleted)
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
CREATE INDEX IF NOT EXISTS idx_sub_history_renewal_date ON corevia_subscription_history(renewal_date);
CREATE INDEX IF NOT EXISTS idx_sub_history_created_at ON corevia_subscription_history(created_at);

-- 3. corevia_subscription_notifications
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
CREATE INDEX IF NOT EXISTS idx_sub_notif_days_before ON corevia_subscription_notifications(days_before);
CREATE INDEX IF NOT EXISTS idx_sub_notif_acknowledged ON corevia_subscription_notifications(acknowledged);

-- 4. corevia_company_seat_management
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
CREATE INDEX IF NOT EXISTS idx_seat_mgmt_available ON corevia_company_seat_management(available_seats);

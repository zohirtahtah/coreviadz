-- ============================================================
-- Corevia ERP v2 — Support System Tables
-- Run AFTER supabase-migration-v2.sql has been executed.
-- ============================================================

-- ============================================================
-- TABLE: corevia_system_settings (Super Admin contact info)
-- Singleton row storing dynamic support contact details
-- ============================================================
CREATE TABLE IF NOT EXISTS corevia_system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_phone TEXT NOT NULL DEFAULT '+213 XX XX XX XX',
  admin_email TEXT NOT NULL DEFAULT 'admin@corevia.com',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default row if table is empty
INSERT INTO corevia_system_settings (admin_phone, admin_email)
SELECT '+213 555 123 456', 'support@corevia.com'
WHERE NOT EXISTS (SELECT 1 FROM corevia_system_settings);

-- ============================================================
-- TABLE: corevia_support_tickets (User support requests)
-- Each ticket can trigger a colored notification dot for Super Admin
-- ============================================================
CREATE TABLE IF NOT EXISTS corevia_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  company_id TEXT,
  message_content TEXT NOT NULL,
  has_new_admin_alert BOOLEAN DEFAULT TRUE,
  is_resolved BOOLEAN DEFAULT FALSE,
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE corevia_system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE corevia_support_tickets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS: Anyone can read system_settings (public contact info)
-- ============================================================
DROP POLICY IF EXISTS public_read ON corevia_system_settings;
CREATE POLICY public_read ON corevia_system_settings
  FOR SELECT USING (true);

-- Allow Super Admin to update system_settings
DROP POLICY IF EXISTS super_admin_update ON corevia_system_settings;
CREATE POLICY super_admin_update ON corevia_system_settings
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- RLS: Authenticated users can insert tickets
-- Super Admin can read all tickets
-- ============================================================
DROP POLICY IF EXISTS insert_tickets ON corevia_support_tickets;
CREATE POLICY insert_tickets ON corevia_support_tickets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS read_tickets ON corevia_support_tickets;
CREATE POLICY read_tickets ON corevia_support_tickets
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- ============================================================
-- RPC: Get unread support tickets count (for Super Admin badge)
-- ============================================================
CREATE OR REPLACE FUNCTION get_unread_ticket_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM corevia_support_tickets
  WHERE has_new_admin_alert = TRUE;
  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: Mark ticket as read (clear admin alert)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_ticket_read(p_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE corevia_support_tickets
  SET has_new_admin_alert = FALSE
  WHERE id = p_ticket_id;
END;
$$;

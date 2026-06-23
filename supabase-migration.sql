-- Corevia ERP - Supabase Migration
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Create corevia_profile table for storing business profile settings
CREATE TABLE IF NOT EXISTS corevia_profile (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  business_name TEXT NOT NULL,
  business_type TEXT,
  currency TEXT DEFAULT 'DZD',
  country TEXT DEFAULT 'Algeria',
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  commercial_registry TEXT,
  tax_number TEXT,
  rc1 TEXT,
  rc2 TEXT,
  nif TEXT,
  logo_url TEXT,
  passcode TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE corevia_profile ENABLE ROW LEVEL SECURITY;

-- Create policy for company isolation
DROP POLICY IF EXISTS "Company isolation" ON corevia_profile;
CREATE POLICY "Company isolation" ON corevia_profile
  USING (company_id = current_setting('app.current_company_id', TRUE) OR company_id IS NULL);

-- Grant access to authenticated users
DROP POLICY IF EXISTS "Authenticated users can read" ON corevia_profile;
CREATE POLICY "Authenticated users can read" ON corevia_profile
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert" ON corevia_profile;
CREATE POLICY "Authenticated users can insert" ON corevia_profile
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update" ON corevia_profile;
CREATE POLICY "Authenticated users can update" ON corevia_profile
  FOR UPDATE USING (auth.role() = 'authenticated');

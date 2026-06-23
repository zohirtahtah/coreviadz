-- Corevia ERP v6 — last_backup_at column
-- Run AFTER supabase-migration-v5.sql has been executed.

-- Track when the last successful backup was downloaded
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

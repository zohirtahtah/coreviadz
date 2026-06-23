-- ============================================================
-- Corevia ERP v4 — Backup Reminder Columns
-- Run AFTER supabase-migration-v3.sql has been executed.
-- ============================================================

-- Add backup reminder schedule columns to corevia_companies
ALTER TABLE corevia_companies
  ADD COLUMN IF NOT EXISTS backup_reminder_day TEXT DEFAULT 'Thursday',
  ADD COLUMN IF NOT EXISTS backup_reminder_time TEXT DEFAULT '16:00';

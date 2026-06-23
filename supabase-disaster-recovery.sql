-- ============================================================
-- Corevia ERP — Disaster Recovery System
-- Run AFTER all v1–v6 migrations have been executed.
-- ============================================================
-- NOTE: pg_cron extension requires at least Supabase Team plan.
-- On Free / Pro plans, skip the cron.schedule() call and
-- use the Supabase Dashboard > Edge Functions or an external
-- scheduler (e.g. GitHub Actions, cron-job.org) to invoke
-- CALL generate_daily_disaster_snapshot(); once per day.
-- ============================================================

-- 1. Enable pg_cron scheduling extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 2. Disaster Recovery Backup Archive Table
-- Stores isolated per-company, per-table JSON snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS corevia_disaster_recovery_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    dumped_data JSONB NOT NULL,
    row_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dr_company ON corevia_disaster_recovery_backups (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_cleanup ON corevia_disaster_recovery_backups (created_at);

-- ============================================================
-- 3. Daily Disaster Snapshot Procedure
-- Captures all corevia_ tables per-company into the archive
-- ============================================================
CREATE OR REPLACE PROCEDURE generate_daily_disaster_snapshot()
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    snap_data JSONB;
    snap_count INTEGER;
BEGIN
    -- Loop through all corevia_ tables that have company_id
    FOR rec IN
        SELECT table_name::text
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'company_id'
          AND table_name LIKE 'corevia_%'
          AND table_name <> 'corevia_disaster_recovery_backups'
        GROUP BY table_name
    LOOP
        -- Snapshot each company's data for this table
        FOR snap_data, snap_count IN
            EXECUTE format(
                'SELECT jsonb_agg(t) FILTER (WHERE t IS NOT NULL), COALESCE(count(*), 0)::int FROM %I t GROUP BY t.company_id',
                rec.table_name
            )
        LOOP
            IF snap_data IS NOT NULL THEN
                -- Get the company_id from the first element
                INSERT INTO corevia_disaster_recovery_backups (company_id, table_name, dumped_data, row_count)
                SELECT
                    (snap_data->0)->>'company_id',
                    rec.table_name,
                    snap_data,
                    snap_count;
            END IF;
        END LOOP;
    END LOOP;

    -- 4. Auto-purge backups older than 90 days
    DELETE FROM corevia_disaster_recovery_backups
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ============================================================
-- 5. Schedule the job daily at midnight (00:00)
-- Requires pg_cron extension (Team plan+ on Supabase)
-- ============================================================
SELECT cron.schedule(
    'corevia_daily_disaster_backup',
    '0 0 * * *',
    'CALL generate_daily_disaster_snapshot();'
);

-- ============================================================
-- 6. Super Admin Single-Company Restore Function
-- Restores ONE company's data from a specific backup date
-- without affecting any other tenants.
-- ============================================================
CREATE OR REPLACE FUNCTION super_admin_restore_single_company(
    target_company_id TEXT,
    target_backup_date DATE
)
RETURNS TABLE (restored_table TEXT, restored_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    rec RECORD;
    tbl_name TEXT;
    inserted_count INTEGER;
    total_restored INTEGER := 0;
    failed_tables TEXT[] := '{}';
BEGIN
    -- Loop through each table snapshot available for this company on the target date
    FOR rec IN
        SELECT table_name, dumped_data
        FROM corevia_disaster_recovery_backups
        WHERE company_id = target_company_id
          AND created_at::date = target_backup_date
        ORDER BY table_name
    LOOP
        tbl_name := rec.table_name;

        -- Clear existing data for THIS company only
        EXECUTE format('DELETE FROM %I WHERE company_id = $1', tbl_name) USING target_company_id;

        -- Restore from the archived JSON
        EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(NULL::%I, $1)',
            tbl_name, tbl_name
        ) INTO inserted_count USING rec.dumped_data;

        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        total_restored := total_restored + inserted_count;
        restored_rows := inserted_count;
        restored_table := tbl_name;
        RETURN NEXT;
    END LOOP;

    -- Log the restore action
    INSERT INTO corevia_activity_center (company_id, user_name, action_type, page_name, details, created_at)
    VALUES (
        target_company_id,
        'Super Admin',
        'DISASTER_RECOVERY_RESTORE',
        'Disaster Recovery',
        format('Super Admin restored company %s from backup dated %s. Tables restored: %s',
               target_company_id, target_backup_date, total_restored),
        NOW()
    );
END;
$$;

-- Grant execution to authenticated users (checked by app super_admin gate)
GRANT EXECUTE ON FUNCTION super_admin_restore_single_company TO authenticated;

-- ============================================================
-- 7. Manual Snapshot Trigger (for immediate ad-hoc backup)
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_manual_disaster_snapshot()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    CALL generate_daily_disaster_snapshot();
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_manual_disaster_snapshot TO authenticated;

-- ============================================================
-- 8. Helper: List available backup dates for a company
-- ============================================================
CREATE OR REPLACE FUNCTION get_company_backup_dates(target_company_id TEXT)
RETURNS TABLE (backup_date DATE, table_count INTEGER, total_rows BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        created_at::date AS backup_date,
        COUNT(DISTINCT table_name)::int AS table_count,
        SUM(row_count)::bigint AS total_rows
    FROM corevia_disaster_recovery_backups
    WHERE company_id = target_company_id
    GROUP BY created_at::date
    ORDER BY created_at::date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_backup_dates TO authenticated;

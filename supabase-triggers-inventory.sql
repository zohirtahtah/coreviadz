-- ============================================================
-- Corevia ERP v2 — Database Triggers for Automated Inventory
-- Automatically updates inventory quantities when invoices
-- are created, preventing manual errors (0% error policy).
-- Run AFTER supabase-migration-v2.sql has been executed.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: apply_inventory_change()
-- Shared logic used by INSERT and RESTORE triggers.
-- Maps invoice target_table to the correct corevia_inventory_* table:
--   'table_1' → corevia_inventory_basic  (no size tracking)
--   'table_2' → corevia_inventory_sub    (size tracking)
--   'table_3' → corevia_inventory_return (returned items)
-- ============================================================
CREATE OR REPLACE FUNCTION apply_inventory_change(
  p_company_id    TEXT,
  p_target_table  TEXT,
  p_invoice_type  TEXT,
  p_product_sku   TEXT,
  p_quantity      INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ============================================================
  -- TARGET TABLE 1 — corevia_inventory_basic
  -- ============================================================
  IF p_target_table = 'table_1' THEN
    IF p_invoice_type = 'purchase' THEN
      UPDATE corevia_inventory_basic
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_basic (id, company_id, product_id, product_name, sku, quantity, updated_at)
        VALUES ('inv-' || gen_random_uuid()::text, p_company_id, 'sku-' || p_product_sku, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    ELSIF p_invoice_type = 'sale' THEN
      UPDATE corevia_inventory_basic
      SET quantity = GREATEST(quantity - p_quantity, 0), updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
    ELSIF p_invoice_type = 'return' THEN
      UPDATE corevia_inventory_basic
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_basic (id, company_id, product_id, product_name, sku, quantity, updated_at)
        VALUES ('inv-' || gen_random_uuid()::text, p_company_id, 'sku-' || p_product_sku, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    END IF;

  -- ============================================================
  -- TARGET TABLE 2 — corevia_inventory_sub
  -- ============================================================
  ELSIF p_target_table = 'table_2' THEN
    IF p_invoice_type = 'purchase' THEN
      UPDATE corevia_inventory_sub
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_sub (id, company_id, product_id, product_name, sku, quantity, updated_at)
        VALUES ('sub-' || gen_random_uuid()::text, p_company_id, 'sku-' || p_product_sku, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    ELSIF p_invoice_type = 'sale' THEN
      UPDATE corevia_inventory_sub
      SET quantity = GREATEST(quantity - p_quantity, 0), updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
    ELSIF p_invoice_type = 'return' THEN
      UPDATE corevia_inventory_sub
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_sub (id, company_id, product_id, product_name, sku, quantity, updated_at)
        VALUES ('sub-' || gen_random_uuid()::text, p_company_id, 'sku-' || p_product_sku, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    END IF;

  -- ============================================================
  -- TARGET TABLE 3 — corevia_inventory_return
  -- ============================================================
  ELSIF p_target_table = 'table_3' THEN
    IF p_invoice_type = 'purchase' THEN
      UPDATE corevia_inventory_return
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_return (id, company_id, product_name, sku, quantity, updated_at)
        VALUES ('ret-' || gen_random_uuid()::text, p_company_id, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    ELSIF p_invoice_type = 'sale' THEN
      UPDATE corevia_inventory_return
      SET quantity = GREATEST(quantity - p_quantity, 0), updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
    ELSIF p_invoice_type = 'return' THEN
      UPDATE corevia_inventory_return
      SET quantity = quantity + p_quantity, updated_at = NOW()
      WHERE sku = p_product_sku AND company_id = p_company_id;
      IF NOT FOUND THEN
        INSERT INTO corevia_inventory_return (id, company_id, product_name, sku, quantity, updated_at)
        VALUES ('ret-' || gen_random_uuid()::text, p_company_id, p_product_sku, p_product_sku, p_quantity, NOW());
      END IF;
    END IF;
  END IF;

  -- Log stock movement
  INSERT INTO corevia_stock_movements (id, company_id, order_id, product_name, quantity_change, movement_type, source)
  VALUES (
    'sm-' || gen_random_uuid()::text,
    p_company_id,
    NULL,
    p_product_sku,
    CASE WHEN p_invoice_type = 'sale' THEN -p_quantity ELSE p_quantity END,
    p_invoice_type,
    'invoice_trigger'
  );
END;
$$;

-- ============================================================
-- TRIGGER FUNCTION: process_inventory_update()
-- Called AFTER INSERT on corevia_invoices
-- ============================================================
CREATE OR REPLACE FUNCTION process_inventory_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_deleted = TRUE THEN
    RETURN NEW;
  END IF;

  PERFORM apply_inventory_change(
    NEW.company_id,
    NEW.target_table,
    NEW.invoice_type,
    NEW.product_sku,
    NEW.quantity
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGER: trigger_invoice_inventory_sync
-- Fires AFTER INSERT on corevia_invoices
-- ============================================================
DROP TRIGGER IF EXISTS trigger_invoice_inventory_sync ON corevia_invoices;
CREATE TRIGGER trigger_invoice_inventory_sync
AFTER INSERT ON corevia_invoices
FOR EACH ROW
EXECUTE FUNCTION process_inventory_update();

-- ============================================================
-- TRIGGER FUNCTION: process_inventory_restore()
-- Called when is_deleted changes from TRUE to FALSE (restore)
-- ============================================================
CREATE OR REPLACE FUNCTION process_inventory_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM apply_inventory_change(
    NEW.company_id,
    NEW.target_table,
    NEW.invoice_type,
    NEW.product_sku,
    NEW.quantity
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_restore ON corevia_invoices;
CREATE TRIGGER trigger_inventory_restore
AFTER UPDATE OF is_deleted ON corevia_invoices
FOR EACH ROW
WHEN (OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE)
EXECUTE FUNCTION process_inventory_restore();

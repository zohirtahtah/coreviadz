-- Corevia ERP — Database Triggers for Automated Inventory
-- Updates corevia_inventory.quantity when invoices are created/restored.
-- Run AFTER supabase-migration-v2.sql has been executed.

-- HELPER: apply inventory change for a single corevia_inventory table
CREATE OR REPLACE FUNCTION apply_inventory_change(
  p_company_id    TEXT,
  p_invoice_type  TEXT,
  p_product_sku   TEXT,
  p_quantity      INTEGER,
  p_invoice_id    TEXT,
  p_created_by    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_name TEXT;
  v_product_id   TEXT;
BEGIN
  -- Try to find existing inventory record by sku
  SELECT id, COALESCE(product_name, '') INTO v_product_id, v_product_name
  FROM corevia_inventory
  WHERE company_id = p_company_id AND sku = p_product_sku
  LIMIT 1;

  IF NOT FOUND THEN
    -- Create new inventory record
    INSERT INTO corevia_inventory (id, company_id, product_id, product_name, sku, quantity)
    VALUES (
      'inv-' || gen_random_uuid()::text,
      p_company_id,
      'sku-' || p_product_sku,
      p_product_sku,
      p_product_sku,
      0
    )
    RETURNING id, COALESCE(product_name, '') INTO v_product_id, v_product_name;
  END IF;

  -- Update quantity
  IF p_invoice_type = 'purchase' OR p_invoice_type = 'return' THEN
    UPDATE corevia_inventory
    SET quantity = quantity + p_quantity, updated_at = NOW()
    WHERE id = v_product_id;
  ELSIF p_invoice_type = 'sale' THEN
    UPDATE corevia_inventory
    SET quantity = GREATEST(quantity - p_quantity, 0), updated_at = NOW()
    WHERE id = v_product_id;
  END IF;

  -- Log stock movement
  INSERT INTO corevia_stock_movements (id, company_id, product_id, product_name, movement_type, quantity, reason, reference_type, reference_id, created_by)
  VALUES (
    'sm-' || gen_random_uuid()::text,
    p_company_id,
    v_product_id,
    v_product_name,
    CASE WHEN p_invoice_type = 'sale' THEN 'sale' ELSE 'purchase' END,
    CASE WHEN p_invoice_type = 'sale' THEN -p_quantity ELSE p_quantity END,
    'invoice_trigger',
    'invoice',
    p_invoice_id,
    p_created_by
  );
END;
$$;

-- TRIGGER FUNCTION: called AFTER INSERT on corevia_invoices
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
    NEW.invoice_type,
    NEW.product_sku,
    NEW.quantity,
    NEW.id::text,
    NEW.created_by_name
  );

  RETURN NEW;
END;
$$;

-- TRIGGER: fires AFTER INSERT on corevia_invoices
DROP TRIGGER IF EXISTS trigger_invoice_inventory_sync ON corevia_invoices;
CREATE TRIGGER trigger_invoice_inventory_sync
AFTER INSERT ON corevia_invoices
FOR EACH ROW
EXECUTE FUNCTION process_inventory_update();

-- TRIGGER FUNCTION: called when is_deleted changes from TRUE to FALSE (restore)
CREATE OR REPLACE FUNCTION process_inventory_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM apply_inventory_change(
    NEW.company_id,
    NEW.invoice_type,
    NEW.product_sku,
    NEW.quantity,
    NEW.id::text,
    NEW.created_by_name
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

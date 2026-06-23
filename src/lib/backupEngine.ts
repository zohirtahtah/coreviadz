import { supabase } from "../supabaseClient";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const TABLES: { key: string; table: string; label: string }[] = [
  { key: "companies", table: "corevia_companies", label: "companies" },
  { key: "orders", table: "corevia_orders", label: "orders" },
  { key: "order_items", table: "corevia_order_items", label: "order_items" },
  { key: "products", table: "corevia_products", label: "products" },
  { key: "inventory", table: "corevia_inventory", label: "inventory" },
  { key: "suppliers", table: "corevia_suppliers", label: "suppliers" },
  { key: "expenses", table: "corevia_expenses", label: "expenses" },
  { key: "workers", table: "corevia_workers", label: "workers" },
  { key: "stock_movements", table: "corevia_stock_movements", label: "stock_movements" },
  { key: "activity_center", table: "corevia_activity_center", label: "activity_logs" },
  { key: "company_users", table: "corevia_company_users", label: "users" },
  { key: "chat_messages", table: "corevia_chat_messages", label: "chat_messages" },
  { key: "notifications", table: "corevia_notifications", label: "notifications" },
  { key: "profile", table: "corevia_profile", label: "settings" },
  { key: "saas_users", table: "corevia_saas_users", label: "saas_users" },
];

export async function generateCompanyBackup(
  companyId: string,
  companyName: string
): Promise<boolean> {
  try {
    const zip = new JSZip();
    const safeName = companyName.replace(/[^a-zA-Z0-9_]/g, "_");
    const folderName = `Backup_${safeName}_${new Date().toISOString().split("T")[0]}`;
    const backupFolder = zip.folder(folderName);
    if (!backupFolder) return false;

    const results: Record<string, { status: string; count: number }> = {};

    for (const t of TABLES) {
      try {
        const { data, error } = await supabase
          .from(t.table)
          .select("*")
          .eq("company_id", companyId);

        if (error) {
          results[t.key] = { status: `ERROR: ${error.message}`, count: 0 };
          backupFolder.file(`${t.label}.json`, JSON.stringify({ error: error.message }, null, 2));
        } else {
          const count = data?.length ?? 0;
          results[t.key] = { status: "OK", count };
          backupFolder.file(`${t.label}.json`, JSON.stringify(data || [], null, 2));
        }
      } catch (err: any) {
        results[t.key] = { status: `FAIL: ${err?.message || err}`, count: 0 };
        backupFolder.file(`${t.label}.json`, JSON.stringify({ error: err?.message || "Unknown" }, null, 2));
      }
    }

    // Write metadata file
    backupFolder.file(
      "metadata.json",
      JSON.stringify(
        {
          version: "1.0",
          company: companyName,
          companyId,
          exportedAt: new Date().toISOString(),
          tables: results,
        },
        null,
        2
      )
    );

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${folderName}.zip`);

    // Log the backup action to activity center AND update last_backup_at
    try {
      if (supabase) {
        await supabase.from("corevia_activity_center").insert({
          company_id: companyId,
          user_name: "System",
          action_type: "DOWNLOAD_BACKUP",
          page_name: "Backup",
          details: `تم تحميل نسخة احتياطية كاملة (ZIP) لجميع جداول الشركة`,
          created_at: new Date().toISOString(),
        });

        // Update last_backup_at timestamp for missed-backup detection
        await supabase
          .from("corevia_companies")
          .update({ last_backup_at: new Date().toISOString() })
          .eq("id", companyId);
      }
    } catch {
      // silent
    }

    return true;
  } catch (error) {
    console.error("Backup failed:", error);
    return false;
  }
}

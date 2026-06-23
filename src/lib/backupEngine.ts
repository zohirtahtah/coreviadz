import { supabase } from "../supabaseClient";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const TABLES: { key: string; table: string; label: string }[] = [
  { key: "orders", table: "corevia_orders", label: "الطلبيات_والمبيعات" },
  { key: "order_items", table: "corevia_order_items", label: "بنود_الطلبيات" },
  { key: "products", table: "corevia_products", label: "المنتجات_والطرازات" },
  { key: "inventory", table: "corevia_inventory", label: "المخزون_الرئيسي" },
  { key: "suppliers", table: "corevia_suppliers", label: "الموردون_والفواتير" },
  { key: "expenses", table: "corevia_expenses", label: "المصروفات" },
  { key: "workers", table: "corevia_workers", label: "العمال_والموظفون" },
  { key: "stock_movements", table: "corevia_stock_movements", label: "حركة_المخزون" },
  { key: "activity_center", table: "corevia_activity_center", label: "سجل_العمليات" },
  { key: "company_users", table: "corevia_company_users", label: "المستخدمون_والصلاحيات" },
  { key: "chat_messages", table: "corevia_chat_messages", label: "المراسلات_الداخلية" },
  { key: "notifications", table: "corevia_notifications", label: "الإشعارات_الداخلية" },
  { key: "profile", table: "corevia_profile", label: "الملف_التجاري" },
  { key: "saas_users", table: "corevia_saas_users", label: "حسابات_المدراء_العامة" },
];

function toCSV(data: any[]): string {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const esc = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...data.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

export async function generateCompanyBackup(
  companyId: string,
  companyName: string
): Promise<boolean> {
  try {
    const zip = new JSZip();
    const safeName = companyName.replace(/[^a-zA-Z0-9_\u0621-\u064A]/g, "_");
    const folderName = `Backup_${safeName}_${new Date().toISOString().split("T")[0]}`;
    const backupFolder = zip.folder(folderName);
    if (!backupFolder) return false;

    const results: Record<string, string> = {};

    for (const t of TABLES) {
      try {
        const { data, error } = await supabase
          .from(t.table)
          .select("*")
          .eq("company_id", companyId);

        if (error) {
          results[t.key] = `ERROR: ${error.message}`;
          backupFolder.file(`${t.label}.csv`, `ERROR,${error.message}`);
        } else {
          results[t.key] = `OK: ${data?.length ?? 0} rows`;
          backupFolder.file(`${t.label}.csv`, toCSV(data || []));
        }
      } catch (err: any) {
        results[t.key] = `FAIL: ${err?.message || err}`;
        backupFolder.file(`${t.label}.csv`, `ERROR,${err?.message || "Unknown"}`);
      }
    }

    // Write a manifest file
    backupFolder.file(
      "بيان_النسخ.json",
      JSON.stringify(
        {
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

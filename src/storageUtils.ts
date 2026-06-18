// COREVIA UI PREFERENCES STORAGE
// localStorage is used ONLY for non-critical UI preferences.
// All business data (workers, orders, products, inventory, etc.)
// is accessed via the API service layer and Supabase directly.

const THEME_KEY = "corevia_theme_v1";
const LANGUAGE_KEY = "corevia_language_v1";
const SIDEBAR_KEY = "corevia_sidebar_v1";

// Theme
export function getTheme(): "light" | "dark" {
  try {
    const val = localStorage.getItem(THEME_KEY);
    if (val === "dark" || val === "light") return val;
    return "light";
  } catch { return "light"; }
}

export function saveTheme(theme: "light" | "dark"): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

// Language
export function getLanguage(): string {
  try { return localStorage.getItem(LANGUAGE_KEY) || "fr"; } catch { return "fr"; }
}

export function saveLanguage(lang: string): void {
  try { localStorage.setItem(LANGUAGE_KEY, lang); } catch {}
}

// Sidebar
export function getSidebarCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch {}
}

// Clear all UI preferences (not for business data cleanup)
export function clearPreferences(): void {
  try {
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(LANGUAGE_KEY);
    localStorage.removeItem(SIDEBAR_KEY);
  } catch {}
}

// ============================================================
// TRANSITIONAL STUBS — legacy functions kept for backward compatibility.
// Business data now lives in Supabase via apiService.ts.
// These stubs return empty arrays / no-op to prevent breakage
// while components migrate to the new API service.
// ============================================================

export function getBusinessProfile(): any {
  try {
    const raw = localStorage.getItem("corevia_profile_v1");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
export function saveBusinessProfile(p: any): void {
  try { localStorage.setItem("corevia_profile_v1", JSON.stringify(p)); } catch {}
}
export function getUserSession(): any { return null; }
export function saveUserSession(s: any): void {}
export function getOrders(): any[] { return []; }
export function saveOrders(o: any[]): void {}
export function getProducts(): any[] { return []; }
export function saveProducts(p: any[]): void {}
export function getBasicInventory(): any[] { return []; }
export function saveBasicInventory(i: any[]): void {}
export function getSubInventory(): any[] { return []; }
export function saveSubInventory(i: any[]): void {}
export function getReturnInventory(): any[] { return []; }
export function saveReturnInventory(i: any[]): void {}
export function getSuppliers(): any[] { return []; }
export function saveSuppliers(s: any[]): void {}
export function getSupplierInvoices(): any[] { return []; }
export function saveSupplierInvoices(i: any[]): void {}
export function getWorkers(): any[] { return []; }
export function saveWorkers(w: any[]): void {}
export function getTrashItems(): any[] { return []; }
export function saveTrashItems(t: any[]): void {}
export function initializeDatabase(overwrite: boolean, profile?: any): void {}
export function deleteOrderSoft(id: string): void {}
export function deleteInvoiceSoft(id: string): void {}
export function deleteWorkerSoft(id: string): void {}
export function deleteProductSoft(id: string): void {}
export function deleteEntireWorkerProfileSoft(code: string): void {}
export function restoreOrderSoft(data: any): void {}
export function restoreInvoiceSoft(data: any): void {}
export function restoreWorkerSoft(data: any): void {}
export function restoreProductSoft(data: any): void {}
export function getStockMovements(): any[] { return []; }
export function saveStockMovements(m: any[]): void {}
export function logStockMovement(m: any): void {}
export function mutateInventoryForNewOrder(...args: any[]): void {}
export function revertInventoryForOrder(...args: any[]): void {}
export function addOrderToReturnInventory(...args: any[]): void {}
export function removeOrderFromReturnInventory(...args: any[]): void {}
export function getAppSettings(): any { return {}; }
export function mutateInventoryForPurchase(...args: any[]): void {}
export function revertInventoryForPurchase(...args: any[]): void {}
export function getSalarySheets(): any[] { return []; }
export function saveSalarySheets(s: any[]): void {}
export function getFixedExpenses(): any[] { return []; }
export function saveFixedExpenses(e: any[]): void {}
export function getVarExpenses(): any[] { return []; }
export function saveVarExpenses(e: any[]): void {}
export function getAdExpenses(): any[] { return []; }
export function saveAdExpenses(e: any[]): void {}

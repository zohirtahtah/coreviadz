/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Order, Product, BasicInventoryItem, SubInventoryItem, ReturnInventoryItem,
  Supplier, SupplierInvoice, Worker, WorkerSalarySheet, FixedExpense, VariableExpense,
  AdExpense, TrashItem, AppSettings, BusinessProfile, UserSession, StockMovement
} from "./types";
import { defaultWilayas } from "./translations";

// ============================================================================
// HARD DATA ISOLATION: BULLETPROOF AUTOMATIC MULTI-TENANT LOCALSTORAGE ROUTER
// ============================================================================
function getActiveTenantSuffix(): string {
  try {
    const nativeGetItem = Storage.prototype.getItem;
    const sessionStr = nativeGetItem.call(window.localStorage, "corevia_session_v1");
    if (sessionStr) {
      const parsed = JSON.parse(sessionStr);
      if (parsed && parsed.email) {
        return "_" + parsed.email.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
      }
    }
  } catch (e) {
    // ignore
  }
  return "";
}

function resolveTenantKey(key: string): string {
  const globalKeys = [
    "corevia_session_v1",
    "corevia_user_session_v1",
    "corevia_saas_companies_v1",
    "corevia_saas_activity_logs_v1",
    "corevia_saas_security_config_v1",
    "corevia_clean_slate_marker_v16",
    "corevia_clean_slate_marker_v15"
  ];

  if (globalKeys.includes(key) || key.startsWith("corevia_clean_slate_") || key.startsWith("supabase.auth.")) {
    return key;
  }

  const suffix = getActiveTenantSuffix();
  if (suffix) {
    return `${key}${suffix}`;
  }
  return key;
}

try {
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;

  Storage.prototype.getItem = function(key: string): string | null {
    if (this === window.localStorage) {
      return nativeGetItem.call(this, resolveTenantKey(key));
    }
    return nativeGetItem.call(this, key);
  };

  Storage.prototype.setItem = function(key: string, value: string): void {
    if (this === window.localStorage) {
      nativeSetItem.call(this, resolveTenantKey(key), value);
    } else {
      nativeSetItem.call(this, key, value);
    }
  };

  Storage.prototype.removeItem = function(key: string): void {
    if (this === window.localStorage) {
      nativeRemoveItem.call(this, resolveTenantKey(key));
    } else {
      nativeRemoveItem.call(this, key);
    }
  };

  Storage.prototype.clear = function(): void {
    if (this === window.localStorage) {
      const suffix = getActiveTenantSuffix();
      const allKeys: string[] = [];
      for (let i = 0; i < this.length; i++) {
        const key = this.key(i);
        if (key) {
          allKeys.push(key);
        }
      }

      if (suffix) {
        const keysToRemove = allKeys.filter(k => k.endsWith(suffix));
        keysToRemove.forEach(k => nativeRemoveItem.call(this, k));
      } else {
        const globalKeys = [
          "corevia_session_v1",
          "corevia_user_session_v1",
          "corevia_saas_companies_v1",
          "corevia_saas_activity_logs_v1",
          "corevia_saas_security_config_v1"
        ];
        const keysToRemove = allKeys.filter(k => !globalKeys.includes(k) && !k.startsWith("supabase.auth."));
        keysToRemove.forEach(k => nativeRemoveItem.call(this, k));
      }
    } else {
      nativeClear.call(this);
    }
  };
} catch (e) {
  console.error("Failed to patch Storage prototype:", e);
}
const defaultColors = [
  "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
  "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)", "Beige (بيج الرمل)", "Olive (زيتوني)"
];

const defaultSettings: AppSettings = {
  passcode: "2026",
  isPasscodeEnabled: true,
  colors: defaultColors,
  wilayasList: defaultWilayas
};

// LocalStorage Keys
const KEYS = {
  PROFILE: "corevia_profile_v1",
  SESSION: "corevia_session_v1",
  ORDERS: "corevia_orders_v1",
  PRODUCTS: "corevia_products_v1",
  SUPPLIERS: "corevia_suppliers_v1",
  INVOICES: "corevia_invoices_v1",
  WORKERS: "corevia_workers_v1",
  SALARY_SHEETS: "corevia_salary_sheets_v1",
  FIXED_EXP: "corevia_fixed_exp_v1",
  VAR_EXP: "corevia_var_exp_v1",
  AD_EXP: "corevia_ad_exp_v1",
  TRASH: "corevia_trash_v1",
  SETTINGS: "corevia_settings_v1",
  INVENTORY_BASIC: "corevia_inv_basic_v1",
  INVENTORY_SUB: "corevia_inv_sub_v1",
  INVENTORY_RETURN: "corevia_inv_return_v1",
  STOCK_MOVEMENTS: "corevia_stock_movements_v1"
};

export function initializeDatabase(forceReset = false, customProfile?: BusinessProfile): void {
  const CLEAN_SLATE_MARKER = "corevia_clean_slate_marker_v16";
  const hasCleaned = localStorage.getItem(CLEAN_SLATE_MARKER);
  if (!hasCleaned || forceReset) {
    // Preserve critical employee, submission, auth session keys, and SaaS company cache before clear
    const preservedEmployees = localStorage.getItem("corevia_employees_list_v2");
    const preservedSubmissions = localStorage.getItem("corevia_employee_submissions_v2");
    const preservedSession1 = localStorage.getItem("corevia_session_v1");
    const preservedSession2 = localStorage.getItem("corevia_user_session_v1");
    const preservedActiveTab = localStorage.getItem("corevia_active_tab_v1");
    const preservedSaaSCompanies = localStorage.getItem("corevia_saas_companies_v1");

    // Purge ALL keys in localStorage so that everything is 100% empty and logged out
    localStorage.clear();
    localStorage.setItem(CLEAN_SLATE_MARKER, "true");
    forceReset = true;

    // Restore preserved vital items
    if (preservedEmployees) localStorage.setItem("corevia_employees_list_v2", preservedEmployees);
    if (preservedSubmissions) localStorage.setItem("corevia_employee_submissions_v2", preservedSubmissions);
    if (preservedSession1) localStorage.setItem("corevia_session_v1", preservedSession1);
    if (preservedSession2) localStorage.setItem("corevia_user_session_v1", preservedSession2);
    if (preservedActiveTab) localStorage.setItem("corevia_active_tab_v1", preservedActiveTab);
    if (preservedSaaSCompanies) localStorage.setItem("corevia_saas_companies_v1", preservedSaaSCompanies);
  }

  const hasProfile = localStorage.getItem(KEYS.PROFILE);
  if (hasProfile && !forceReset) return;

  // Set default empty profile info (when first loaded or reset), or use custom profile
  const emptyOwnerProfile: BusinessProfile = customProfile || {
    businessName: "",
    businessType: "",
    experienceYears: "",
    estimatedOrders: "0",
    estimatedWorkers: "0",
    currency: "DZD",
    defaultLanguage: "ar",
    preferredTheme: "dark",
    country: "Algeria",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    commercialRegistry: "",
    taxNumber: ""
  };
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(emptyOwnerProfile));
  
  // Set datasets to completely EMPTY arrays
  localStorage.setItem(KEYS.ORDERS, JSON.stringify([]));
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([]));
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify([]));
  localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
  localStorage.setItem(KEYS.WORKERS, JSON.stringify([]));
  localStorage.setItem(KEYS.SALARY_SHEETS, JSON.stringify([]));
  localStorage.setItem(KEYS.FIXED_EXP, JSON.stringify([]));
  localStorage.setItem(KEYS.VAR_EXP, JSON.stringify([]));
  localStorage.setItem(KEYS.AD_EXP, JSON.stringify([]));
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(defaultSettings));
  localStorage.setItem(KEYS.TRASH, JSON.stringify([]));

  // Empty basic, sub, return inventories
  localStorage.setItem(KEYS.INVENTORY_BASIC, JSON.stringify([]));
  localStorage.setItem(KEYS.INVENTORY_SUB, JSON.stringify([]));
  localStorage.setItem(KEYS.INVENTORY_RETURN, JSON.stringify([]));
  localStorage.setItem(KEYS.STOCK_MOVEMENTS, JSON.stringify([]));
}

// Safe Local Storage parse helper to prevent JSON parsing exceptions from locking up the browser
function safeParseLocalStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    if (item === "undefined" || item === "null") return fallback;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Error parsing item with key "${key}" from localStorage. Falling back.`, error);
    return fallback;
  }
}

// Data Getters and Setters
export function getBusinessProfile(): BusinessProfile | null {
  return safeParseLocalStorage<BusinessProfile | null>(KEYS.PROFILE, null);
}

export function saveBusinessProfile(p: BusinessProfile): void {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
}

export function getUserSession(): UserSession | null {
  return safeParseLocalStorage<UserSession | null>(KEYS.SESSION, {
    username: "",
    email: "",
    isRegistered: false,
    isApproved: false,
    isSuspended: false
  });
}

export function saveUserSession(s: UserSession): void {
  localStorage.setItem(KEYS.SESSION, JSON.stringify(s));
}

export function getAppSettings(): AppSettings {
  return safeParseLocalStorage<AppSettings>(KEYS.SETTINGS, defaultSettings);
}

export function saveAppSettings(s: AppSettings): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s));
}

// Orders Operations
export function getOrders(): Order[] {
  return safeParseLocalStorage<Order[]>(KEYS.ORDERS, []);
}

export function saveOrders(arr: Order[]): void {
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(arr));
}

// Products Operations
export function getProducts(): Product[] {
  return safeParseLocalStorage<Product[]>(KEYS.PRODUCTS, []);
}

export function saveProducts(arr: Product[]): void {
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(arr));
}

// Inventory Operations
export function getBasicInventory(): BasicInventoryItem[] {
  return safeParseLocalStorage<BasicInventoryItem[]>(KEYS.INVENTORY_BASIC, []);
}

export function saveBasicInventory(arr: BasicInventoryItem[]): void {
  localStorage.setItem(KEYS.INVENTORY_BASIC, JSON.stringify(arr));
}

export function getSubInventory(): SubInventoryItem[] {
  return safeParseLocalStorage<SubInventoryItem[]>(KEYS.INVENTORY_SUB, []);
}

export function saveSubInventory(arr: SubInventoryItem[]): void {
  localStorage.setItem(KEYS.INVENTORY_SUB, JSON.stringify(arr));
}

export function getReturnInventory(): ReturnInventoryItem[] {
  return safeParseLocalStorage<ReturnInventoryItem[]>(KEYS.INVENTORY_RETURN, []);
}

export function saveReturnInventory(arr: ReturnInventoryItem[]): void {
  localStorage.setItem(KEYS.INVENTORY_RETURN, JSON.stringify(arr));
}

export function getStockMovements(): StockMovement[] {
  return safeParseLocalStorage<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []);
}

export function saveStockMovements(arr: StockMovement[]): void {
  localStorage.setItem(KEYS.STOCK_MOVEMENTS, JSON.stringify(arr));
}

export function logStockMovement(
  orderId: string,
  productName: string,
  color: string,
  size: string,
  quantityChange: number,
  movementType: "New Order" | "Order Update" | "Order Delete" | "Return" | "Manual Adjustment",
  source = "Local Application"
): void {
  const movements = getStockMovements();
  const newMovement: StockMovement = {
    id: `mv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    date: new Date().toISOString(),
    orderId,
    productName,
    color,
    size: size || "",
    quantityChange,
    movementType,
    source
  };
  movements.unshift(newMovement);
  saveStockMovements(movements.slice(0, 1000)); // Maintain sensible limit of 1000 movements
}

// Suppliers Operations
export function getSuppliers(): Supplier[] {
  const data = safeParseLocalStorage<Supplier[]>(KEYS.SUPPLIERS, []);
  if (!data || data.length === 0) {
    return [];
  }
  return data;
}

export function saveSuppliers(arr: Supplier[]): void {
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(arr));
}

export function getSupplierInvoices(): SupplierInvoice[] {
  const data = safeParseLocalStorage<SupplierInvoice[]>(KEYS.INVOICES, []);
  if (!data || data.length === 0) {
    return [];
  }
  return data;
}

export function saveSupplierInvoices(arr: SupplierInvoice[]): void {
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(arr));
}

// Workers Operations
export function getWorkers(): Worker[] {
  return safeParseLocalStorage<Worker[]>(KEYS.WORKERS, []);
}

export function saveWorkers(arr: Worker[]): void {
  localStorage.setItem(KEYS.WORKERS, JSON.stringify(arr));
}

export function getSalarySheets(): WorkerSalarySheet[] {
  return safeParseLocalStorage<WorkerSalarySheet[]>(KEYS.SALARY_SHEETS, []);
}

export function saveSalarySheets(arr: WorkerSalarySheet[]): void {
  localStorage.setItem(KEYS.SALARY_SHEETS, JSON.stringify(arr));
}

// Expenses Operations
export function getFixedExpenses(): FixedExpense[] {
  return safeParseLocalStorage<FixedExpense[]>(KEYS.FIXED_EXP, []);
}

export function saveFixedExpenses(arr: FixedExpense[]): void {
  localStorage.setItem(KEYS.FIXED_EXP, JSON.stringify(arr));
}

export function getVarExpenses(): VariableExpense[] {
  return safeParseLocalStorage<VariableExpense[]>(KEYS.VAR_EXP, []);
}

export function saveVarExpenses(arr: VariableExpense[]): void {
  localStorage.setItem(KEYS.VAR_EXP, JSON.stringify(arr));
}

export function getAdExpenses(): AdExpense[] {
  return safeParseLocalStorage<AdExpense[]>(KEYS.AD_EXP, []);
}

export function saveAdExpenses(arr: AdExpense[]): void {
  localStorage.setItem(KEYS.AD_EXP, JSON.stringify(arr));
}

// Trash Bin Operations
export function getTrashItems(): TrashItem[] {
  return safeParseLocalStorage<TrashItem[]>(KEYS.TRASH, []);
}

export function saveTrashItems(arr: TrashItem[]): void {
  localStorage.setItem(KEYS.TRASH, JSON.stringify(arr));
}

// Automatic Stock Mutation Logic on Order creation
export function mutateInventoryForNewOrder(
  order: Order, 
  movementType: "New Order" | "Order Update" = "New Order", 
  source = "Local Application"
): void {
  const orderSource = order.source; // "1", "2", "3"
  
  if (orderSource === "1") {
    // Basic Inventory: matches by productId & color
    const basic = getBasicInventory();
    order.items.forEach(orderItem => {
      const idx = basic.findIndex(x => x.productId === orderItem.productId && x.color === orderItem.color);
      if (idx !== -1) {
        basic[idx].quantity = Math.max(0, basic[idx].quantity - orderItem.quantity);
      } else {
        // Fallback create record in basic inventory
        basic.push({
          productId: orderItem.productId,
          productName: orderItem.productName,
          color: orderItem.color,
          quantity: 0
        });
      }
      // Log stock deduction
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size || "", -orderItem.quantity, movementType, source);
    });
    saveBasicInventory(basic);
  }
  else if (orderSource === "2") {
    // Sub Inventory: matches by productId & color & size
    const sub = getSubInventory();
    order.items.forEach(orderItem => {
      const idx = sub.findIndex(x => x.productId === orderItem.productId && x.color === orderItem.color && x.size === orderItem.size);
      if (idx !== -1) {
        sub[idx].quantity = Math.max(0, sub[idx].quantity - orderItem.quantity);
      } else {
        sub.push({
          productId: orderItem.productId,
          productName: orderItem.productName,
          color: orderItem.color,
          size: orderItem.size,
          quantity: 0
        });
      }
      // Log stock deduction
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, -orderItem.quantity, movementType, source);
    });
    saveSubInventory(sub);
  }
  else if (orderSource === "3") {
    // Return Inventory: matches by matching productName & color & size
    const ret = getReturnInventory();
    order.items.forEach(orderItem => {
      const idx = ret.findIndex(x => x.productName === orderItem.productName && x.color === orderItem.color && x.size === orderItem.size);
      if (idx !== -1) {
        ret[idx].quantity = Math.max(0, ret[idx].quantity - orderItem.quantity);
      }
      // Log stock deduction
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, -orderItem.quantity, movementType, source);
    });
    saveReturnInventory(ret);
  }
}

// Revert Inventory (when editing or deleting an order)
export function revertInventoryForOrder(
  order: Order, 
  movementType: "Order Delete" | "Order Update" = "Order Delete", 
  source = "Local Application"
): void {
  const orderSource = order.source;
  
  if (orderSource === "1") {
    const basic = getBasicInventory();
    order.items.forEach(orderItem => {
      const idx = basic.findIndex(x => x.productId === orderItem.productId && x.color === orderItem.color);
      if (idx !== -1) {
        basic[idx].quantity += orderItem.quantity;
      } else {
        basic.push({
          productId: orderItem.productId,
          productName: orderItem.productName,
          color: orderItem.color,
          quantity: orderItem.quantity
        });
      }
      // Log stock refund
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size || "", orderItem.quantity, movementType, source);
    });
    saveBasicInventory(basic);
  }
  else if (orderSource === "2") {
    const sub = getSubInventory();
    order.items.forEach(orderItem => {
      const idx = sub.findIndex(x => x.productId === orderItem.productId && x.color === orderItem.color && x.size === orderItem.size);
      if (idx !== -1) {
        sub[idx].quantity += orderItem.quantity;
      } else {
        sub.push({
          productId: orderItem.productId,
          productName: orderItem.productName,
          color: orderItem.color,
          size: orderItem.size,
          quantity: orderItem.quantity
        });
      }
      // Log stock refund
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, orderItem.quantity, movementType, source);
    });
    saveSubInventory(sub);
  }
  else if (orderSource === "3") {
    const ret = getReturnInventory();
    order.items.forEach(orderItem => {
      const idx = ret.findIndex(x => x.productName === orderItem.productName && x.color === orderItem.color && x.size === orderItem.size);
      if (idx !== -1) {
        ret[idx].quantity += orderItem.quantity;
      } else {
        ret.push({
          orderId: order.id,
          productName: orderItem.productName,
          color: orderItem.color,
          size: orderItem.size,
          quantity: orderItem.quantity
        });
      }
      // Log stock refund
      logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, orderItem.quantity, "Order Delete", source);
    });
    saveReturnInventory(ret);
  }
}

// Adding Items to Return Inventory when order status is "returned"
export function addOrderToReturnInventory(order: Order, source = "Local Application"): void {
  const ret = getReturnInventory();
  order.items.forEach(orderItem => {
    // Search if matching product, color and size already is in returned inventory
    const idx = ret.findIndex(x => x.productName === orderItem.productName && x.color === orderItem.color && x.size === orderItem.size);
    if (idx !== -1) {
      ret[idx].quantity += orderItem.quantity;
    } else {
      ret.push({
        orderId: order.id,
        productName: orderItem.productName,
        color: orderItem.color,
        size: orderItem.size,
        quantity: orderItem.quantity
      });
    }
    // Log stock return addition
    logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, orderItem.quantity, "Return", source);
  });
  saveReturnInventory(ret);
}

// Removing Items from Return Inventory
export function removeOrderFromReturnInventory(order: Order, source = "Local Application"): void {
  const ret = getReturnInventory();
  order.items.forEach(orderItem => {
    const idx = ret.findIndex(x => x.productName === orderItem.productName && x.color === orderItem.color && x.size === orderItem.size);
    if (idx !== -1) {
      ret[idx].quantity = Math.max(0, ret[idx].quantity - orderItem.quantity);
    }
    // Log stock return subtraction
    logStockMovement(order.id, orderItem.productName, orderItem.color, orderItem.size, -orderItem.quantity, "Return", source);
  });
  // Filter out zero entries
  const filtered = ret.filter(x => x.quantity > 0);
  saveReturnInventory(filtered);
}

// Soft Deletion wrapper: Deletes and places in trash with automatic restore point
export function deleteOrderSoft(id: string): void {
  const orders = getOrders();
  const orderIdx = orders.findIndex(x => x.id === id);
  if (orderIdx === -1) return;

  const order = orders[orderIdx];
  orders.splice(orderIdx, 1);
  saveOrders(orders);

  // If order was returned, it populated Return inventory. Remove it.
  // Else, it populated delivered/pending (which decreased Basic/Sub/Return stock). 
  // Restore stock! Because we delete the order, we want to give items back.
  if (order.status === "returned") {
    // Remove the items added to Return stock
    removeOrderFromReturnInventory(order);
  } else {
    // Since it drew from stock, refund the items to the inventory source
    revertInventoryForOrder(order);
  }

  // Add to trash list
  const trash = getTrashItems();
  trash.push({
    id: `trash-o-${Date.now()}`,
    itemId: order.id,
    type: "order",
    title: `طلبية الزبون: ${order.customerName} (${order.id})`,
    deletedAt: new Date().toISOString(),
    originalData: order
  });
  saveTrashItems(trash);
}

export function restoreOrderSoft(originalOrder: Order): void {
  const orders = getOrders();
  orders.push(originalOrder);
  saveOrders(orders);

  // Restore inventory impact
  if (originalOrder.status === "returned") {
    // Add back to return inventory
    addOrderToReturnInventory(originalOrder);
  } else {
    // Deduct from its stock source again
    mutateInventoryForNewOrder(originalOrder);
  }
}

// Supplier Invoice Mutation Logic on basic/sub inventories
export function mutateInventoryForPurchase(invoice: SupplierInvoice): void {
  const basic = getBasicInventory();
  const sub = getSubInventory();

  invoice.items.forEach(item => {
    if (item.targetTable === "1") {
      // Basic Level
      const idx = basic.findIndex(x => x.productId === item.productId && x.color === item.color);
      if (idx !== -1) {
        basic[idx].quantity += item.quantity;
      } else {
        basic.push({
          productId: item.productId,
          productName: item.productName,
          color: item.color,
          quantity: item.quantity
        });
      }
    } else {
      // Sub Level
      const idx = sub.findIndex(x => x.productId === item.productId && x.color === item.color && x.size === item.size);
      if (idx !== -1) {
        sub[idx].quantity += item.quantity;
      } else {
        sub.push({
          productId: item.productId,
          productName: item.productName,
          color: item.color,
          size: item.size,
          quantity: item.quantity
        });
      }
    }
  });

  saveBasicInventory(basic);
  saveSubInventory(sub);
}

export function revertInventoryForPurchase(invoice: SupplierInvoice): void {
  const basic = getBasicInventory();
  const sub = getSubInventory();

  invoice.items.forEach(item => {
    if (item.targetTable === "1") {
      const idx = basic.findIndex(x => x.productId === item.productId && x.color === item.color);
      if (idx !== -1) {
        basic[idx].quantity = Math.max(0, basic[idx].quantity - item.quantity);
      }
    } else {
      const idx = sub.findIndex(x => x.productId === item.productId && x.color === item.color && x.size === item.size);
      if (idx !== -1) {
        sub[idx].quantity = Math.max(0, sub[idx].quantity - item.quantity);
      }
    }
  });

  saveBasicInventory(basic);
  saveSubInventory(sub);
}

// Soft delete supplier invoices
export function deleteInvoiceSoft(id: string): void {
  const invoices = getSupplierInvoices();
  const idx = invoices.findIndex(x => x.id === id);
  if (idx === -1) return;

  const invoice = invoices[idx];
  invoices.splice(idx, 1);
  saveSupplierInvoices(invoices);

  // Revert its added inventory
  revertInventoryForPurchase(invoice);

  const trash = getTrashItems();
  trash.push({
    id: `trash-i-${Date.now()}`,
    itemId: invoice.id,
    type: "invoice",
    title: `فاتورة شراء رقم: ${invoice.id} (${invoice.supplierName})`,
    deletedAt: new Date().toISOString(),
    originalData: invoice
  });
  saveTrashItems(trash);
}

export function restoreInvoiceSoft(ii: SupplierInvoice): void {
  const invoices = getSupplierInvoices();
  invoices.push(ii);
  saveSupplierInvoices(invoices);

  // Apply inventory changes again
  mutateInventoryForPurchase(ii);
}

// Soft delete workers
export function deleteWorkerSoft(id: string): void {
  const workers = getWorkers();
  const idx = workers.findIndex(x => x.id === id);
  if (idx === -1) return;

  const worker = workers[idx];
  workers.splice(idx, 1);
  saveWorkers(workers);

  const trash = getTrashItems();
  trash.push({
    id: `trash-w-${Date.now()}`,
    itemId: worker.id,
    type: "worker",
    title: `ملف العامل: ${worker.name} (${worker.code})`,
    deletedAt: new Date().toISOString(),
    originalData: worker
  });
  saveTrashItems(trash);
}

// Soft delete ENTIRE worker profile (all monthly statements matching a code)
export function deleteEntireWorkerProfileSoft(code: string): void {
  const workers = getWorkers();
  const toDelete = workers.filter(x => x.code === code);
  if (toDelete.length === 0) return;

  const remaining = workers.filter(x => x.code !== code);
  saveWorkers(remaining);

  const trash = getTrashItems();
  toDelete.forEach((worker, index) => {
    const monthVal = (worker as any).month;
    const yearVal = (worker as any).year;
    const titleSuffix = (monthVal !== undefined && yearVal !== undefined)
      ? ` - شهر ${monthVal + 1}/${yearVal}`
      : "";
    trash.push({
      id: `trash-w-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: worker.id,
      type: "worker",
      title: `ملف العامل: ${worker.name} (${worker.code})${titleSuffix}`,
      deletedAt: new Date().toISOString(),
      originalData: worker
    });
  });
  saveTrashItems(trash);
}

export function restoreWorkerSoft(w: Worker): void {
  const workers = getWorkers();
  workers.push(w);
  saveWorkers(workers);
}

// Soft delete products
export function deleteProductSoft(id: string): void {
  const products = getProducts();
  const idx = products.findIndex(x => x.id === id);
  if (idx === -1) return;

  const product = products[idx];
  products.splice(idx, 1);
  saveProducts(products);

  // Remove from Basic inventory
  let basic = getBasicInventory();
  basic = basic.filter(x => x.productId !== id);
  saveBasicInventory(basic);

  // Remove from Sub inventory
  let sub = getSubInventory();
  sub = sub.filter(x => x.productId !== id);
  saveSubInventory(sub);

  const trash = getTrashItems();
  trash.push({
    id: `trash-p-${Date.now()}`,
    itemId: product.id,
    type: "product",
    title: `منتج من الدليل: ${product.name}`,
    deletedAt: new Date().toISOString(),
    originalData: product
  });
  saveTrashItems(trash);
}

export function restoreProductSoft(p: Product): void {
  const products = getProducts();
  products.push(p);
  saveProducts(products);

  // Re-create basic inventory elements
  const basic = getBasicInventory();
  p.colors.forEach(col => {
    basic.push({
      productId: p.id,
      productName: p.name,
      color: col.color,
      quantity: col.quantity
    });
  });
  saveBasicInventory(basic);
}

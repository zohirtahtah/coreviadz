/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, OrderItem } from "./types";
import { 
  getOrders, saveOrders, mutateInventoryForNewOrder, 
  revertInventoryForOrder, addOrderToReturnInventory, 
  removeOrderFromReturnInventory, logStockMovement 
} from "./storageUtils";

// Keys used in localStorage for syncing
const SYNC_KEYS = {
  CONNECTED_EMAIL: "corevia_google_sync_email",
  ACCESS_TOKEN: "corevia_google_sync_token",
  SHEET_ID: "corevia_google_sync_sheet_id",
  SHEET_URL: "corevia_google_sync_sheet_url",
  PAUSED: "corevia_google_sync_paused",
  LAST_TIME: "corevia_google_sync_last_time",
  SIMULATION_MODE: "corevia_google_sync_simulation",
  SIMULATION_SHEET_DATA: "corevia_google_sync_sim_data",
  SYNC_LOGS: "corevia_google_sync_audit_logs"
};

export interface SyncAuditLog {
  id: string;
  time: string;
  type: "success" | "warning" | "error" | "info";
  message: string;
  source: "Google Sheets" | "Corevia App" | "System";
}

// Map order fields to dynamic flat string columns
export function serializeOrderToRow(order: Order, columns: string[]): string[] {
  return columns.map(col => {
    if (col === "items") {
      // Serialize nested items as a legible string
      return order.items
        .map(item => `${item.productName} (${item.color}${item.size ? ` / ${item.size}` : ""}) x${item.quantity}`)
        .join(" | ");
    }
    
    // Safety check for other fields
    const val = (order as any)[col];
    if (val === undefined || val === null) {
      return "";
    }
    if (typeof val === "boolean") {
      return val ? "TRUE" : "FALSE";
    }
    if (typeof val === "object") {
      return JSON.stringify(val);
    }
    return String(val);
  });
}

// Convert dynamic flat sheets row back to Order fields
export function deserializeRowToOrder(row: string[], columns: string[], productsList: any[] = []): Order {
  const order: any = {};
  
  columns.forEach((col, idx) => {
    const cellVal = row[idx] || "";
    
    if (col === "items") {
      // De-serialize text item string to item array
      // e.g. "Classic Hoodie Premium (Black (أسود) / M) x2"
      const items: OrderItem[] = [];
      const parts = cellVal.split(" | ");
      parts.forEach((part, pIdx) => {
        if (!part.trim()) return;
        
        // Regex parse: Name (Color / Size) xQuantity or Name (Color) xQuantity
        const qtyMatch = part.match(/x\s*(\d+)$/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1]) || 1 : 1;
        
        let rest = part.replace(/\s*x\s*\d+$/, "").trim();
        let productName = rest;
        let color = "";
        let size = "";
        
        const braceMatch = rest.match(/\(([^)]+)\)$/);
        if (braceMatch) {
          productName = rest.substring(0, rest.lastIndexOf("(")).trim();
          const detail = braceMatch[1];
          if (detail.includes(" / ")) {
            const dParts = detail.split(" / ");
            color = dParts[0].trim();
            size = dParts[1].trim();
          } else {
            color = detail.trim();
          }
        }
        
        // Standard placeholder costing/pricing mapping
        items.push({
          id: `item-${Date.now()}-${pIdx}-${Math.random().toString(36).substr(2,3)}`,
          productId: "prod-1", // default fallback mapping
          productName,
          color: color || "Black (أسود)",
          size: size || "M",
          quantity,
          productCost: 1500,
          sellingPrice: 2500
        });
      });
      order.items = items;
    } else if (col === "deliveryPrice" || col === "totalPrice" || col === "paidAmount" || col === "discount" || col === "returnCost") {
      order[col] = cellVal ? parseFloat(cellVal) || 0 : 0;
    } else if (col === "customerPaysDelivery" || col === "isExchange") {
      order[col] = cellVal.toUpperCase() === "TRUE";
    } else {
      order[col] = cellVal;
    }
  });

  // Ensure default fallback attributes
  if (!order.id) {
    order.id = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
  }
  if (!order.date) {
    order.date = new Date().toISOString().split("T")[0];
  }
  if (!order.status) {
    order.status = "pending";
  }
  if (!order.source) {
    order.source = "1"; // Default to basic level
  }
  if (!order.agentName) {
    order.agentName = "Google Sync";
  }
  if (!order.items || order.items.length === 0) {
    order.items = [
      {
        id: `item-${Date.now()}`,
        productId: "prod-1",
        productName: "Classic Hoodie Premium",
        color: "Black (أسود)",
        size: "M",
        quantity: 1,
        productCost: 1500,
        sellingPrice: 2500
      }
    ];
  }
  if (!order.totalPrice) {
    order.totalPrice = order.items.reduce((sum: number, it: any) => sum + (it.sellingPrice * it.quantity), 0);
  }

  return order as Order;
}

// Extract dynamic list of columns from orders
export function getDynamicOrderColumns(ordersList: Order[]): string[] {
  const defaultKeys = [
    "id", "date", "customerName", "phone", "wilaya", "commune", 
    "deliveryLocation", "deliveryCompany", "deliveryType", "deliveryPrice", 
    "totalPrice", "paidAmount", "discount", "customerPaysDelivery", 
    "isExchange", "exchangeOrderRef", "agentName", "status", "notes", "items"
  ];
  
  if (!ordersList || ordersList.length === 0) {
    return defaultKeys;
  }
  
  // Dynamic parsing: get union of all properties found in current order storage
  const keysSet = new Set<string>();
  ordersList.forEach(order => {
    Object.keys(order).forEach(k => {
      // Skip internal attributes
      if (k !== "deletedAt" && k !== "lastUpdated") {
        keysSet.add(k);
      }
    });
  });
  
  // Ensure 'items' is at the end for clean spreadsheet layout
  keysSet.delete("items");
  const result = Array.from(keysSet);
  result.push("items");
  return result;
}

// Local mock sheet database in localStorage to ensure flawless testing offline
export function initializeSimulationDatabase() {
  const initialized = localStorage.getItem(SYNC_KEYS.SIMULATION_SHEET_DATA);
  if (initialized) return;

  const initialOrders = getOrders();
  const columns = getDynamicOrderColumns(initialOrders);
  
  const headers = [...columns];
  const rows: string[][] = [headers];
  
  initialOrders.forEach(order => {
    rows.push(serializeOrderToRow(order, columns));
  });

  localStorage.setItem(SYNC_KEYS.SIMULATION_SHEET_DATA, JSON.stringify(rows));
}

export function logSyncAudit(message: string, type: "success" | "warning" | "error" | "info" = "info", source: "Google Sheets" | "Corevia App" | "System" = "System") {
  const logs = safeParseJSON(localStorage.getItem(SYNC_KEYS.SYNC_LOGS), []);
  const newLog: SyncAuditLog = {
    id: `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    time: new Date().toLocaleTimeString(),
    type,
    message,
    source
  };
  logs.unshift(newLog);
  localStorage.setItem(SYNC_KEYS.SYNC_LOGS, JSON.stringify(logs.slice(0, 50))); // Keep last 50 logs
}

export function getSyncAuditLogs(): SyncAuditLog[] {
  return safeParseJSON(localStorage.getItem(SYNC_KEYS.SYNC_LOGS), []);
}

export function clearSyncAuditLogs() {
  localStorage.setItem(SYNC_KEYS.SYNC_LOGS, JSON.stringify([]));
}

// Safe parsing helper
function safeParseJSON(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

// -------------------------------------------------------------
// CORE SYNC METHODS
// -------------------------------------------------------------

export function getSyncSettings() {
  return {
    connectedEmail: localStorage.getItem(SYNC_KEYS.CONNECTED_EMAIL) || null,
    accessToken: localStorage.getItem(SYNC_KEYS.ACCESS_TOKEN) || null,
    sheetId: localStorage.getItem(SYNC_KEYS.SHEET_ID) || null,
    sheetUrl: localStorage.getItem(SYNC_KEYS.SHEET_URL) || null,
    isPaused: localStorage.getItem(SYNC_KEYS.PAUSED) === "true",
    lastTime: localStorage.getItem(SYNC_KEYS.LAST_TIME) || null,
    isSimulation: localStorage.getItem(SYNC_KEYS.SIMULATION_MODE) !== "false" // default to true to guarantee interactive testing
  };
}

export function saveSyncSettings(settings: {
  connectedEmail?: string | null;
  accessToken?: string | null;
  sheetId?: string | null;
  sheetUrl?: string | null;
  isPaused?: boolean;
  lastTime?: string | null;
  isSimulation?: boolean;
}) {
  if (settings.connectedEmail !== undefined) {
    if (settings.connectedEmail) localStorage.setItem(SYNC_KEYS.CONNECTED_EMAIL, settings.connectedEmail);
    else localStorage.removeItem(SYNC_KEYS.CONNECTED_EMAIL);
  }
  if (settings.accessToken !== undefined) {
    if (settings.accessToken) localStorage.setItem(SYNC_KEYS.ACCESS_TOKEN, settings.accessToken);
    else localStorage.removeItem(SYNC_KEYS.ACCESS_TOKEN);
  }
  if (settings.sheetId !== undefined) {
    if (settings.sheetId) localStorage.setItem(SYNC_KEYS.SHEET_ID, settings.sheetId);
    else localStorage.removeItem(SYNC_KEYS.SHEET_ID);
  }
  if (settings.sheetUrl !== undefined) {
    if (settings.sheetUrl) localStorage.setItem(SYNC_KEYS.SHEET_URL, settings.sheetUrl);
    else localStorage.removeItem(SYNC_KEYS.SHEET_URL);
  }
  if (settings.isPaused !== undefined) {
    localStorage.setItem(SYNC_KEYS.PAUSED, settings.isPaused ? "true" : "false");
  }
  if (settings.lastTime !== undefined) {
    if (settings.lastTime) localStorage.setItem(SYNC_KEYS.LAST_TIME, settings.lastTime);
    else localStorage.removeItem(SYNC_KEYS.LAST_TIME);
  }
  if (settings.isSimulation !== undefined) {
    localStorage.setItem(SYNC_KEYS.SIMULATION_MODE, settings.isSimulation ? "true" : "false");
  }
}

export function disconnectSyncAccount() {
  localStorage.removeItem(SYNC_KEYS.CONNECTED_EMAIL);
  localStorage.removeItem(SYNC_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(SYNC_KEYS.SHEET_ID);
  localStorage.removeItem(SYNC_KEYS.SHEET_URL);
  localStorage.setItem(SYNC_KEYS.PAUSED, "false");
  localStorage.setItem(SYNC_KEYS.SIMULATION_MODE, "true"); // default back to safe offline simulator
  logSyncAudit("Disconnected Google account. Sync reset to offline simulation mode.", "warning", "System");
}

// -------------------------------------------------------------
// BI-DIRECTIONAL MUTATIONS
// -------------------------------------------------------------

// Local helper to recalculate stats and reconcile inventory
function syncUpdateOrderInCoreviaDb(orderId: string, updatedOrder: Order | null, products: any[]) {
  const currentOrders = getOrders();
  const oldOrder = currentOrders.find(o => o.id === orderId);

  if (updatedOrder === null) {
    // Delete Order
    if (oldOrder) {
      const newList = currentOrders.filter(o => o.id !== orderId);
      saveOrders(newList);

      // Revert stock!
      if (oldOrder.status === "returned") {
        removeOrderFromReturnInventory(oldOrder);
      } else {
        revertInventoryForOrder(oldOrder);
      }
      
      // Log stock movement
      oldOrder.items.forEach(itm => {
        logStockMovement(
          orderId,
          itm.productName,
          itm.color,
          itm.size,
          itm.quantity,
          "Order Delete",
          "Google Sheets Sync"
        );
      });
      logSyncAudit(`Order ${orderId} deleted from dashboard.`, "warning", "Google Sheets");
    }
    return;
  }

  if (oldOrder) {
    // Modify existing Order
    // Revert old inventory balance
    if (oldOrder.status === "returned") {
      removeOrderFromReturnInventory(oldOrder);
    } else {
      revertInventoryForOrder(oldOrder);
    }

    // Apply new inventory impact
    if (updatedOrder.status === "returned") {
      addOrderToReturnInventory(updatedOrder);
      // Log stock movement for returns
      updatedOrder.items.forEach(itm => {
        logStockMovement(
          orderId,
          itm.productName,
          itm.color,
          itm.size,
          itm.quantity,
          "Return",
          "Google Sheets Sync"
        );
      });
    } else {
      mutateInventoryForNewOrder(updatedOrder);
      // Log stock movement changes
      updatedOrder.items.forEach(itm => {
        // Compare with old quantity to log properly or log complete change
        logStockMovement(
          orderId,
          itm.productName,
          itm.color,
          itm.size,
          -itm.quantity,
          "Order Update",
          "Google Sheets Sync"
        );
      });
    }

    // Update orders list
    const newList = currentOrders.map(o => o.id === orderId ? updatedOrder : o);
    saveOrders(newList);
    logSyncAudit(`Order ${orderId} details updated from Google Sheet adjustments.`, "success", "Google Sheets");
  } else {
    // Build entirely new order
    const newList = [updatedOrder, ...currentOrders];
    saveOrders(newList);

    // Apply stock deduction
    if (updatedOrder.status === "returned") {
      addOrderToReturnInventory(updatedOrder);
      updatedOrder.items.forEach(itm => {
        logStockMovement(
          orderId,
          itm.productName,
          itm.color,
          itm.size,
          itm.quantity,
          "Return",
          "Google Sheets Sync"
        );
      });
    } else {
      mutateInventoryForNewOrder(updatedOrder);
      updatedOrder.items.forEach(itm => {
        logStockMovement(
          orderId,
          itm.productName,
          itm.color,
          itm.size,
          -itm.quantity,
          "New Order",
          "Google Sheets Sync"
        );
      });
    }
    logSyncAudit(`New Order ${orderId} created from Google Sheet.`, "success", "Google Sheets");
  }
}

// -------------------------------------------------------------
// HIGH-FIDELITY LOCAL SIMULATOR (Offline)
// -------------------------------------------------------------

export function loadSimulationSheetData(): string[][] {
  return safeParseJSON(localStorage.getItem(SYNC_KEYS.SIMULATION_SHEET_DATA), []);
}

export function saveSimulationSheetData(rows: string[][]) {
  localStorage.setItem(SYNC_KEYS.SIMULATION_SHEET_DATA, JSON.stringify(rows));
}

// Fully execute offline simulation 2-way sync
export function runSimulationTwoWaySync(products: any[]): { success: boolean; changes: string[] } {
  const changedLogs: string[] = [];
  const settings = getSyncSettings();
  if (settings.isPaused) {
    return { success: false, changes: ["Sync is paused."] };
  }

  const simData = loadSimulationSheetData();
  if (simData.length === 0) return { success: true, changes: [] };

  const columns = simData[0];
  const idColIdx = columns.indexOf("id");
  if (idColIdx === -1) {
    return { success: false, changes: ["Missing critical column: id (ORDER_ID)"] };
  }

  // Orders from core app
  const coreOrders = getOrders();
  
  // Match rows in CSV simulation sheet with local orders database
  const sheetOrderIds = new Set<string>();
  const parsedSheetOrders: Order[] = [];

  for (let r = 1; r < simData.length; r++) {
    const row = simData[r];
    if (!row || row.length === 0 || !row[idColIdx]) continue;
    
    const oId = row[idColIdx].trim();
    if (!oId) continue;

    sheetOrderIds.add(oId);
    
    // De-serialize row to Order data
    const sheetOrder = deserializeRowToOrder(row, columns, products);
    parsedSheetOrders.push(sheetOrder);
  }

  // 1. Process deletions (Orders in Corevia but deleted from simulation Google Sheet)
  coreOrders.forEach(coreO => {
    if (!sheetOrderIds.has(coreO.id)) {
      // Order has been deleted in sheet! Reflect to Corevia DB
      syncUpdateOrderInCoreviaDb(coreO.id, null, products);
      changedLogs.push(`Deleted Order ${coreO.id} (synchronized with Google Sheet removal)`);
    }
  });

  // 2. Process additions / modifications from simulation Sheet to Corevia
  parsedSheetOrders.forEach(sheetO => {
    const coreO = coreOrders.find(o => o.id === sheetO.id);
    if (!coreO) {
      // Brand new order added in simulation sheet! Add to Corevia
      syncUpdateOrderInCoreviaDb(sheetO.id, sheetO, products);
      changedLogs.push(`Created Order ${sheetO.id} of ${sheetO.customerName} via Google Sheet row insertion.`);
    } else {
      // Order exists in both. Check if anything is modified.
      // In simulation mode, we compare row serialized data directly to check modifications.
      const serializedCore = serializeOrderToRow(coreO, columns);
      const serializedSheet = serializeOrderToRow(sheetO, columns);
      const isDifferent = JSON.stringify(serializedCore) !== JSON.stringify(serializedSheet);

      if (isDifferent) {
        // Core vs Sheets diff. Accept Sheets' modifications in this sync cycle
        syncUpdateOrderInCoreviaDb(sheetO.id, sheetO, products);
        changedLogs.push(`Updated Order ${sheetO.id} details matching Google Sheet edits.`);
      }
    }
  });

  // 3. Keep Simulation sheet updated with Corevia newly added orders
  const finalCoreOrders = getOrders();
  const finalColumns = getDynamicOrderColumns(finalCoreOrders);
  const finalRows: string[][] = [finalColumns];

  finalCoreOrders.forEach(order => {
    finalRows.push(serializeOrderToRow(order, finalColumns));
  });

  saveSimulationSheetData(finalRows);
  saveSyncSettings({ lastTime: new Date().toLocaleTimeString() });

  return { success: true, changes: changedLogs };
}

// -------------------------------------------------------------
// REAL GOOGLE SHEETS API IMPLEMENTATION (Online Client-side)
// -------------------------------------------------------------

// Helper to handle standard Google Drive / Sheets fetch requests
async function googleFetch(url: string, method: string, accessToken: string, body: any = null) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };

  const options: any = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Create spreadsheet in Drive named "Corevia Orders Sync"
export async function createRealSyncGoogleSheet(accessToken: string, ordersList: Order[]): Promise<{ id: string; url: string }> {
  try {
    logSyncAudit("Contacting Google Sheets API to create spreadsheet...", "info", "System");
    
    // Create spreadsheet first
    const createRes = await googleFetch("https://sheets.googleapis.com/v4/spreadsheets", "POST", accessToken, {
      properties: {
        title: "Corevia Orders Entry"
      }
    });

    const sheetId = createRes.spreadsheetId;
    const sheetUrl = createRes.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

    logSyncAudit(`Spreadsheet created successfully! ID: ${sheetId}`, "success", "Google Sheets");

    // Populate columns dynamically
    const columns = getDynamicOrderColumns(ordersList);
    const headers = [...columns];
    const initialRows: string[][] = [headers];

    ordersList.forEach(order => {
      initialRows.push(serializeOrderToRow(order, columns));
    });

    // Write default layout and records to Sheet
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z${initialRows.length + 5}?valueInputOption=USER_ENTERED`,
      "PUT",
      accessToken,
      {
        range: `A1:Z${initialRows.length + 5}`,
        majorDimension: "ROWS",
        values: initialRows
      }
    );

    // Save metadata locally
    saveSyncSettings({
      sheetId,
      sheetUrl,
      isSimulation: false, // Turn off simulation mode once real sheets API connects successfully!
      lastTime: new Date().toLocaleTimeString()
    });

    logSyncAudit("Fully provisioned and synced initial orders database to Google Spreadsheet.", "success", "System");
    return { id: sheetId, url: sheetUrl };
  } catch (error: any) {
    console.error("Failed to create real Google sheet: ", error);
    logSyncAudit(`Failed to provision Google Sheet: ${error.message || "Unknown Error"}`, "error", "System");
    throw error;
  }
}

// Push all orders from Corevia to Google Sheets (overwrite)
export async function pushRealOrdersToGoogleSheet(accessToken: string, sheetId: string, ordersList: Order[]): Promise<boolean> {
  try {
    const columns = getDynamicOrderColumns(ordersList);
    const rows = [columns];
    ordersList.forEach(o => {
      rows.push(serializeOrderToRow(o, columns));
    });

    // Clear range first to prevent stale cells
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z5000:clear`,
      "POST",
      accessToken
    );

    // Write all rows
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z${rows.length + 5}?valueInputOption=USER_ENTERED`,
      "PUT",
      accessToken,
      {
        range: `A1:Z${rows.length + 5}`,
        majorDimension: "ROWS",
        values: rows
      }
    );

    saveSyncSettings({ lastTime: new Date().toLocaleTimeString() });
    logSyncAudit("Pushed all local orders to Google Sheets successfully.", "success", "Corevia App");
    return true;
  } catch (error: any) {
    console.error("Push orders error:", error);
    logSyncAudit(`Failed to push orders to Google Sheet: ${error.message}`, "error", "System");
    return false;
  }
}

// Perform active 2-way sync with Real Google Sheets
export async function runRealTwoWaySync(accessToken: string, sheetId: string, productsList: any[]): Promise<{ success: boolean; changes: string[] }> {
  try {
    const changedLogs: string[] = [];
    
    // Fetch current rows from Sheet
    const sheetData = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z2000?valueRenderOption=UNFORMATTED_VALUE`,
      "GET",
      accessToken
    );

    const sheetRows: string[][] = sheetData.values || [];
    if (sheetRows.length === 0) {
      // Empty sheet - let's push local database to sheet
      const localOrders = getOrders();
      await pushRealOrdersToGoogleSheet(accessToken, sheetId, localOrders);
      return { success: true, changes: ["Google Sheet was empty. Pushed all local orders to Sheet."] };
    }

    const columns = sheetRows[0];
    const idColIdx = columns.indexOf("id");
    if (idColIdx === -1) {
      logSyncAudit("Validation failure: Google Sheet is missing the structural 'id' column header.", "error", "Google Sheets");
      return { success: false, changes: ["Missing required 'id' column header in Sheet."] };
    }

    const coreOrders = getOrders();
    const sheetOrderIds = new Set<string>();
    const parsedSheetOrders: Order[] = [];

    // Parse sheet rows
    for (let r = 1; r < sheetRows.length; r++) {
      const row = sheetRows[r];
      if (!row || row.length === 0 || !row[idColIdx]) continue;

      const oId = String(row[idColIdx]).trim();
      if (!oId) continue;

      sheetOrderIds.add(oId);
      const sheetOrder = deserializeRowToOrder(row, columns, productsList);
      parsedSheetOrders.push(sheetOrder);
    }

    // 1. Core orders missing in Sheets -> Deleted in Sheets -> Remove from Core
    coreOrders.forEach(coreO => {
      if (!sheetOrderIds.has(coreO.id)) {
        syncUpdateOrderInCoreviaDb(coreO.id, null, productsList);
        changedLogs.push(`Deleted Order ${coreO.id} (matching Sheet deletion).`);
      }
    });

    // 2. Align sheet orders with Core orders
    parsedSheetOrders.forEach(sheetO => {
      const coreO = coreOrders.find(o => o.id === sheetO.id);
      if (!coreO) {
        // Created in Sheets -> Create in Core
        syncUpdateOrderInCoreviaDb(sheetO.id, sheetO, productsList);
        changedLogs.push(`Created Order ${sheetO.id} from Sheet row.`);
      } else {
        // Exists in both. Compare values
        const serializedCore = serializeOrderToRow(coreO, columns);
        const serializedSheet = serializeOrderToRow(sheetO, columns);
        const isDifferent = JSON.stringify(serializedCore) !== JSON.stringify(serializedSheet);

        if (isDifferent) {
          // Compare edit timestamps if present, else default to Sheets' priority in case of conflict
          // Let's assume the conflict resolves in favour of the sheet row.
          syncUpdateOrderInCoreviaDb(sheetO.id, sheetO, productsList);
          changedLogs.push(`Updated Order ${sheetO.id} from Sheet edits.`);
        }
      }
    });

    // 3. Core orders that are updated/added in Core -> Upload back to Sheets
    // If we had any Corevia-only additions (or changes), we simply write back the whole reconciled database.
    const reconciledOrders = getOrders();
    const reconciledColumns = getDynamicOrderColumns(reconciledOrders);
    const finalRows = [reconciledColumns];
    reconciledOrders.forEach(o => {
      finalRows.push(serializeOrderToRow(o, reconciledColumns));
    });

    // Clear old values and overwrite
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z5000:clear`,
      "POST",
      accessToken
    );

    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z${finalRows.length + 5}?valueInputOption=USER_ENTERED`,
      "PUT",
      accessToken,
      {
        range: `A1:Z${finalRows.length + 5}`,
        majorDimension: "ROWS",
        values: finalRows
      }
    );

    saveSyncSettings({ lastTime: new Date().toLocaleTimeString() });
    return { success: true, changes: changedLogs };
  } catch (error: any) {
    console.error("Real Two-way Sync failed: ", error);
    logSyncAudit(`Two-way Sync failed: ${error.message || error}`, "error", "System");
    return { success: false, changes: [`Sync error: ${error.message || error}`] };
  }
}

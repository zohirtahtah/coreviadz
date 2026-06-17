// =============================================
// COREVIA ENTERPRISE API SERVICE
// Single source of truth - Supabase Postgres only
// localStorage eliminated for all business data
// =============================================

import { supabase } from "../supabaseClient";
import type {
  EnterpriseWorker as Worker,
  EnterpriseCompanyUser as CompanyUser,
  EnterpriseOrder as Order,
  EnterpriseOrderItem as OrderItem,
  EnterpriseProduct as Product,
  EnterpriseInventory as InventoryItem,
  EnterpriseStockMovement as StockMovement,
  EnterpriseSupplier as Supplier,
  EnterpriseExpense as Expense,
  EnterpriseNotification as Notification,
  EnterpriseAuditLog as AuditLog,
  ChatMessage,
} from "../types";
import type { ActivityLogEntry as ActivityLog } from "../activityLogService";

export interface Department {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  location: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

// =========================================================================
// WORKERS API
// =========================================================================

export async function getWorkers(companyId: string): Promise<Worker[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_workers")
    .select("*")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Worker[];
}

export async function createWorker(companyId: string, data: Partial<Worker>): Promise<Worker> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("wrk");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_workers")
    .insert({
      id,
      company_id: companyId,
      full_name: data.full_name || "",
      phone: data.phone || "",
      salary: data.salary || 0,
      position: data.position || "",
      hire_date: data.hire_date || null,
      status: "active",
      created_at: now,
      updated_at: now,
      archived_at: null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create worker: ${error.message}`);
  return record as Worker;
}

export async function updateWorker(id: string, companyId: string, data: Partial<Worker>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_workers")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update worker: ${error.message}`);
}

export async function archiveWorker(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_workers")
    .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to archive worker: ${error.message}`);
}

// =========================================================================
// COMPANY USERS API
// =========================================================================

export async function getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_company_users")
    .select("*, corevia_workers(*)")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CompanyUser[];
}

export async function inviteEmployee(companyId: string, data: { email: string; fullName: string; workerId: string; role: string }): Promise<any> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("cu");
  const token = generateId("inv");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: record, error } = await supabase
    .from("corevia_company_users")
    .insert({
      id,
      company_id: companyId,
      worker_id: data.workerId,
      auth_user_id: null,
      email: data.email,
      username: data.fullName,
      phone: "",
      role: data.role,
      allowed_pages: [],
      invitation_token: token,
      invitation_expires_at: expiresAt,
      invitation_used: false,
      status: "active",
      created_at: now,
      updated_at: now,
      archived_at: null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to invite employee: ${error.message}`);
  return record;
}

export async function deleteCompanyUser(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_company_users")
    .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to delete company user: ${error.message}`);
}

export async function updateUserRole(id: string, role: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_company_users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update user role: ${error.message}`);
}

export async function updateUserPages(id: string, pages: string[], companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_company_users")
    .update({ allowed_pages: pages, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update user pages: ${error.message}`);
}

// =========================================================================
// ORDERS API
// =========================================================================

export async function getOrders(companyId: string, filters?: { status?: string; customer?: string }): Promise<Order[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  let query = supabase
    .from("corevia_orders")
    .select("*")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.customer) {
    query = query.ilike("customer", `%${filters.customer}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Order[];
}

export async function createOrder(companyId: string, data: Partial<Order> & { items: OrderItem[] }): Promise<Order> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("ord");
  const now = new Date().toISOString();
  const { data: order, error: orderError } = await supabase
    .from("corevia_orders")
    .insert({
      id,
      company_id: companyId,
      customer: data.customer || "",
      total: data.total || 0,
      status: data.status || "pending",
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
      archived_at: null,
    })
    .select()
    .single();
  if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
  if (data.items && data.items.length > 0) {
    const items = data.items.map((item) => ({
      id: item.id || generateId("oi"),
      order_id: id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal || item.price * item.quantity,
      created_at: now,
    }));
    const { error: itemsError } = await supabase.from("corevia_order_items").insert(items);
    if (itemsError) throw new Error(`Failed to create order items: ${itemsError.message}`);
  }
  return { ...order, items: data.items || [] } as Order;
}

export async function updateOrder(id: string, companyId: string, data: Partial<Order>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_orders")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update order: ${error.message}`);
}

export async function cancelOrder(id: string, companyId: string, reason?: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_orders")
    .update({
      status: "cancelled",
      notes: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to cancel order: ${error.message}`);
}

export async function approveOrder(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_orders")
    .update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to approve order: ${error.message}`);
}

export async function getOrderItems(orderId: string, companyId: string): Promise<OrderItem[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as OrderItem[];
}

export async function saveOrderItems(orderId: string, companyId: string, items: OrderItem[]): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const now = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from("corevia_order_items")
    .delete()
    .eq("order_id", orderId);
  if (deleteError) throw new Error(`Failed to replace order items: ${deleteError.message}`);
  if (items.length > 0) {
    const formatted = items.map((item) => ({
      id: item.id || generateId("oi"),
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal || item.price * item.quantity,
      created_at: now,
    }));
    const { error: insertError } = await supabase.from("corevia_order_items").insert(formatted);
    if (insertError) throw new Error(`Failed to save order items: ${insertError.message}`);
  }
}

// =========================================================================
// PRODUCTS API
// =========================================================================

export async function getProducts(companyId: string): Promise<Product[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_products")
    .select("*")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Product[];
}

export async function createProduct(companyId: string, data: Partial<Product>): Promise<Product> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("prd");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_products")
    .insert({
      id,
      company_id: companyId,
      name: data.name || "",
      description: data.description || null,
      price: data.price || 0,
      cost: data.cost || 0,
      category: data.category || "",
      unit: data.unit || "",
      image_url: data.image_url || null,
      barcode: data.barcode || null,
      created_at: now,
      updated_at: now,
      archived_at: null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create product: ${error.message}`);
  return record as Product;
}

export async function updateProduct(id: string, companyId: string, data: Partial<Product>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_products")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update product: ${error.message}`);
}

export async function deleteProduct(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_products")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to delete product: ${error.message}`);
}

// =========================================================================
// INVENTORY API
// =========================================================================

export async function getInventory(companyId: string): Promise<InventoryItem[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_inventory")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as InventoryItem[];
}

export async function logStockMovement(companyId: string, data: StockMovement): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = data.id || generateId("sm");
  const { error } = await supabase.from("corevia_stock_movements").insert({
    id,
    company_id: companyId,
    product_id: data.product_id,
    product_name: data.product_name,
    movement_type: data.movement_type,
    quantity: data.quantity,
    reason: data.reason || "",
    reference_type: data.reference_type || "",
    reference_id: data.reference_id || "",
    created_by: data.created_by || "",
    created_at: data.created_at || new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to log stock movement: ${error.message}`);
}

export async function getStockMovements(companyId: string): Promise<StockMovement[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_stock_movements")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as StockMovement[];
}

// =========================================================================
// SUPPLIERS API
// =========================================================================

export async function getSuppliers(companyId: string): Promise<Supplier[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_suppliers")
    .select("*")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Supplier[];
}

export async function createSupplier(companyId: string, data: Partial<Supplier>): Promise<Supplier> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("sup");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_suppliers")
    .insert({
      id,
      company_id: companyId,
      name: data.name || "",
      contact_name: data.contact_name || "",
      phone: data.phone || "",
      email: data.email || "",
      address: data.address || "",
      category: data.category || "",
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
      archived_at: null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create supplier: ${error.message}`);
  return record as Supplier;
}

export async function updateSupplier(id: string, companyId: string, data: Partial<Supplier>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_suppliers")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update supplier: ${error.message}`);
}

export async function deleteSupplier(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_suppliers")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to delete supplier: ${error.message}`);
}

// =========================================================================
// EXPENSES API
// =========================================================================

export async function getExpenses(companyId: string): Promise<Expense[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_expenses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Expense[];
}

export async function createExpense(companyId: string, data: Partial<Expense>): Promise<Expense> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("exp");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_expenses")
    .insert({
      id,
      company_id: companyId,
      description: data.description || "",
      amount: data.amount || 0,
      category: data.category || "",
      date: data.date || now,
      paid_by: data.paid_by || "",
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create expense: ${error.message}`);
  return record as Expense;
}

export async function updateExpense(id: string, companyId: string, data: Partial<Expense>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_expenses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update expense: ${error.message}`);
}

export async function deleteExpense(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_expenses")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to delete expense: ${error.message}`);
}

// =========================================================================
// CHAT API
// =========================================================================

export async function getChatMessages(companyId: string): Promise<ChatMessage[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_chat_messages")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ChatMessage[];
}

export async function sendChatMessage(companyId: string, data: Partial<ChatMessage>): Promise<ChatMessage> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = data.id || generateId("chat");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_chat_messages")
    .insert({
      id,
      company_id: companyId,
      sender_id: data.sender_id || "",
      sender_name: data.sender_name || "",
      sender_job_title: data.sender_job_title || "",
      content: data.content || "",
      voice_url: data.voice_url || null,
      created_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to send chat message: ${error.message}`);
  return record as ChatMessage;
}

// =========================================================================
// NOTIFICATIONS API
// =========================================================================

export async function getNotifications(companyId: string): Promise<Notification[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_notifications")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Notification[];
}

export async function markNotificationRead(id: string, companyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data: notif, error: fetchError } = await supabase
    .from("corevia_notifications")
    .select("read_by")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (fetchError) throw new Error(`Failed to fetch notification: ${fetchError.message}`);
  const currentReadBy: string[] = (notif as any)?.read_by || [];
  const { error } = await supabase
    .from("corevia_notifications")
    .update({ read_by: [...currentReadBy, "system"] })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to mark notification read: ${error.message}`);
}

// =========================================================================
// PERMISSIONS API
// =========================================================================

export async function checkPermission(code: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("corevia_permissions")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export async function getMyPermissions(): Promise<string[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("corevia_permissions")
    .select("code");
  if (error || !data) return [];
  return data.map((p: any) => p.code);
}

// =========================================================================
// SUBSCRIPTION API
// =========================================================================

export async function getCompanySubscription(companyId: string): Promise<any> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_companies")
    .select("subscription_start_date, subscription_duration_months, subscription_end_date, seats_limit, status")
    .eq("id", companyId)
    .single();
  if (error) throw new Error(`Failed to fetch subscription: ${error.message}`);
  return data;
}

// =========================================================================
// ACTIVITY / AUDIT API
// =========================================================================

export async function getActivityLog(companyId: string): Promise<ActivityLog[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_activity_center")
    .select("*")
    .eq("company_id", companyId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  const mapped: ActivityLog[] = (data || []).map((item: any) => ({
    id: item.id,
    companyId: item.company_id,
    timestamp: item.timestamp,
    date: item.timestamp ? item.timestamp.split("T")[0] : "",
    time: item.timestamp ? item.timestamp.split("T")[1]?.substring(0, 5) || "" : "",
    userName: item.user_name,
    userId: item.user_id,
    jobTitle: item.job_title || "",
    actionType: item.action_type,
    pageName: item.page_name || "",
    affectedRecord: item.affected_record || "",
    previousValue: item.previous_value || undefined,
    newValue: item.new_value || undefined,
  }));
  return mapped;
}

export async function getAuditLog(companyId: string): Promise<AuditLog[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_audit_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AuditLog[];
}

// =========================================================================
// DEPARTMENTS API (HR expansion)
// =========================================================================

export async function getDepartments(companyId: string): Promise<Department[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_departments")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Department[];
}

export async function createDepartment(companyId: string, data: Partial<Department>): Promise<Department> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("dept");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_departments")
    .insert({
      id,
      company_id: companyId,
      name: data.name || "",
      description: data.description || null,
      manager: data.manager || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create department: ${error.message}`);
  return record as Department;
}

export async function updateDepartment(id: string, companyId: string, data: Partial<Department>): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase
    .from("corevia_departments")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(`Failed to update department: ${error.message}`);
}

// =========================================================================
// WAREHOUSES API
// =========================================================================

export async function getWarehouses(companyId: string): Promise<Warehouse[]> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data, error } = await supabase
    .from("corevia_warehouses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Warehouse[];
}

export async function createWarehouse(companyId: string, data: Partial<Warehouse>): Promise<Warehouse> {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = generateId("wh");
  const now = new Date().toISOString();
  const { data: record, error } = await supabase
    .from("corevia_warehouses")
    .insert({
      id,
      company_id: companyId,
      name: data.name || "",
      location: data.location || null,
      manager: data.manager || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create warehouse: ${error.message}`);
  return record as Warehouse;
}

// =========================================================================
// REPORTS API
// =========================================================================

export async function getSalesReport(companyId: string, startDate?: string, endDate?: string): Promise<any> {
  if (!supabase) throw new Error("Supabase not initialized");
  let query = supabase
    .from("corevia_orders")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["delivered", "confirmed", "shipped"])
    .order("created_at", { ascending: false });
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }
  const { data, error } = await query;
  if (error) throw error;
  const orders = (data || []) as Order[];
  const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = orders.length;
  return { orders, totalSales, totalOrders };
}

export async function getInventoryReport(companyId: string): Promise<any> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { data: inventory, error: invError } = await supabase
    .from("corevia_inventory")
    .select("*")
    .eq("company_id", companyId);
  if (invError) throw invError;
  const { data: movements, error: movError } = await supabase
    .from("corevia_stock_movements")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (movError) throw movError;
  return {
    inventory: inventory || [],
    recentMovements: movements || [],
    totalItems: (inventory || []).length,
    totalStock: (inventory || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
    lowStockItems: (inventory || []).filter((i: any) => (i.quantity || 0) <= (i.min_stock || 0)),
  };
}

// =========================================================================
// AUTH API
// =========================================================================

export async function getMySession(): Promise<any> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function logout(): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialized");
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Failed to logout: ${error.message}`);
}

// =========================================================================
// HELPERS
// =========================================================================

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

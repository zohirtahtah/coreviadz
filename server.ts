import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : supabase;

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        company_id: string;
        worker_id?: string;
        allowed_pages?: string[];
        user_metadata: Record<string, any>;
        app_metadata: Record<string, any>;
      };
    }
  }
}

interface SseClient {
  id: string;
  res: express.Response;
  companyId: string;
}

let sseClients: SseClient[] = [];

setInterval(() => {
  sseClients.forEach(client => {
    client.res.write(":keepalive\n\n");
  });
}, 15000);

function broadcastToTenant(companyId: string, payload: any) {
  const filtered = sseClients.filter(c => c.companyId === companyId);
  filtered.forEach(client => {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });
}

async function extractUser(token: string): Promise<Express.Request["user"] | null> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata || {};
  const appMeta = data.user.app_metadata || {};
  const ext: Express.Request["user"] = {
    id: data.user.id,
    email: data.user.email || "",
    role: meta.role || appMeta.role || "employee",
    company_id: meta.company_id || appMeta.company_id || "",
    worker_id: meta.worker_id || appMeta.worker_id || undefined,
    allowed_pages: undefined,
    user_metadata: meta,
    app_metadata: appMeta,
  };
  // Fetch worker_id + allowed_pages from company_users if not in metadata
  const db = supabaseServiceKey ? supabaseAdmin : supabase;
  const { data: cu } = await db
    .from("corevia_company_users")
    .select("worker_id,allowed_pages")
    .eq("auth_user_id", ext.id)
    .maybeSingle();
  if (cu) {
    if (!ext.worker_id) ext.worker_id = cu.worker_id;
    ext.allowed_pages = cu.allowed_pages || [];
  } else {
    ext.allowed_pages = [];
  }
  return ext;
}

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : req.cookies?.["sb-access-token"];
  if (!token) return res.status(401).json({ error: "No authorization token provided" });
  const user = await extractUser(token);
  if (!user) return res.status(401).json({ error: "Invalid or expired session" });
  req.user = user;
  next();
};

function requirePermission(code: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ error: "No role assigned" });
    // Admin/owner bypass permission checks
    if (["super_admin", "admin", "owner"].includes(role)) return next();
    const db = supabaseServiceKey ? supabaseAdmin : supabase;
    const workerId = req.user?.worker_id;
    const companyId = req.user?.company_id;
    // 1. Check user-level permissions first (query corevia_user_permissions directly)
    if (workerId && companyId) {
      const { data: permId } = await db.from("corevia_permissions")
        .select("id").eq("code", code).maybeSingle();
      if (permId) {
        const { data: userPerm } = await db
          .from("corevia_user_permissions")
          .select("granted")
          .eq("worker_id", workerId)
          .eq("company_id", companyId)
          .eq("permission_id", permId.id)
          .maybeSingle();
        if (userPerm) {
          if (userPerm.granted) return next();
          else return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
    }
    // 2. Fallback to role-based permissions
    const { data, error } = await db
      .from("corevia_role_permissions")
      .select("corevia_permissions!inner(code)")
      .eq("role", role)
      .eq("corevia_permissions.code", code)
      .maybeSingle();
    if (error || !data) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

function getTenantId(req: express.Request): string {
  const cid = req.user?.company_id || req.user?.user_metadata?.company_id || req.user?.app_metadata?.company_id;
  if (!cid) throw new Error("No tenant context available");
  return cid;
}

app.get("/api/auth/verify-invite", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Token required" });
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_company_users")
      .select("id, email, username, role, invitation_expires_at, invitation_used, corevia_workers!inner(full_name)")
      .eq("invitation_token", token)
      .maybeSingle();
    if (error || !data) return res.status(404).json({ error: "Invalid or expired invitation token" });
    if (data.invitation_used) return res.status(400).json({ error: "Invitation already used" });
    if (new Date(data.invitation_expires_at) < new Date()) return res.status(400).json({ error: "Invitation has expired" });
    res.json({
      valid: true,
      email: data.email,
      username: data.username,
      fullName: (data as any).full_name,
      role: data.role,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/claim-invite", async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (!supabaseServiceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_KEY not configured" });
  try {
    const { data: cu, error: cuErr } = await supabaseAdmin
      .from("corevia_company_users")
      .select("id, auth_user_id, invitation_expires_at, invitation_used, email, username, company_id, role, worker_id, allowed_pages")
      .eq("invitation_token", token)
      .maybeSingle();
    if (cuErr || !cu) return res.status(404).json({ error: "Invalid or expired invitation token" });
    if (cu.invitation_used) return res.status(400).json({ error: "Invitation already used" });
    if (new Date(cu.invitation_expires_at) < new Date()) return res.status(400).json({ error: "Invitation has expired" });

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(cu.auth_user_id, { password });
    if (updateErr) throw updateErr;

    const { error: markErr } = await supabaseAdmin
      .from("corevia_company_users")
      .update({ invitation_used: true, status: "active" })
      .eq("id", cu.id);
    if (markErr) throw markErr;

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cu.email,
      password,
    });
    if (signInErr) throw signInErr;

    res.json({
      success: true,
      session: signInData.session,
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        role: cu.role,
        company_id: cu.company_id,
        username: cu.username,
        worker_id: cu.worker_id,
        allowed_pages: cu.allowed_pages,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function lookupLoginEmail(username?: string, phone?: string): Promise<string | null> {
  if (username) {
    const { data } = await supabaseAdmin
      .from("corevia_company_users")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (data) return data.email;
    const { data: data2 } = await supabaseAdmin
      .from("corevia_saas_users")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (data2) return data2.email;
  }
  if (phone) {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    const { data } = await supabaseAdmin
      .from("corevia_company_users")
      .select("email")
      .eq("phone", cleanPhone)
      .maybeSingle();
    if (data) return data.email;
    const { data: data2 } = await supabaseAdmin
      .from("corevia_saas_users")
      .select("email")
      .eq("phone", cleanPhone)
      .maybeSingle();
    if (data2) return data2.email;
  }
  return null;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password, username, phone } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  let loginEmail = email;

  if (!loginEmail && (username || phone)) {
    loginEmail = await lookupLoginEmail(username, phone) || "";
  }

  if (!loginEmail) return res.status(400).json({ error: "Email or username or phone required" });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (error) throw error;
    const meta = data.user.user_metadata || {};
    const appMeta = data.user.app_metadata || {};
    res.json({
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: meta.role || appMeta.role || "employee",
        company_id: meta.company_id || appMeta.company_id || "",
        username: meta.username || "",
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/auth/logout", async (_req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      company_id: req.user!.company_id,
      user_metadata: req.user!.user_metadata,
      app_metadata: req.user!.app_metadata,
    },
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role,
    company_id: req.user!.company_id,
    user_metadata: req.user!.user_metadata,
    app_metadata: req.user!.app_metadata,
  });
});

app.post("/api/auth/invite-employee", requireAuth, requirePermission("employees.invite"), async (req, res) => {
  const { email, fullName, username, workerId, role, invitationToken } = req.body;
  const companyId = getTenantId(req);
  if (!email) return res.status(400).json({ error: "Email required" });
  if (!workerId) return res.status(400).json({ error: "workerId required" });
  if (!invitationToken) return res.status(400).json({ error: "invitationToken required" });
  if (!supabaseServiceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_KEY not configured" });

  try {
    const { data: worker } = await supabaseAdmin
      .from("corevia_workers")
      .select("id")
      .eq("id", workerId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!worker) return res.status(404).json({ error: "Worker not found" });

    const { count } = await supabaseAdmin
      .from("corevia_company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["active", "read_only"]);

    const { data: company } = await supabaseAdmin
      .from("corevia_companies")
      .select("seats_limit, status")
      .eq("id", companyId)
      .maybeSingle();
    if (!company || company.status !== "active") return res.status(403).json({ error: "Company not active" });

    const seatsLimit = company.seats_limit ?? 5;
    if (count !== null && count >= seatsLimit) {
      return res.status(403).json({ error: `Seat limit reached (${seatsLimit})` });
    }

    const { data: existingUser } = await supabaseAdmin
      .from("corevia_company_users")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (existingUser) return res.status(409).json({ error: "Email already exists in company" });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { company_id: companyId, worker_id: workerId, role: role || "employee", username, full_name: fullName },
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("No user returned from invite");

    const companyUserId = `cu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabaseAdmin.from("corevia_company_users").insert({
      id: companyUserId,
      company_id: companyId,
      worker_id: workerId,
      auth_user_id: authData.user.id,
      email: email.toLowerCase(),
      username: username || "",
      role: role || "employee",
      allowed_pages: [],
      invitation_token: invitationToken,
      invitation_expires_at: expiresAt,
      invitation_used: false,
      status: "active",
    });
    if (insertError) throw insertError;

    await supabaseAdmin.from("corevia_workers").update({ status: "active" }).eq("id", workerId);

    res.json({ authUserId: authData.user.id, companyUserId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workers", requireAuth, requirePermission("employees.view"), async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_workers")
      .select("*")
      .eq("company_id", companyId)
      .is("archived_at", null);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workers", requireAuth, requirePermission("employees.create"), async (req, res) => {
  const companyId = getTenantId(req);
  const { id, full_name, phone, salary, position, hire_date, status } = req.body;
  try {
    if (id) {
      const { error } = await supabaseAdmin
        .from("corevia_workers")
        .update({ full_name, phone, salary, position, hire_date, status })
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw error;
    } else {
      const workerId = `wrk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { error } = await supabaseAdmin
        .from("corevia_workers")
        .insert({ id: workerId, company_id: companyId, full_name, phone, salary, position, hire_date, status: status || "active" });
      if (error) throw error;
      return res.json({ id: workerId });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workers/archive", requireAuth, requirePermission("employees.archive"), async (req, res) => {
  const { id } = req.body;
  const companyId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    await supabaseAdmin
      .from("corevia_workers")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);
    await supabaseAdmin
      .from("corevia_company_users")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("worker_id", id)
      .eq("company_id", companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/company-users", requireAuth, requirePermission("company_users.view"), async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_company_users")
      .select("*, corevia_workers!worker_id(*)")
      .eq("company_id", companyId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-users/delete", requireAuth, requirePermission("company_users.delete"), async (req, res) => {
  const { id } = req.body;
  const companyId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const { error } = await supabaseAdmin
      .from("corevia_company_users")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-users/role", requireAuth, requirePermission("company_users.manage"), async (req, res) => {
  const { id, role } = req.body;
  const companyId = getTenantId(req);
  if (!id || !role) return res.status(400).json({ error: "id and role required" });
  try {
    const { error } = await supabaseAdmin
      .from("corevia_company_users")
      .update({ role })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/company-users/pages", requireAuth, requirePermission("company_users.manage"), async (req, res) => {
  const { id, allowed_pages } = req.body;
  const companyId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const { error } = await supabaseAdmin
      .from("corevia_company_users")
      .update({ allowed_pages })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:orderId/items", requireAuth, requirePermission("orders.view"), async (req, res) => {
  const { orderId } = req.params;
  const companyId = getTenantId(req);
  try {
    const { data: order } = await supabaseAdmin
      .from("corevia_orders")
      .select("id")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!order) return res.status(404).json({ error: "Order not found" });
    const { data, error } = await supabaseAdmin.from("corevia_order_items").select("*").eq("order_id", orderId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders/:orderId/items", requireAuth, requirePermission("orders.edit"), async (req, res) => {
  const { orderId } = req.params;
  const { items } = req.body;
  const companyId = getTenantId(req);
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  try {
    const { data: order } = await supabaseAdmin
      .from("corevia_orders")
      .select("id")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!order) return res.status(404).json({ error: "Order not found" });
    await supabaseAdmin.from("corevia_order_items").delete().eq("order_id", orderId);
    const orderItems = items.map((item: any, idx: number) => ({
      id: `${orderId}_item_${idx}`,
      order_id: orderId,
      product_id: item.product_id || "",
      product_name: item.product_name || "",
      quantity: item.quantity || 1,
      price: item.price || 0,
      subtotal: (item.quantity || 1) * (item.price || 0),
    }));
    const { error } = await supabaseAdmin.from("corevia_order_items").insert(orderItems);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders/:orderId/approve", requireAuth, requirePermission("orders.approve"), async (req, res) => {
  const { orderId } = req.params;
  const companyId = getTenantId(req);
  try {
    const { data: order } = await supabaseAdmin
      .from("corevia_orders")
      .select("id, status")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "cancelled") return res.status(400).json({ error: "Cannot approve a cancelled order" });
    const { error } = await supabaseAdmin
      .from("corevia_orders")
      .update({ status: "approved", approved_by: req.user!.id, approved_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) throw error;
    await supabaseAdmin.from("corevia_audit_log").insert({
      company_id: companyId,
      action: "order.approve",
      entity_type: "order",
      entity_id: orderId,
      performed_by: req.user!.id,
      metadata: { previous_status: order.status },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders/:orderId/cancel", requireAuth, requirePermission("orders.cancel"), async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const companyId = getTenantId(req);
  try {
    const { data: order } = await supabaseAdmin
      .from("corevia_orders")
      .select("id, status")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "approved") return res.status(400).json({ error: "Cannot cancel an approved order" });
    const { error } = await supabaseAdmin
      .from("corevia_orders")
      .update({ status: "cancelled", cancelled_by: req.user!.id, cancelled_at: new Date().toISOString(), cancel_reason: reason || "" })
      .eq("id", orderId);
    if (error) throw error;
    await supabaseAdmin.from("corevia_audit_log").insert({
      company_id: companyId,
      action: "order.cancel",
      entity_type: "order",
      entity_id: orderId,
      performed_by: req.user!.id,
      metadata: { reason: reason || "", previous_status: order.status },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/movement", requireAuth, requirePermission("inventory.movement"), async (req, res) => {
  const companyId = getTenantId(req);
  const { product_id, product_name, movement_type, quantity, reason, reference_type, reference_id } = req.body;
  if (!product_id || !movement_type || !quantity) {
    return res.status(400).json({ error: "product_id, movement_type, and quantity required" });
  }
  try {
    const movementId = `sm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { error } = await supabaseAdmin.from("corevia_stock_movements").insert({
      id: movementId,
      company_id: companyId,
      product_id,
      product_name: product_name || "",
      movement_type,
      quantity: Math.abs(quantity),
      reason: reason || "",
      reference_type: reference_type || "",
      reference_id: reference_id || "",
      created_by: req.user!.id,
    });
    if (error) throw error;
    res.json({ success: true, id: movementId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sync/events", async (req, res) => {
  let token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : req.cookies?.["sb-access-token"];
  if (!token) return res.status(401).end();
  const user = await extractUser(token);
  if (!user) return res.status(401).end();
  const companyId = user.company_id;
  if (!companyId) return res.status(403).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newClient: SseClient = { id: clientId, res, companyId };
  sseClients.push(newClient);

  res.write(`data: ${JSON.stringify({ type: "SYNC_REGISTERED", clientId })}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

app.post("/api/sync/notify", requireAuth, (req, res) => {
  const companyId = getTenantId(req);
  const { eventType } = req.body;
  broadcastToTenant(companyId, {
    type: eventType || "RELOAD_ERP_DATA",
    sender: req.headers["x-client-id"] || "unknown",
  });
  res.json({ success: true });
});

app.get("/api/permissions/check", requireAuth, async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") return res.status(400).json({ error: "code query param required" });
  const role = req.user!.role;
  if (["super_admin", "super-admin", "admin", "owner"].includes(role)) return res.json({ granted: true });
  const db = supabaseServiceKey ? supabaseAdmin : supabase;
  const workerId = req.user!.worker_id;
  const companyId = req.user!.company_id;
  // 1. User-level override
  if (workerId && companyId) {
    const { data: permId } = await db.from("corevia_permissions")
      .select("id").eq("code", code).maybeSingle();
    if (permId) {
      const { data: userPerm } = await db
        .from("corevia_user_permissions")
        .select("granted")
        .eq("worker_id", workerId)
        .eq("company_id", companyId)
        .eq("permission_id", permId.id)
        .maybeSingle();
      if (userPerm) return res.json({ granted: userPerm.granted });
    }
  }
  // 2. Role-based fallback
  const { data } = await db
    .from("corevia_role_permissions")
    .select("corevia_permissions!inner(code)")
    .eq("role", role)
    .eq("corevia_permissions.code", code)
    .maybeSingle();
  res.json({ granted: !!data });
});

app.get("/api/permissions/my", requireAuth, async (req, res) => {
  const role = req.user!.role;
  const db = supabaseServiceKey ? supabaseAdmin : supabase;
  const { data } = await db
    .from("corevia_role_permissions")
    .select("corevia_permissions(code, name, description)")
    .eq("role", role);
  res.json((data || []).map((r: any) => r.corevia_permissions));
});

app.get("/api/warehouses", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_warehouses")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/warehouses", requireAuth, requirePermission("warehouses.create"), async (req, res) => {
  const companyId = getTenantId(req);
  const { name, location, code } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { error } = await supabaseAdmin.from("corevia_warehouses").insert({
      id, company_id: companyId, name, location: location || "", code: code || "",
    });
    if (error) throw error;
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/warehouse-stock", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_warehouse_stock")
      .select("*, corevia_warehouses(name, location)")
      .eq("company_id", companyId);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/warehouse-transfers", requireAuth, requirePermission("warehouses.transfer"), async (req, res) => {
  const companyId = getTenantId(req);
  const { from_warehouse_id, to_warehouse_id, product_id, quantity, reason } = req.body;
  if (!from_warehouse_id || !to_warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: "from_warehouse_id, to_warehouse_id, product_id, and quantity required" });
  }
  try {
    const id = `wt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { error } = await supabaseAdmin.from("corevia_warehouse_transfers").insert({
      id, company_id: companyId, from_warehouse_id, to_warehouse_id, product_id,
      quantity: Math.abs(quantity), reason: reason || "", status: "pending",
      created_by: req.user!.id,
    });
    if (error) throw error;
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/audit-log", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  const { entity_type, entity_id, action, limit, offset } = req.query;
  try {
    let query = supabaseAdmin
      .from("corevia_audit_log")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (entity_type && typeof entity_type === "string") query = query.eq("entity_type", entity_type);
    if (entity_id && typeof entity_id === "string") query = query.eq("entity_id", entity_id);
    if (action && typeof action === "string") query = query.eq("action", action);
    query = query.range(0, Math.min(Math.max(parseInt(String(limit || "50")), 1), 200) - 1);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_notifications")
      .select("*")
      .eq("company_id", companyId)
      .or(`user_id.eq.${req.user!.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/read", requireAuth, async (req, res) => {
  const { id } = req.body;
  const companyId = getTenantId(req);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const { error } = await supabaseAdmin
      .from("corevia_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chart-of-accounts", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_chart_of_accounts")
      .select("*")
      .eq("company_id", companyId)
      .order("code", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/journal-entries", requireAuth, requirePermission("accounting.journal"), async (req, res) => {
  const companyId = getTenantId(req);
  const { entry_date, description, lines, reference } = req.body;
  if (!entry_date || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "entry_date and lines array required" });
  }
  try {
    const id = `je_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { error } = await supabaseAdmin.from("corevia_journal_entries").insert({
      id, company_id: companyId, entry_date, description: description || "",
      reference: reference || "", lines, created_by: req.user!.id,
      status: "posted",
    });
    if (error) throw error;
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/sales", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  const { from, to, group_by } = req.query;
  try {
    let query = supabaseAdmin
      .from("corevia_orders")
      .select("id, total, status, created_at, company_id")
      .eq("company_id", companyId)
      .in("status", ["approved", "completed"]);
    if (from && typeof from === "string") query = query.gte("created_at", from);
    if (to && typeof to === "string") query = query.lte("created_at", to);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ records: data || [], total: (data || []).reduce((s: number, r: any) => s + (Number(r.total) || 0), 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/inventory", requireAuth, async (req, res) => {
  const companyId = getTenantId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from("corevia_stock_movements")
      .select("product_id, product_name, movement_type, quantity, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

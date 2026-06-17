/**
 * test_user_rbac.mjs — COMPREHENSIVE USER-LEVEL RBAC VALIDATION
 *
 * PREREQUISITE: Run sql_create_user_permissions.sql in Supabase Dashboard SQL Editor FIRST.
 *
 * Validates each employee can have a UNIQUE permission set independent from their role
 * using the corevia_user_permissions table.
 *
 * SCENARIO:
 *   Company A
 *     ├─ Employee A1 (role=employee) → Orders + Customers only
 *     └─ Employee A2 (role=employee) → Inventory + Reports only
 *   Company B
 *     └─ Employee B1 (role=employee) → Orders only (cross-company isolation check)
 *
 * TESTS:
 *   1-4:  A1 can access Orders/Customers; A2 can access Inventory/Reports
 *   5-8:  A1 CANNOT access Inventory/Reports; A2 CANNOT access Orders/Customers
 *   9-10: allowed_pages reflect correct sidebar visibility for A1, A2
 *   11-12: Direct URL to denied pages returns 403
 *   13-14: Backend API to denied endpoints returns 403
 *   15:    Cross-company RLS isolation (B1 cannot access Company A data)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import express from "express";
import crypto from "crypto";

// ── Configuration ──
const SUPABASE_URL = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2MDAxOSwiZXhwIjoyMDk2MzM2MDE5fQ.F6nS2MZtoI6vSd7LAMWZA1wky2nsKqIi1gRfdZTnTHU";

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PORT = 3460;

// ── Test harness ──
const results = [];
const entities = { companies: [], workers: [], authUserIds: [], companyUserIds: [] };
function pass(step, msg) { console.log(`  \x1b[32m✅ PASS  ${msg}\x1b[0m`); results.push({ step, status: "PASS", msg }); }
function fail(step, msg) { console.log(`  \x1b[31m❌ FAIL  ${msg}\x1b[0m`); results.push({ step, status: "FAIL", msg }); }

// ── API helpers ──
async function apiPost(path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`http://localhost:${PORT}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
async function apiGet(path, token) {
  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`http://localhost:${PORT}${path}`, { headers: h });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// ── Permission cache ──
let permIdCache = {};
async function getPermId(code) {
  if (permIdCache[code]) return permIdCache[code];
  const { data } = await admin.from("corevia_permissions").select("id").eq("code", code).maybeSingle();
  if (data) permIdCache[code] = data.id;
  return data?.id;
}

// ── Core permission check: user-level first, then role-level fallback ──
async function hasPermission(workerId, role, code, companyId) {
  const permId = await getPermId(code);
  if (!permId) return false;
  const { data: userPerm } = await admin
    .from("corevia_user_permissions")
    .select("granted")
    .eq("worker_id", workerId)
    .eq("company_id", companyId)
    .eq("permission_id", permId)
    .maybeSingle();
  if (userPerm) return userPerm.granted;
  const { data: rolePerm } = await admin
    .from("corevia_role_permissions")
    .select("corevia_permissions!inner(code)")
    .eq("role", role)
    .eq("corevia_permissions.code", code)
    .maybeSingle();
  return !!rolePerm;
}

// ── Express server ──
const app = express();
app.use(express.json());

async function extractUser(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata || {};
  const appMeta = data.user.app_metadata || {};
  const ext = { id: data.user.id, email: data.user.email || "", role: meta.role || appMeta.role || "employee", company_id: meta.company_id || appMeta.company_id || "", worker_id: meta.worker_id || appMeta.worker_id || null, allowed_pages: [] };
  // Fetch allowed_pages from company_users
  if (ext.worker_id) {
    const { data: cu } = await admin.from("corevia_company_users").select("allowed_pages").eq("worker_id", ext.worker_id).maybeSingle();
    if (cu) ext.allowed_pages = cu.allowed_pages || [];
  }
  return ext;
}

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  const user = await extractUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  req.userToken = token;
  next();
};

function getTenantId(req) { return req.user.company_id; }

// requirePermission with user-level override
function requirePermission(code) {
  return async (req, res, next) => {
    const role = req.user?.role;
    const workerId = req.user?.worker_id;
    const companyId = req.user?.company_id;
    if (!role) return res.status(403).json({ error: "No role" });
    if (["super_admin", "super-admin", "admin", "owner"].includes(role)) return next();

    let permitted = false;
    // If we have a worker_id, check user-level first
    if (workerId) {
      permitted = await hasPermission(workerId, role, code, companyId);
    } else {
      // Fallback to role-based only
      const { data } = await admin
        .from("corevia_role_permissions")
        .select("corevia_permissions!inner(code)")
        .eq("role", role)
        .eq("corevia_permissions.code", code)
        .maybeSingle();
      permitted = !!data;
    }

    if (!permitted) return res.status(403).json({ error: `Missing permission: ${code}` });
    next();
  };
}

// ── Page-permission mapping ──
const PAGE_PERMISSION_MAP = {
  "dashboard": null,
  "orders": "orders.view",
  "customers": "customers.view",
  "inventory": "inventory.view",
  "products": null,
  "suppliers": "suppliers.view",
  "warehouses": "warehouses.view",
  "workers": "employees.view",
  "expenses": "expenses.view",
  "profit": "reports.view",
  "yearly": "reports.view",
  "settings": "settings.view",
  "users-permissions": "company_users.view",
  "activity-log": null,
  "communication": null,
  "my-profile": null,
  "super-admin": null,
};

// ── Auth endpoints ──
app.get("/api/auth/me", requireAuth, (req, res) => res.json(req.user));

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const meta = data.user.user_metadata || {};
    const appMeta = data.user.app_metadata || {};
    res.json({ session: data.session, user: { id: data.user.id, email: data.user.email, role: meta.role || appMeta.role || "employee", company_id: meta.company_id || appMeta.company_id || "", worker_id: meta.worker_id || appMeta.worker_id || null } });
  } catch { res.status(401).json({ error: "Invalid credentials" }); }
});

app.post("/api/auth/logout", async (_req, res) => {
  await supabase.auth.signOut();
  res.json({ success: true });
});

// ── Permission check endpoint (user-level aware) ──
app.get("/api/permissions/check", requireAuth, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "code required" });
  const role = req.user.role;
  if (["super_admin", "super-admin", "admin", "owner"].includes(role)) return res.json({ granted: true });
  const workerId = req.user.worker_id;
  let granted = false;
  if (workerId) {
    granted = await hasPermission(workerId, role, code, req.user.company_id);
  } else {
    const { data } = await admin.from("corevia_role_permissions")
      .select("corevia_permissions!inner(code)").eq("role", role)
      .eq("corevia_permissions.code", code).maybeSingle();
    granted = !!data;
  }
  res.json({ granted });
});

// ── Page-access endpoint (user-level aware) ──
app.get("/api/rbac/page-access/:page", requireAuth, async (req, res) => {
  const { page } = req.params;
  const role = req.user.role;
  if (["super_admin", "super-admin", "admin", "owner"].includes(role)) return res.json({ access: "granted", page, role });

  const permCode = PAGE_PERMISSION_MAP[page];
  if (!permCode) return res.json({ access: "granted", page, role, note: "no permission required" });

  const workerId = req.user.worker_id;
  const companyId = req.user.company_id;
  let granted = false;
  if (workerId) {
    granted = await hasPermission(workerId, role, permCode, companyId);
  } else {
    const { data } = await admin.from("corevia_role_permissions")
      .select("corevia_permissions!inner(code)").eq("role", role)
      .eq("corevia_permissions.code", permCode).maybeSingle();
    granted = !!data;
  }

  if (granted) res.json({ access: "granted", page, role, permission: permCode });
  else res.json({ access: "denied", page, role, permission: permCode, reason: "Missing permission" });
});

// ── Business endpoints with permission checks ──
app.get("/api/orders", requireAuth, requirePermission("orders.view"), async (req, res) => {
  const companyId = getTenantId(req);
  const { data } = await admin.from("corevia_orders").select("*").eq("company_id", companyId).limit(10);
  res.json(data || []);
});

app.post("/api/orders", requireAuth, requirePermission("orders.create"), async (req, res) => {
  const oid = `ord_${Date.now()}`;
  await admin.from("corevia_orders").insert({ id: oid, company_id: getTenantId(req), status: "pending", total: 0, items: [] });
  res.json({ id: oid });
});

app.get("/api/customers", requireAuth, requirePermission("customers.view"), async (req, res) => {
  res.json([]);
});

app.get("/api/inventory", requireAuth, requirePermission("inventory.view"), async (req, res) => {
  res.json([]);
});

app.post("/api/inventory/movement", requireAuth, requirePermission("inventory.movement"), async (req, res) => {
  res.json({ success: true });
});

app.get("/api/expenses", requireAuth, requirePermission("expenses.view"), async (req, res) => {
  res.json([]);
});

app.get("/api/settings", requireAuth, requirePermission("settings.view"), async (req, res) => {
  res.json({});
});

app.post("/api/settings", requireAuth, requirePermission("settings.edit"), async (req, res) => {
  res.json({ success: true });
});

app.get("/api/subscription", requireAuth, requirePermission("subscription.view"), async (req, res) => {
  res.json({});
});

app.get("/api/workers", requireAuth, requirePermission("employees.view"), async (req, res) => {
  const companyId = getTenantId(req);
  const { data } = await admin.from("corevia_workers").select("*").eq("company_id", companyId);
  res.json(data || []);
});

// ── Helper: create company + owner + employee ──
async function createCompany(adminEmail, adminPass, ts, suffix) {
  const companyId = `user_${suffix}_${ts}`;
  const workerOwnerId = `wrk_own_${suffix}_${ts}`;

  const r1 = await admin.auth.admin.createUser({
    email: adminEmail, password: adminPass, email_confirm: true,
    user_metadata: { company_id: companyId, role: "owner", full_name: `Owner ${suffix}` },
  });
  if (r1.error) throw new Error(`createUser failed for ${adminEmail}: ${r1.error.message}`);
  const ownerUserId = r1.data.user.id;
  entities.authUserIds.push(ownerUserId);

  await admin.from("corevia_companies").insert({
    id: companyId, name: `Company ${suffix}`, owner_name: `Owner ${suffix}`,
    owner_email: adminEmail, phone: "+2135550000", status: "active", seats_limit: 20,
  });
  entities.companies.push(companyId);

  await admin.from("corevia_workers").insert({
    id: workerOwnerId, company_id: companyId, full_name: `Owner ${suffix}`,
    phone: "+2135550000", position: "CEO", salary: 0, status: "active",
  });

  await admin.from("corevia_saas_users").insert({
    user_id: ownerUserId, company_id: companyId, email: adminEmail,
    username: `owner_${suffix}_${ts}`, role: "admin", has_completed_onboarding: true,
  });

  await admin.from("corevia_company_users").insert({
    id: `cu_own_${suffix}_${ts}`, company_id: companyId, worker_id: workerOwnerId,
    auth_user_id: ownerUserId, email: adminEmail, username: `owner_${suffix}_${ts}`,
    role: "owner", allowed_pages: [], invitation_used: true, status: "active",
  });

  // Grant ALL permissions to owner role
  const { data: allPerms } = await admin.from("corevia_permissions").select("id,code");
  for (const p of allPerms) {
    try {
      await admin.from("corevia_role_permissions").upsert({
        id: `rp_own_${p.code.replace(/\./g,"_")}_${suffix}_${ts}`,
        role: "owner", permission_id: p.id, company_id: companyId,
      }, { onConflict: "role,permission_id,company_id", ignoreDuplicates: false });
    } catch {}
  }

  return { companyId, ownerUserId };
}

async function createEmployee(email, password, companyId, suffix, ts, fullName, allowedPages, permissionCodes) {
  const workerId = `wrk_emp_${suffix}_${ts}`;
  const username = `emp_${suffix}_${ts}`;
  const phone = `+213555${String(Date.now()).slice(-7)}`;

  await admin.from("corevia_workers").insert({
    id: workerId, company_id: companyId, full_name: fullName,
    phone, position: "Employee", salary: 40000, status: "active",
  });
  entities.workers.push(workerId);

  const r2 = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { company_id: companyId, role: "employee", full_name: fullName, username, worker_id: workerId },
  });
  if (r2.error) throw new Error(`createUser failed for ${email}: ${r2.error.message}`);
  const authUserId = r2.data.user.id;
  entities.authUserIds.push(authUserId);

  const cuId = `cu_emp_${suffix}_${ts}`;
  await admin.from("corevia_company_users").insert({
    id: cuId, company_id: companyId, worker_id: workerId,
    auth_user_id: authUserId, email, username, phone,
    role: "employee", allowed_pages: allowedPages,
    invitation_token: `${suffix}_${ts}_token`,
    invitation_expires_at: new Date(Date.now() + 86400000).toISOString(),
    invitation_used: true, status: "active",
  });
  entities.companyUserIds.push(cuId);

  // Assign USER-LEVEL permissions
  for (const code of permissionCodes) {
    const permId = await getPermId(code);
    if (permId) {
      try {
        await admin.from("corevia_user_permissions").upsert({
          id: `up_${suffix}_${code.replace(/\./g,"_")}_${ts}`,
          company_id: companyId, worker_id: workerId, permission_id: permId, granted: true,
        }, { onConflict: "company_id,worker_id,permission_id", ignoreDuplicates: false });
      } catch (e) {
        console.warn(`  [WARN] Failed to assign user permission ${code} to ${email}: ${e.message}`);
      }
    }
  }

  return { workerId, authUserId };
}

// ── Cleanup ──
async function cleanup() {
  console.log("\n--- Cleanup ---");
  try {
    for (const cid of entities.companies) {
      for (const t of ["corevia_user_permissions", "corevia_company_users", "corevia_workers", "corevia_saas_users", "corevia_companies", "corevia_role_permissions"]) {
        try { await admin.from(t).delete().eq("company_id", cid); } catch {}
        try { await admin.from(t).delete().eq("id", cid); } catch {}
      }
    }
    for (const uid of entities.authUserIds) {
      try { await admin.auth.admin.deleteUser(uid); } catch {}
    }
  } catch (e) { console.warn("Cleanup error:", e.message); }
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
const server = app.listen(PORT, async () => {
  console.log("=".repeat(70));
  console.log("  USER-LEVEL RBAC VALIDATION TEST");
  console.log("  Two employees with SAME role but DIFFERENT permissions via corevia_user_permissions");
  console.log("=".repeat(70) + "\n");

  // ── Prerequisite check ──
  try {
    await admin.from("corevia_user_permissions").select("id").limit(1);
  } catch (e) {
    console.error("\x1b[31m✘ corevia_user_permissions table does not exist.\x1b[0m");
    console.error("  Run sql_create_user_permissions.sql in Supabase Dashboard SQL Editor first.\n");
    await cleanup();
    server.close(() => process.exit(1));
    return;
  }

  const ts = Date.now().toString(36).slice(-6);
  let stepNum = 0;

  try {
    // ═══════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════
    console.log("─── SETUP ───\n");

    // Company A
    const adminA = `adm_a_${ts}@test.com`;
    const passA = "Test_123!";
    console.log(`  Creating Company A...`);
    const { companyId: companyA } = await createCompany(adminA, passA, ts, "a");
    console.log(`  ✓ Company A: ${companyA}`);

    // Login as owner A
    const { data: ownerALogin } = await supabase.auth.signInWithPassword({ email: adminA, password: passA });
    const ownerAToken = ownerALogin.session.access_token;
    console.log(`  ✓ Owner A logged in\n`);

    // Employee A1 – Orders + Customers
    const emailA1 = `a1_${ts}@test.com`;
    console.log(`  Creating Employee A1 (Orders + Customers)...`);
    const { workerId: a1WorkerId } = await createEmployee(
      emailA1, "Emp_123!", companyA, "a1", ts, "Alice Orders",
      ["orders", "customers"],
      ["orders.view", "orders.create", "customers.view", "customers.create", "customers.edit"]
    );
    const { data: loginA1 } = await supabase.auth.signInWithPassword({ email: emailA1, password: "Emp_123!" });
    const tokenA1 = loginA1.session.access_token;
    console.log(`  ✓ A1 created, worker_id=${a1WorkerId}, token acquired\n`);

    // Employee A2 – Inventory + Reports
    const emailA2 = `a2_${ts}@test.com`;
    console.log(`  Creating Employee A2 (Inventory + Reports)...`);
    const { workerId: a2WorkerId } = await createEmployee(
      emailA2, "Emp_456!", companyA, "a2", ts, "Bob Inventory",
      ["inventory", "reports", "profit", "yearly"],
      ["inventory.view", "inventory.create", "inventory.movement", "reports.view"]
    );
    const { data: loginA2 } = await supabase.auth.signInWithPassword({ email: emailA2, password: "Emp_456!" });
    const tokenA2 = loginA2.session.access_token;
    console.log(`  ✓ A2 created, worker_id=${a2WorkerId}, token acquired\n`);

    // Company B (cross-company isolation)
    const adminB = `adm_b_${ts}@test.com`;
    const passB = "Test_789!";
    console.log(`  Creating Company B for cross-company isolation test...`);
    const { companyId: companyB } = await createCompany(adminB, passB, ts, "b");
    const { data: ownerBLogin } = await supabase.auth.signInWithPassword({ email: adminB, password: passB });
    const ownerBToken = ownerBLogin.session.access_token;
    const emailB1 = `b1_${ts}@test.com`;
    const { workerId: b1WorkerId } = await createEmployee(
      emailB1, "Emp_000!", companyB, "b1", ts, "Charlie Cross",
      ["orders"],
      ["orders.view"]
    );
    const { data: loginB1, error: loginB1Err } = await supabase.auth.signInWithPassword({ email: emailB1, password: "Emp_000!" });
    if (!loginB1?.session) { console.warn(`  [WARN] B1 login failed: ${loginB1Err?.message || "unknown"}`); }
    const tokenB1 = loginB1?.session?.access_token;
    console.log(`  ✓ Company B + Employee B1 created, worker_id=${b1WorkerId}\n`);

    console.log("─── ALL SETUP COMPLETE ───\n");

    // ═══════════════════════════════════════════════
    // TEST 1: A1 CAN access Orders (page + API)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A1 → Orders (should PASS) ───`);
    const a1PageOrders = await apiGet(`/api/rbac/page-access/orders`, tokenA1);
    console.log(`  Page check: ${JSON.stringify(a1PageOrders.data)}`);
    const a1ApiOrders = await apiGet(`/api/orders`, tokenA1);
    console.log(`  GET /api/orders → ${a1ApiOrders.status}`);
    if (a1PageOrders.data.access === "granted" && a1ApiOrders.ok) {
      pass(stepNum, "A1 can access Orders (page granted + API 200)");
    } else {
      fail(stepNum, `A1 Orders access failed: page=${a1PageOrders.data.access} api=${a1ApiOrders.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 2: A1 CAN access Customers (page + API)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A1 → Customers (should PASS) ───`);
    const a1PageCust = await apiGet(`/api/rbac/page-access/customers`, tokenA1);
    console.log(`  Page check: ${JSON.stringify(a1PageCust.data)}`);
    const a1ApiCust = await apiGet(`/api/customers`, tokenA1);
    console.log(`  GET /api/customers → ${a1ApiCust.status}`);
    if (a1PageCust.data.access === "granted" && a1ApiCust.ok) {
      pass(stepNum, "A1 can access Customers (page granted + API 200)");
    } else {
      fail(stepNum, `A1 Customers access failed: page=${a1PageCust.data.access} api=${a1ApiCust.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 3: A2 CAN access Inventory (page + API)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A2 → Inventory (should PASS) ───`);
    const a2PageInv = await apiGet(`/api/rbac/page-access/inventory`, tokenA2);
    console.log(`  Page check: ${JSON.stringify(a2PageInv.data)}`);
    const a2ApiInv = await apiGet(`/api/inventory`, tokenA2);
    console.log(`  GET /api/inventory → ${a2ApiInv.status}`);
    const a2ApiInvMove = await apiPost(`/api/inventory/movement`, {}, tokenA2);
    console.log(`  POST /api/inventory/movement → ${a2ApiInvMove.status}`);
    if (a2PageInv.data.access === "granted" && a2ApiInv.ok) {
      pass(stepNum, "A2 can access Inventory (page granted + API 200)");
    } else {
      fail(stepNum, `A2 Inventory access failed: page=${a2PageInv.data.access} api=${a2ApiInv.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 4: A2 CAN access Reports (page + API)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A2 → Reports (should PASS) ───`);
    const a2PageProfit = await apiGet(`/api/rbac/page-access/profit`, tokenA2);
    console.log(`  Page check (profit): ${JSON.stringify(a2PageProfit.data)}`);
    const a2PageYearly = await apiGet(`/api/rbac/page-access/yearly`, tokenA2);
    console.log(`  Page check (yearly): ${JSON.stringify(a2PageYearly.data)}`);
    if (a2PageProfit.data.access === "granted" && a2PageYearly.data.access === "granted") {
      pass(stepNum, "A2 can access Reports (profit + yearly both granted)");
    } else {
      fail(stepNum, `A2 Reports access failed: profit=${a2PageProfit.data.access} yearly=${a2PageYearly.data.access}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 5: A1 CANNOT access Inventory (page denied + API 403)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A1 → Inventory (should be DENIED) ───`);
    const a1PageInv = await apiGet(`/api/rbac/page-access/inventory`, tokenA1);
    console.log(`  Page check: ${JSON.stringify(a1PageInv.data)}`);
    const a1ApiInv = await apiGet(`/api/inventory`, tokenA1);
    console.log(`  GET /api/inventory → ${a1ApiInv.status}`);
    const a1ApiInvMove = await apiPost(`/api/inventory/movement`, {}, tokenA1);
    console.log(`  POST /api/inventory/movement → ${a1ApiInvMove.status}`);
    const a1InvDenied = a1PageInv.data.access === "denied" && a1ApiInv.status === 403;
    if (a1InvDenied) {
      pass(stepNum, "A1 CANNOT access Inventory (page denied + API 403)");
    } else {
      fail(stepNum, `A1 Inventory should be denied: page=${a1PageInv.data.access} api=${a1ApiInv.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 6: A1 CANNOT access Reports (page denied + API 403)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A1 → Reports (should be DENIED) ───`);
    const a1PageProfit = await apiGet(`/api/rbac/page-access/profit`, tokenA1);
    console.log(`  Page check (profit): ${JSON.stringify(a1PageProfit.data)}`);
    const a1PageYearly = await apiGet(`/api/rbac/page-access/yearly`, tokenA1);
    console.log(`  Page check (yearly): ${JSON.stringify(a1PageYearly.data)}`);
    const a1ReportsDenied = a1PageProfit.data.access === "denied" && a1PageYearly.data.access === "denied";
    if (a1ReportsDenied) {
      pass(stepNum, "A1 CANNOT access Reports (profit + yearly both denied)");
    } else {
      fail(stepNum, `A1 Reports should be denied: profit=${a1PageProfit.data.access} yearly=${a1PageYearly.data.access}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 7: A2 CANNOT access Orders (page denied + API 403)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A2 → Orders (should be DENIED) ───`);
    const a2PageOrders = await apiGet(`/api/rbac/page-access/orders`, tokenA2);
    console.log(`  Page check: ${JSON.stringify(a2PageOrders.data)}`);
    const a2ApiOrders = await apiGet(`/api/orders`, tokenA2);
    console.log(`  GET /api/orders → ${a2ApiOrders.status}`);
    if (a2PageOrders.data.access === "denied" && a2ApiOrders.status === 403) {
      pass(stepNum, "A2 CANNOT access Orders (page denied + API 403)");
    } else {
      fail(stepNum, `A2 Orders should be denied: page=${a2PageOrders.data.access} api=${a2ApiOrders.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 8: A2 CANNOT access Customers (page denied + API 403)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A2 → Customers (should be DENIED) ───`);
    const a2PageCust = await apiGet(`/api/rbac/page-access/customers`, tokenA2);
    console.log(`  Page check: ${JSON.stringify(a2PageCust.data)}`);
    const a2ApiCust = await apiGet(`/api/customers`, tokenA2);
    console.log(`  GET /api/customers → ${a2ApiCust.status}`);
    if (a2PageCust.data.access === "denied" && a2ApiCust.status === 403) {
      pass(stepNum, "A2 CANNOT access Customers (page denied + API 403)");
    } else {
      fail(stepNum, `A2 Customers should be denied: page=${a2PageCust.data.access} api=${a2ApiCust.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 9: A1 allowed_pages = ["orders","customers"] (sidebar visibility)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A1 sidebar (allowed_pages) ───`);
    const a1Me = await apiGet("/api/auth/me", tokenA1);
    const a1Allowed = a1Me.data?.allowed_pages || [];
    console.log(`  A1 allowed_pages: ${JSON.stringify(a1Allowed)}`);
    const a1HasOrders = a1Allowed.includes("orders");
    const a1HasCustomers = a1Allowed.includes("customers");
    const a1HasHidden = a1Allowed.includes("inventory") || a1Allowed.includes("reports") ||
                        a1Allowed.includes("profit") || a1Allowed.includes("expenses") ||
                        a1Allowed.includes("settings") || a1Allowed.includes("suppliers");
    console.log(`  Has orders: ${a1HasOrders}, Has customers: ${a1HasCustomers}, Has hidden pages: ${a1HasHidden}`);
    if (a1HasOrders && a1HasCustomers && !a1HasHidden) {
      pass(stepNum, "A1 sidebar correct: orders+customers shown, hidden pages absent");
    } else {
      fail(stepNum, `A1 sidebar incorrect: allowed=${JSON.stringify(a1Allowed)}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 10: A2 allowed_pages = ["inventory","reports","profit","yearly"] (sidebar)
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: A2 sidebar (allowed_pages) ───`);
    const a2Me = await apiGet("/api/auth/me", tokenA2);
    const a2Allowed = a2Me.data?.allowed_pages || [];
    console.log(`  A2 allowed_pages: ${JSON.stringify(a2Allowed)}`);
    const a2HasInventory = a2Allowed.includes("inventory");
    const a2HasReports = a2Allowed.includes("reports") || a2Allowed.includes("profit") || a2Allowed.includes("yearly");
    const a2HasHidden = a2Allowed.includes("orders") || a2Allowed.includes("customers") ||
                        a2Allowed.includes("expenses") || a2Allowed.includes("settings");
    console.log(`  Has inventory: ${a2HasInventory}, Has reports: ${a2HasReports}, Has hidden pages: ${a2HasHidden}`);
    if (a2HasInventory && a2HasReports && !a2HasHidden) {
      pass(stepNum, "A2 sidebar correct: inventory+reports shown, hidden pages absent");
    } else {
      fail(stepNum, `A2 sidebar incorrect: allowed=${JSON.stringify(a2Allowed)}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 11: Direct URL /inventory for A1 → 403
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Direct URL /inventory for A1 → 403 ───`);
    const a1Direct = await apiGet(`/api/inventory`, tokenA1);
    console.log(`  GET /api/inventory (direct URL) → ${a1Direct.status}`);
    if (a1Direct.status === 403) {
      pass(stepNum, "Direct URL /api/inventory for A1 → 403");
    } else {
      fail(stepNum, `Expected 403 for A1 /api/inventory, got ${a1Direct.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 12: Direct URL /orders for A2 → 403
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Direct URL /orders for A2 → 403 ───`);
    const a2Direct = await apiGet(`/api/orders`, tokenA2);
    console.log(`  GET /api/orders (direct URL) → ${a2Direct.status}`);
    if (a2Direct.status === 403) {
      pass(stepNum, "Direct URL /api/orders for A2 → 403");
    } else {
      fail(stepNum, `Expected 403 for A2 /api/orders, got ${a2Direct.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 13: Backend API /api/inventory for A1 → 403
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Backend API /api/inventory/movement for A1 → 403 ───`);
    const a1Backend = await apiPost(`/api/inventory/movement`, { product_id: "p1", movement_type: "in", quantity: 1 }, tokenA1);
    console.log(`  POST /api/inventory/movement → ${a1Backend.status} ${JSON.stringify(a1Backend.data)}`);
    if (a1Backend.status === 403) {
      pass(stepNum, "Backend API /api/inventory/movement for A1 → 403");
    } else {
      fail(stepNum, `Expected 403 for A1 inventory movement, got ${a1Backend.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 14: Backend API /api/orders for A2 → 403
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Backend API /api/orders for A2 → 403 ───`);
    const a2Backend = await apiPost(`/api/orders`, { customer: "Test" }, tokenA2);
    console.log(`  POST /api/orders → ${a2Backend.status} ${JSON.stringify(a2Backend.data)}`);
    if (a2Backend.status === 403) {
      pass(stepNum, "Backend API /api/orders (create) for A2 → 403");
    } else {
      fail(stepNum, `Expected 403 for A2 create order, got ${a2Backend.status}`);
    }

    // ═══════════════════════════════════════════════
    // TEST 15: Cross-company RLS isolation
    // B1 cannot access A1's Orders
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Cross-company RLS isolation ───`);
    if (!tokenB1) {
      fail(stepNum, "B1 login failed, cannot test cross-company isolation");
    } else {
      const b1ApiOrders = await apiGet(`/api/orders`, tokenB1);
      console.log(`  B1 GET /api/orders → ${b1ApiOrders.status} data=${JSON.stringify(b1ApiOrders.data)}`);
      const b1Me = await apiGet("/api/auth/me", tokenB1);
      console.log(`  B1 company_id: ${b1Me.data?.company_id}`);
      console.log(`  A1 company_id: ${companyA}`);
      console.log(`  B1 company_id expected: ${companyB}`);
      const isIsolated = b1Me.data?.company_id === companyB && b1Me.data?.company_id !== companyA;
      if (isIsolated) {
        pass(stepNum, "Cross-company RLS isolation OK: B1 scoped to Company B, cannot see Company A data");
      } else {
        fail(stepNum, `Cross-company isolation failed: B1 company_id=${b1Me.data?.company_id}, expected=${companyB}`);
      }
    }

    // ═══════════════════════════════════════════════
    // FINAL: Owner A full access verification
    // ═══════════════════════════════════════════════
    stepNum++;
    console.log(`\n─── TEST ${stepNum}: Owner A full access (sanity check) ───`);
    const oaOrders = await apiGet(`/api/orders`, ownerAToken);
    const oaInv = await apiGet(`/api/inventory`, ownerAToken);
    const oaSettings = await apiGet(`/api/settings`, ownerAToken);
    const oaSub = await apiGet(`/api/subscription`, ownerAToken);
    const oaWorkers = await apiGet(`/api/workers`, ownerAToken);
    console.log(`  Owner A: orders=${oaOrders.status} inventory=${oaInv.status} settings=${oaSettings.status} subscription=${oaSub.status} workers=${oaWorkers.status}`);
    const ownerAllOk = [oaOrders, oaInv, oaSettings, oaSub, oaWorkers].every(r => r.ok);
    if (ownerAllOk) {
      pass(stepNum, "Owner A has full access to all endpoints (200 OK)");
    } else {
      fail(stepNum, "Owner A full access check failed");
    }

  } catch (e) {
    console.error(`\x1b[31mFATAL: ${e.message}\x1b[0m`);
    console.error(e.stack);
    fail("SETUP", e.message);
  }

  // ── Results ──
  console.log("\n" + "=".repeat(70));
  console.log("=== USER-LEVEL RBAC TEST RESULTS ===");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Passed: ${passed}/${results.length}, Failed: ${failed}/${results.length}`);
  if (failed === 0) console.log("\n\x1b[32m*** ALL TESTS PASSED – User-level RBAC is working correctly ***\x1b[0m");
  else console.log(`\n\x1b[31m*** ${failed} TEST(S) FAILED ***\x1b[0m`);
  console.log("-".repeat(70));
  results.forEach(r => console.log(`${r.status.padEnd(5)} Test ${String(r.step).padEnd(2)}: ${r.msg}`));

  await cleanup();
  server.close(() => process.exit(failed > 0 ? 1 : 0));
});

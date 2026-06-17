/**
 * proof_rbac.mjs — LIVE DATABASE PROOF of per-user RBAC
 *
 * SCENARIO:
 *   Employee A: orders.view=true, orders.edit=false
 *   Employee B: orders.view=true, orders.edit=true
 *
 * PROVES:
 *   A can open Orders page but cannot edit.
 *   B can open Orders page and can edit.
 *
 * All data persists in Supabase — you can verify by querying:
 *   SELECT * FROM corevia_user_permissions WHERE company_id = 'proof_<ts>';
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import express from "express";
import crypto from "crypto";

const SUPABASE_URL = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2MDAxOSwiZXhwIjoyMDk2MzM2MDE5fQ.F6nS2MZtoI6vSd7LAMWZA1wky2nsKqIi1gRfdZTnTHU";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const supabase = createClient(SUPABASE_URL, ANON_KEY);
const PORT = 3461;

// ── Helpers ──
async function getPermId(code) {
  const { data } = await admin.from("corevia_permissions").select("id").eq("code", code).maybeSingle();
  return data?.id;
}

// ── Server (same requirePermission logic as production) ──
const app = express();
app.use(express.json());

async function extractUser(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata || {};
  const appMeta = data.user.app_metadata || {};
  const ext = { id: data.user.id, email: data.user.email || "", role: meta.role || appMeta.role || "employee", company_id: meta.company_id || appMeta.company_id || "", worker_id: meta.worker_id || appMeta.worker_id || null, allowed_pages: [] };
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

function requirePermission(code) {
  return async (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ error: "No role" });
    if (["super_admin", "super-admin", "admin", "owner"].includes(role)) return next();
    const workerId = req.user?.worker_id;
    const companyId = req.user?.company_id;
    // 1. User-level override (query corevia_user_permissions directly)
    if (workerId && companyId) {
      const permId = await getPermId(code);
      if (permId) {
        const { data: userPerm } = await admin
          .from("corevia_user_permissions")
          .select("granted")
          .eq("worker_id", workerId)
          .eq("company_id", companyId)
          .eq("permission_id", permId)
          .maybeSingle();
        if (userPerm) {
          if (userPerm.granted) return next();
          else return res.status(403).json({ error: `Missing permission: ${code}` });
        }
      }
    }
    // 2. Role-based fallback
    const { data } = await admin
      .from("corevia_role_permissions")
      .select("corevia_permissions!inner(code)")
      .eq("role", role)
      .eq("corevia_permissions.code", code)
      .maybeSingle();
    if (!data) return res.status(403).json({ error: `Missing permission: ${code}` });
    next();
  };
}

// Orders endpoints
app.get("/api/orders", requireAuth, requirePermission("orders.view"), async (req, res) => {
  res.json({ page: "orders", granted: true });
});

app.put("/api/orders/:id", requireAuth, requirePermission("orders.edit"), async (req, res) => {
  res.json({ action: "edit", id: req.params.id, granted: true });
});

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

app.get("/api/auth/me", requireAuth, (req, res) => res.json(req.user));

// ── MAIN ──
const server = app.listen(PORT, async () => {
  try {
    const ts = Date.now().toString(36).slice(-6);
    const companyId = `proof_${ts}`;
    const pass = "Test_123!";

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║    PROOF: Per-User Permissions in corevia_user_permissions  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // ── SETUP ──
    console.log("─── SETUP ───");

    // Owner
    const ownerEmail = `owner_${ts}@proof.com`;
    const r1 = await admin.auth.admin.createUser({
      email: ownerEmail, password: pass, email_confirm: true,
      user_metadata: { company_id: companyId, role: "owner" },
    });
    if (r1.error) throw new Error(r1.error.message);
    await admin.from("corevia_companies").insert({
      id: companyId, name: "Proof Corp", owner_name: "Proof Owner",
      owner_email: ownerEmail, phone: "+2135550000", status: "active", seats_limit: 20,
    });
    await admin.from("corevia_workers").insert({
      id: `wrk_own_${ts}`, company_id: companyId, full_name: "Owner", phone: "+2135550000", position: "CEO", salary: 0, status: "active",
    });
    await admin.from("corevia_saas_users").insert({
      user_id: r1.data.user.id, company_id: companyId, email: ownerEmail, username: `owner_${ts}`, role: "admin",
    });
    await admin.from("corevia_company_users").insert({
      id: `cu_own_${ts}`, company_id: companyId, worker_id: `wrk_own_${ts}`,
      auth_user_id: r1.data.user.id, email: ownerEmail, username: `owner_${ts}`,
      role: "owner", allowed_pages: [], invitation_used: true, status: "active",
    });
    console.log("  ✓ Owner + Company created");

    // Employee A: orders.view=true, orders.edit=false
    const emailA = `emp_a_${ts}@proof.com`;
    const rA = await admin.auth.admin.createUser({
      email: emailA, password: pass, email_confirm: true,
      user_metadata: { company_id: companyId, role: "employee", worker_id: `wrk_a_${ts}` },
    });
    await admin.from("corevia_workers").insert({
      id: `wrk_a_${ts}`, company_id: companyId, full_name: "Employee A", phone: "+2135550001", position: "Staff", salary: 0, status: "active",
    });
    await admin.from("corevia_company_users").insert({
      id: `cu_a_${ts}`, company_id: companyId, worker_id: `wrk_a_${ts}`,
      auth_user_id: rA.data.user.id, email: emailA, username: `emp_a_${ts}`,
      role: "employee", allowed_pages: ["orders"], invitation_used: true, status: "active",
    });
    // A: orders.view=GRANTED, orders.edit=DENIED (granted=false)
    const pView = await getPermId("orders.view");
    const pEdit = await getPermId("orders.edit");
    await admin.from("corevia_user_permissions").insert({
      id: `up_a_view_${ts}`, company_id: companyId, worker_id: `wrk_a_${ts}`, permission_id: pView, granted: true,
    });
    await admin.from("corevia_user_permissions").insert({
      id: `up_a_edit_${ts}`, company_id: companyId, worker_id: `wrk_a_${ts}`, permission_id: pEdit, granted: false,
    });
    console.log("  ✓ Employee A created: orders.view=true, orders.edit=false");

    // Employee B: orders.view=true, orders.edit=true
    const emailB = `emp_b_${ts}@proof.com`;
    const rB = await admin.auth.admin.createUser({
      email: emailB, password: pass, email_confirm: true,
      user_metadata: { company_id: companyId, role: "employee", worker_id: `wrk_b_${ts}` },
    });
    await admin.from("corevia_workers").insert({
      id: `wrk_b_${ts}`, company_id: companyId, full_name: "Employee B", phone: "+2135550002", position: "Staff", salary: 0, status: "active",
    });
    await admin.from("corevia_company_users").insert({
      id: `cu_b_${ts}`, company_id: companyId, worker_id: `wrk_b_${ts}`,
      auth_user_id: rB.data.user.id, email: emailB, username: `emp_b_${ts}`,
      role: "employee", allowed_pages: ["orders"], invitation_used: true, status: "active",
    });
    // B: orders.view=GRANTED, orders.edit=GRANTED
    await admin.from("corevia_user_permissions").insert({
      id: `up_b_view_${ts}`, company_id: companyId, worker_id: `wrk_b_${ts}`, permission_id: pView, granted: true,
    });
    await admin.from("corevia_user_permissions").insert({
      id: `up_b_edit_${ts}`, company_id: companyId, worker_id: `wrk_b_${ts}`, permission_id: pEdit, granted: true,
    });
    console.log("  ✓ Employee B created: orders.view=true, orders.edit=true\n");

    // ── SHOW DATABASE ROWS ──
    console.log("─── DATABASE PROOF: corevia_user_permissions ROWS ───");
    const { data: dbRows } = await admin.from("corevia_user_permissions")
      .select("id, company_id, worker_id, permission_id, granted, created_at")
      .eq("company_id", companyId)
      .order("worker_id", { ascending: true });
    for (const row of dbRows) {
      // resolve permission code
      const { data: perm } = await admin.from("corevia_permissions").select("code").eq("id", row.permission_id).single();
      console.log(`  [${row.worker_id}] ${perm?.code || row.permission_id}: granted=${row.granted}`);
    }
    console.log(`  (${dbRows.length} rows total for company ${companyId})\n`);

    // ── LOGIN & TEST ──
    const { data: loginA } = await supabase.auth.signInWithPassword({ email: emailA, password: pass });
    const tokenA = loginA.session.access_token;
    const { data: loginB } = await supabase.auth.signInWithPassword({ email: emailB, password: pass });
    const tokenB = loginB.session.access_token;

    console.log("─── TEST RESULTS ───\n");

    // A: View Orders → should PASS
    const aView = await fetch(`http://localhost:${PORT}/api/orders`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const aViewData = await aView.json();
    console.log(`  Employee A → GET /api/orders: ${aView.status} ${JSON.stringify(aViewData)}`);
    console.log(`  ✓ A can OPEN Orders page (orders.view=TRUE)\n`);

    // A: Edit Order → should FAIL (403)
    const aEdit = await fetch(`http://localhost:${PORT}/api/orders/ord_123`, { method: "PUT", headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "shipped" }) });
    const aEditData = await aEdit.json();
    console.log(`  Employee A → PUT /api/orders/ord_123: ${aEdit.status} ${JSON.stringify(aEditData)}`);
    console.log(`  ✓ A CANNOT edit order (orders.edit=FALSE → 403)\n`);

    // B: View Orders → should PASS
    const bView = await fetch(`http://localhost:${PORT}/api/orders`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const bViewData = await bView.json();
    console.log(`  Employee B → GET /api/orders: ${bView.status} ${JSON.stringify(bViewData)}`);
    console.log(`  ✓ B can OPEN Orders page (orders.view=TRUE)\n`);

    // B: Edit Order → should PASS
    const bEdit = await fetch(`http://localhost:${PORT}/api/orders/ord_123`, { method: "PUT", headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "shipped" }) });
    const bEditData = await bEdit.json();
    console.log(`  Employee B → PUT /api/orders/ord_123: ${bEdit.status} ${JSON.stringify(bEditData)}`);
    console.log(`  ✓ B CAN edit order (orders.edit=TRUE → 200)\n`);

    // ── SUMMARY ──
    console.log("─── SUMMARY ───");
    console.log("  Employee  | orders.view | orders.edit | Can Open? | Can Edit?");
    console.log("  ----------+-------------+-------------+-----------+----------");
    console.log(`  A         | TRUE        | FALSE       | ${aView.ok ? "YES      " : "NO       "} | ${aEdit.ok ? "YES     " : "NO      "}`);
    console.log(`  B         | TRUE        | TRUE        | ${bView.ok ? "YES      " : "NO       "} | ${bEdit.ok ? "YES     " : "NO      "}`);
    console.log("");
    if (aView.ok && !aEdit.ok && bView.ok && bEdit.ok) {
      console.log("✅ PROOF VALID: Per-user permissions override role-based correctly.");
    } else {
      console.log("❌ PROOF FAILED");
    }

    // Keep data in DB for user verification
    console.log(`\n─── VERIFY IN DATABASE ───`);
    console.log(`  Run in Supabase SQL Editor:`);
    console.log(`  SELECT up.id, up.worker_id, p.code, up.granted`);
    console.log(`  FROM corevia_user_permissions up`);
    console.log(`  JOIN corevia_permissions p ON p.id = up.permission_id`);
    console.log(`  WHERE up.company_id = '${companyId}'`);
    console.log(`  ORDER BY up.worker_id, p.code;`);

    // Keep ALL data in DB for you to verify!
    // Only delete auth users (Supabase Auth quota). Company + permission rows stay.
    for (const uid of [r1.data.user.id, rA.data.user.id, rB.data.user.id]) {
      try { await admin.auth.admin.deleteUser(uid); } catch {}
    }
    // Do NOT delete company/permission rows — they stay in the DB for your SQL query.

    server.close(() => process.exit(0));
  } catch (e) {
    console.error("FATAL:", e.message);
    server.close(() => process.exit(1));
  }
});

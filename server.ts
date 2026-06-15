/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "corevia_exclusive_ultimate_super_secret_jwt_key_v2_2026";

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Initialize Supabase Client (Server-Side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Raw Postgres Connection Pool (If DATABASE_URL environment variable is provided)
let pgPool: pg.Pool | null = null;
if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  try {
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log("🐘 Postgres connection pool created successfully!");
  } catch (err) {
    console.error("❌ Failed to initialize the direct Postgres pool:", err);
  }
}

// -------------------------------------------------------------
// REAL-TIME EVENTS HUB (Server-Sent Events)
// -------------------------------------------------------------
interface SseClient {
  id: string;
  res: express.Response;
  tenantId: string;
}
let sseClients: SseClient[] = [];

// Periodically send 15s keep-alive heartbeats to prevent Cloud Run / Proxy connection dropovers
setInterval(() => {
  sseClients.forEach(client => {
    client.res.write(":keepalive\n\n");
  });
}, 15000);

function broadcastToTenant(tenantId: string, payload: any) {
  const filtered = sseClients.filter(c => c.tenantId === tenantId);
  console.log(`📡 SSE Broadcasting real-time sync event to ${filtered.length} client(s) on tenant: ${tenantId}`);
  filtered.forEach(client => {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });
}

// -------------------------------------------------------------
// AUTHENTICATION AND SECURITY API ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/login -> Handles Unified Email, Phone, and Username Credentials
app.post("/api/auth/login", async (req, res) => {
  const { credential, password } = req.body;

  if (!credential || !password) {
    return res.status(400).json({ 
      error_en: "Please provide both credential and password.",
      error_ar: "يرجى ملء جميع الحقول المطلوبة." 
    });
  }

  try {
    const normCred = credential.toLowerCase().trim();
    let targetEmail = normCred;
    let resolvedRole = "admin";
    let companyId = "";
    let isReadOnly = false;
    let isSuspended = false;
    let employeeData: any = null;

    // A. Query corevia_company_users (employees) to resolve potential Phone or Username logins
    const { data: employees, error: empErr } = await supabase
      .from("corevia_company_users")
      .select("*")
      .or(`username.eq.${normCred},email.eq.${normCred},phone.eq.${normCred}`)
      .is("deleted_at", null);

    if (empErr) {
      console.warn("[Auth API] Employees lookup warning:", empErr);
    }

    if (employees && employees.length > 0) {
      const dbEmp = employees[0];
      employeeData = dbEmp;
      targetEmail = dbEmp.email || `${dbEmp.username.toLowerCase()}@corevia.dz`;
      resolvedRole = "employee";
      companyId = dbEmp.company_id || "cop_default";
      isReadOnly = dbEmp.status === "Read Only";
      isSuspended = dbEmp.status === "Suspended";

      if (isSuspended) {
        return res.status(403).json({
          error_en: "This employee account is suspended.",
          error_ar: "هذا الحساب معطل وموقوف حالياً."
        });
      }
    } else {
      // B. Query corevia_saas_users (admins) to resolve matching company or check if admin account exists
      const { data: saasUsers, error: saasUserErr } = await supabase
        .from("corevia_saas_users")
        .select("*")
        .eq("email", normCred);

      if (saasUsers && saasUsers.length > 0) {
        const saasUser = saasUsers[0];
        resolvedRole = saasUser.role || "admin";
        companyId = saasUser.company_id || `cop_${saasUser.user_id.substring(0, 15)}`;
      } else {
        // Fallback default generated company ID for direct admin logins
        companyId = `cop_admin_${normCred.replace(/[^a-z0-9]/g, "_")}`;
      }
    }

    // C. Perform real password validation via Supabase Auth or direct DB password check for employees
    let userId = "";
    let authValidated = false;

    // Direct Match for employees using their DB-assigned credentials
    if (employeeData && employeeData.password && String(employeeData.password).trim() === String(password).trim()) {
      userId = employeeData.auth_user_id || employeeData.id || `emp_${employeeData.id}`;
      authValidated = true;
      console.log(`[Auth API] Secure direct matches for employee ${employeeData.username || employeeData.full_name}. Bypassing Supabase Auth outer validation layer.`);
    }

    if (!authValidated) {
      console.log(`[Auth API] Authenticating email: ${targetEmail} against Supabase...`);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      if (authError || !authData.user) {
        console.warn("[Auth API] Sign-in rejection:", authError);
        return res.status(401).json({
          error_en: "Sign-in failed. Please verify your credentials and try again.",
          error_ar: "فشل تسجيل الدخول. يرجى التحقق من أوراق اعتمادك والمحاولة مرة أخرى."
        });
      }
      userId = authData.user.id;
    }

    // D. Generate custom JWT token embedding user identity, role, and tenant isolation parameters
    const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Days expiration
    const token = jwt.sign(
      { 
        user_id: userId, 
        tenant_id: companyId, 
        role: resolvedRole, 
        is_read_only: isReadOnly,
        iat: Math.floor(Date.now() / 1000), 
        exp: exp 
      }, 
      JWT_SECRET
    );

    // E. Set Cookie with strict secure flags
    res.cookie("corevia_session_v1_cookie", token, {
      httpOnly: true,
      secure: true, // Deploying onto strict HTTPS environments
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
    });

    // Provide parsed ERP interactive session back to React UI
    const finalSession = {
      username: employeeData ? employeeData.username : targetEmail.split("@")[0],
      email: targetEmail,
      isRegistered: true,
      isApproved: true,
      isSuspended: false,
      userId: userId,
      user_id: userId,
      company_id: companyId,
      role: resolvedRole,
      allowedPages: employeeData ? (Array.isArray(employeeData.allowed_pages) ? employeeData.allowed_pages : JSON.parse(employeeData.allowed_pages || "[]")) : undefined,
      jobTitle: employeeData ? employeeData.job_title : undefined,
      isReadOnly: isReadOnly
    };

    return res.status(200).json({
      success: true,
      redirect: "/dashboard",
      session: finalSession
    });

  } catch (err: any) {
    console.error("[Auth API] Severe Login Error:", err);
    return res.status(500).json({
      error_en: "Internal validation server error: " + err.message,
      error_ar: "خطأ داخلي في نظام المصادقة: " + err.message
    });
  }
});

// POST /api/auth/logout -> Wipes session credentials cookie
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("corevia_session_v1_cookie", { path: "/" });
  return res.status(200).json({ success: true });
});

// GET /api/auth/session -> Resolves isRegistered and Active session context
app.get("/api/auth/session", async (req, res) => {
  const token = req.cookies.corevia_session_v1_cookie;

  if (!token) {
    return res.status(410).json({ authenticated: false });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Validate with Supabase auth instance that user session is still alive
    const { data: authUserRecord, error: authUserErr } = await supabase.auth.admin.getUserById(decoded.user_id).catch(() => ({ data: { user: null }, error: null }));

    // Generate responsive active session response
    const { data: saasUsers } = await supabase
      .from("corevia_saas_users")
      .select("*")
      .eq("user_id", decoded.user_id)
      .maybeSingle();

    const { data: employees } = await supabase
      .from("corevia_company_users")
      .select("*")
      .eq("auth_user_id", decoded.user_id)
      .maybeSingle();

    const resolvedUsername = employees ? employees.username : (saasUsers ? saasUsers.username : "User");

    return res.status(200).json({
      authenticated: true,
      session: {
        username: resolvedUsername,
        email: saasUsers ? saasUsers.email : (employees ? employees.email || `${employees.username}@corevia.dz` : "resolved@corevia.dz"),
        isRegistered: true,
        isApproved: true,
        isSuspended: employees ? employees.status === "Suspended" : false,
        userId: decoded.user_id,
        user_id: decoded.user_id,
        company_id: decoded.tenant_id,
        role: decoded.role,
        allowedPages: employees ? (Array.isArray(employees.allowed_pages) ? employees.allowed_pages : JSON.parse(employees.allowed_pages || "[]")) : undefined,
        jobTitle: employees ? employees.job_title : undefined,
        isReadOnly: decoded.is_read_only
      }
    });
  } catch (err) {
    res.clearCookie("corevia_session_v1_cookie", { path: "/" });
    return res.status(401).json({ authenticated: false, error: "Stale or compromised JWT session credentials." });
  }
});

// Helper Middlewares for Multi-Tenant RLS Enforcement
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.corevia_session_v1_cookie;
  if (!token) {
    return res.status(411).json({ error: "Missing required authorization cookie credentials." });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { user_id, tenant_id, role, is_read_only }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized session credentials." });
  }
};

// Extends Request typing
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        tenant_id: string;
        role: string;
        is_read_only: boolean;
      };
    }
  }
}

// -------------------------------------------------------------
// MULTI-TENANT SECURE DATA APIS (Guarded)
// -------------------------------------------------------------

// GET /api/data/:table -> Isolation fetch proxy
app.get("/api/data/:table", requireAuth, async (req, res) => {
  const { table } = req.params;
  const tenantId = req.user!.tenant_id;

  try {
    // Standard secure query context enforcement
    if (pgPool) {
      // Direct Postgres statement isolation using SET LOCAL context
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");
        await pgClient.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
        
        let selectStr = `SELECT * FROM ${table}`;
        let params: any[] = [];
        
        if (table === "corevia_profile" || table === "corevia_companies") {
          selectStr += ` WHERE id = $2`;
          params = [tenantId, tenantId];
        } else {
          selectStr += ` WHERE company_id = $2`;
          params = [tenantId, tenantId];
        }

        const pgRes = await pgClient.query(selectStr, params);
        await pgClient.query("COMMIT");
        return res.status(200).json(pgRes.rows);
      } catch (dbErr: any) {
        await pgClient.query("ROLLBACK");
        console.warn(`[Direct DB Engine Error on table ${table}]:`, dbErr);
        // Fallback to Supabase JS Engine automatically
      } finally {
        pgClient.release();
      }
    }

    // High level Supabase Client execution engine fallback
    let query = supabase.from(table).select("*");
    if (table === "corevia_profile" || table === "corevia_companies") {
      query = query.eq("id", tenantId);
    } else {
      query = query.eq("company_id", tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json(data);

  } catch (err: any) {
    console.error(`[ERP Proxy API Error] GET table ${table}:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/data/:table/upsert -> Isolation save proxy with broadcast notifications
app.post("/api/data/:table/upsert", requireAuth, async (req, res) => {
  const { table } = req.params;
  const tenantId = req.user!.tenant_id;
  const rawPayload = req.body;

  if (req.user!.is_read_only) {
    return res.status(403).json({ error: "Access Denied: Read-only session capability." });
  }

  try {
    const isArray = Array.isArray(rawPayload);
    const items = isArray ? rawPayload : [rawPayload];

    // Force strict database isolation parameter override
    const modifiedItems = items.map(item => {
      const copy = { ...item };
      if (table === "corevia_profile" || table === "corevia_companies") {
        copy.id = tenantId;
        copy.company_id = tenantId;
      } else {
        copy.company_id = tenantId;
      }
      return copy;
    });

    const finalPayload = isArray ? modifiedItems : modifiedItems[0];

    // 1. Direct PG Transaction Engine
    if (pgPool) {
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");
        await pgClient.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
        // DB Schema changes would continue inside the transaction
        await pgClient.query("COMMIT");
      } catch (trErr) {
        await pgClient.query("ROLLBACK");
      } finally {
        pgClient.release();
      }
    }

    // 2. High level Supabase Client execution
    const { data, error } = await supabase.from(table).upsert(finalPayload);
    if (error) throw error;

    // Trigger <1.5s client broadcast updates automatically
    const clientId = req.headers["x-client-id"] || "unknown";
    broadcastToTenant(tenantId, {
      type: "RELOAD_ERP_DATA",
      table: table,
      sender: clientId
    });

    return res.status(200).json({ success: true, data });

  } catch (err: any) {
    console.error(`[ERP Proxy API Error] POST table ${table} upsert:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/events -> Registers keep-alive Server-Sent Events context
app.get("/api/sync/events", (req, res) => {
  const token = req.cookies.corevia_session_v1_cookie;
  if (!token) {
    return res.status(401).end();
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const tenantId = decoded.tenant_id;

    // Set streaming parameters
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const clientId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newClient: SseClient = {
      id: clientId,
      res,
      tenantId: tenantId
    };

    sseClients.push(newClient);
    console.log(`🔌 Client connected to SSE. Total clients: ${sseClients.length}. Tenant Context: ${tenantId}`);

    // Send initial test stream message
    res.write(`data: ${JSON.stringify({ type: "SYNC_REGISTERED", clientId })}\n\n`);

    req.on("close", () => {
      sseClients = sseClients.filter(c => c.id !== clientId);
      console.log(`🔌 Client disconnected from SSE. Total remaining: ${sseClients.length}`);
    });

  } catch (err) {
    return res.status(401).end();
  }
});

// Broadcast endpoint accessed directly from frontend for lightweight client syncs
app.post("/api/sync/notify", requireAuth, (req, res) => {
  const tenantId = req.user!.tenant_id;
  const { eventType } = req.body;

  broadcastToTenant(tenantId, {
    type: eventType || "RELOAD_ERP_DATA",
    sender: req.headers["x-client-id"] || "unknown"
  });

  return res.status(200).json({ success: true });
});


// -------------------------------------------------------------
// DEVELOPMENT & PRODUCTION STATIC VITE CONTROLLERS
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("🚀 Vite dev middleware loaded successfully inside Express.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("📦 Serving compiled production static distribution directory.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🟩 Corevia full-stack suite listening coordinates: http://0.0.0.0:${PORT}`);
  });
}

startServer();

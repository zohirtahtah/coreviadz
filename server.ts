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

// -------------------------------------------------------------
// AUTHENTICATION AND SECURITY API ENDPOINTS
// -------------------------------------------------------------

// Helper to look up a user by email, username, or phone case-insensitively
async function lookupUser(identifier: string): Promise<any | null> {
  const normCred = identifier.toLowerCase().trim();

  // 1. Try corevia_saas_users first (admins / super admins)
  const { data: saasUsers } = await supabase
    .from("corevia_saas_users")
    .select("*")
    .or(`email.ilike.${normCred},username.ilike.${normCred}`);

  if (saasUsers && saasUsers.length > 0) {
    return { ...saasUsers[0], userType: "admin" };
  }

  // 2. Try corevia_company_users next (employees)
  const { data: employees } = await supabase
    .from("corevia_company_users")
    .select("*")
    .or(`username.ilike.${normCred},email.ilike.${normCred},phone.eq.${normCred}`);

  if (employees && employees.length > 0) {
    return { ...employees[0], userType: "employee" };
  }

  return null;
}

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
    const userMatched = await lookupUser(credential);

    if (!userMatched) {
      return res.status(401).json({
        error_en: "User not found. Please verify your credentials or contact administrator.",
        error_ar: "لم يتم العثور على حساب مطابق. يرجى التحقق من صحة البيانات أو مراجعة المشرف."
      });
    }

    let targetEmail = userMatched.email || `${(userMatched.username || userMatched.id || "employee").toLowerCase()}@corevia.dz`;
    let resolvedRole = userMatched.role || userMatched.userType;
    let storedSaasPassword = "";
    if (resolvedRole && resolvedRole.includes(":")) {
      const parts = resolvedRole.split(":");
      resolvedRole = parts[0];
      storedSaasPassword = parts[1];
    }
    let companyId = userMatched.company_id || "cop_default";
    let isReadOnly = false;
    let isSuspended = false;

    if (userMatched.userType === "employee") {
      isReadOnly = userMatched.status === "Read Only";
      isSuspended = userMatched.status === "Suspended";
      if (isSuspended) {
        return res.status(403).json({
          error_en: "This employee account is suspended.",
          error_ar: "هذا الحساب معطل وموقوف حالياً."
        });
      }
    } else {
      // For corevia_saas_users, resolve their default company ID
      if (!companyId || companyId === "cop_default") {
        companyId = `cop_${userMatched.user_id ? userMatched.user_id.substring(0, 15) : "admin"}`;
      }
    }

    // Perform real password validation via Supabase Auth or direct DB password check for employees
    let userId = "";
    let authValidated = false;

    // Direct Match for employees/admins using their DB-assigned credentials
    if (
      (userMatched.password && String(userMatched.password).trim() === String(password).trim()) ||
      (storedSaasPassword && String(storedSaasPassword).trim() === String(password).trim())
    ) {
      userId = userMatched.auth_user_id || userMatched.id || userMatched.user_id || `emp_${userMatched.id}`;
      authValidated = true;
      console.log(`[Auth API] Secure direct matches for ${userMatched.username || userMatched.full_name}. Bypassing Supabase Auth outer validation layer.`);
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

    // Generate custom JWT token embedding user identity, role, and tenant isolation parameters
    const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Days expiration
    const token = jwt.sign(
      { 
        user_id: userId, 
        tenant_id: companyId, 
        role: resolvedRole, 
        email: targetEmail,
        is_read_only: isReadOnly,
        iat: Math.floor(Date.now() / 1000), 
        exp: exp 
      }, 
      JWT_SECRET
    );

    // Set Cookie with strict secure flags
    res.cookie("corevia_session_v1_cookie", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
      path: "/"
    });

    // Provide parsed ERP interactive session back to React UI
    const finalSession = {
      username: userMatched.username || userMatched.full_name || targetEmail.split("@")[0],
      email: targetEmail,
      isRegistered: true,
      isApproved: true,
      isSuspended: isSuspended,
      userId: userId,
      user_id: userId,
      company_id: companyId,
      role: resolvedRole,
      allowedPages: userMatched.userType === "employee" 
        ? (() => {
            const val = userMatched.allowed_pages;
            if (!val) return [];
            try {
              const parsed = typeof val === "string" ? JSON.parse(val) : val;
              if (Array.isArray(parsed)) return parsed;
              if (parsed && typeof parsed === "object" && Array.isArray(parsed.pages)) return parsed.pages;
              return [];
            } catch (pErr) {
              console.warn("Error parsing allowedPages:", pErr);
              return [];
            }
          })()
        : undefined,
      jobTitle: userMatched.job_title || undefined,
      isReadOnly: isReadOnly
    };

    return res.status(200).json({
      success: true,
      redirect: "/dashboard",
      session: finalSession,
      company_id: companyId,
      role: resolvedRole
    });

  } catch (err: any) {
    console.error("[Auth API] Severe Login Error:", err);
    return res.status(500).json({
      error_en: "Internal validation server error: " + err.message,
      error_ar: "خطأ داخلي في نظام المصادقة: " + err.message
    });
  }
});

// POST /api/auth/claim-invite -> Validates invitation token, marks as used, and logs the employee in securely
app.post("/api/auth/claim-invite", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error_en: "Invitation token is required.",
      error_ar: "رمز الدعوة مطلوب."
    });
  }

  try {
    // 1. Look up the employee record with that invitation token (fully bypassing RLS since it's on the server side!)
    let record = null;
    
    // First query standard column
    const { data: colsData, error: colsErr } = await supabase
      .from("corevia_company_users")
      .select("*")
      .eq("invitation_token", token)
      .maybeSingle();

    if (colsData) {
      record = colsData;
    } else {
      // Try JSONB nested search fallback
      const { data: jsonbData } = await supabase
        .from("corevia_company_users")
        .select("*")
        .eq("allowed_pages->>invitation_token", token)
        .maybeSingle();
      if (jsonbData) {
        record = jsonbData;
      }
    }

    if (!record) {
      return res.status(404).json({
        error_en: "Invalid or non-existent invitation token.",
        error_ar: "رمز الدعوة غير صالح أو غير موجود."
      });
    }

    // 2. Parse nested fields from allowed_pages if JSONB formatted
    let allowed = Array.isArray(record.allowed_pages) ? record.allowed_pages : [];
    let tokenVal = record.invitation_token || token;
    let expires = record.invitation_expires;
    let used = typeof record.invitation_used === "boolean" ? record.invitation_used : false;
    let authId = record.auth_user_id;

    if (record.allowed_pages && !Array.isArray(record.allowed_pages)) {
      try {
        const parsed = typeof record.allowed_pages === "string" ? JSON.parse(record.allowed_pages) : record.allowed_pages;
        if (parsed && typeof parsed === "object") {
          allowed = parsed.pages || [];
          tokenVal = parsed.invitation_token || tokenVal;
          expires = parsed.invitation_expires || expires;
          used = typeof parsed.invitation_used === "boolean" ? parsed.invitation_used : used;
          authId = parsed.auth_user_id || authId;
        }
      } catch (e) {
        console.warn("Parse allowed_pages failed in API:", e);
      }
    }

    // 3. Validation checks
    if (used) {
      return res.status(400).json({
        error_en: "This invitation link has already been used. Please log in using your password.",
        error_ar: "تم استخدام رابط الدعوة هذا مسبقاً. يرجى تسجيل الدخول باستخدام كلمة المرور الخاصة بك."
      });
    }

    if (expires && new Date(expires).getTime() < Date.now()) {
      return res.status(400).json({
        error_en: "This invitation link has expired. Please contact your administrator.",
        error_ar: "انتهت صلاحية رابط الدعوة هذا. يرجى مراجعة مدير النظام للحصول على دعوة جديدة."
      });
    }

    // 4. Mark invitation as used in the database
    const finalAllowedPages = record.allowed_pages && !Array.isArray(record.allowed_pages)
      ? {
          pages: allowed,
          invitation_token: tokenVal,
          invitation_expires: expires,
          invitation_used: true,
          auth_user_id: authId
        }
      : allowed;

    const updatePayload = {
      invitation_used: true,
      allowed_pages: finalAllowedPages
    };

    const { error: updateErr } = await supabase
      .from("corevia_company_users")
      .update(updatePayload)
      .eq("id", record.id);

    if (updateErr) {
      console.error("Failed to update invitation status in DB:", updateErr);
    }

    // Direct pgPool write fallback for absolute speed and durability bypassing RLS completely!
    if (pgPool) {
      try {
        await pgPool.query(
          `UPDATE corevia_company_users SET invitation_used = true, allowed_pages = $1 WHERE id = $2`,
          [JSON.stringify(finalAllowedPages), record.id]
        );
      } catch (dbErr) {
        console.warn("pgPool sync update for invitation failed:", dbErr);
      }
    }

    // 5. Generate secure JWT session cookie for instant session enrollment
    const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Days expiration
    const targetEmail = record.email || `${(record.username || record.id || "employee").toLowerCase()}@corevia.dz`;
    
    const jwtToken = jwt.sign(
      { 
        user_id: record.id, 
        tenant_id: record.company_id, 
        role: "employee", 
        email: targetEmail,
        is_read_only: record.status === "Read Only",
        iat: Math.floor(Date.now() / 1000), 
        exp: exp 
      }, 
      JWT_SECRET
    );

    res.cookie("corevia_session_v1_cookie", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
      path: "/"
    });

    const finalSession = {
      username: record.username || record.full_name || targetEmail.split("@")[0],
      email: targetEmail,
      isRegistered: true,
      isApproved: true,
      isSuspended: record.status === "Suspended",
      userId: record.id,
      user_id: record.id,
      company_id: record.company_id,
      role: "employee",
      allowedPages: allowed,
      jobTitle: record.job_title || "Employee",
      isReadOnly: record.status === "Read Only"
    };

    return res.status(200).json({
      success: true,
      session: finalSession
    });

  } catch (err: any) {
    console.error("[Claim Invite API] error:", err);
    return res.status(500).json({
      error_en: "Failed to claim invitation: " + err.message,
      error_ar: "فشل استرداد وتأكيد رابط الدعوة: " + err.message
    });
  }
});

// -------------------------------------------------------------
// HELPER MIDDLEWARES FOR MULTI-TENANT RLS ENFORCEMENT
// -------------------------------------------------------------
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

// GET /api/auth/verify-super-admin -> Server side gate for super admin validation
app.get("/api/auth/verify-super-admin", requireAuth, async (req, res) => {
  try {
    const userDecoded = req.user as any;
    const isSuperRole = userDecoded?.role === "super_admin" || userDecoded?.role === "super-admin";
    const userEmail = userDecoded?.email ? userDecoded.email.toLowerCase().trim() : "";
    const isSuperEmail = userEmail === "coreviadz@gmail.com" || userEmail === "admin@corevia.com";
    
    // Cross check database corevia_saas_users table role
    const { data: saasUser } = await supabase
      .from("corevia_saas_users")
      .select("role,email")
      .eq("user_id", userDecoded?.user_id)
      .maybeSingle();

    const dbEmail = saasUser?.email ? saasUser.email.toLowerCase().trim() : "";
    const isDbSuperEmail = dbEmail === "coreviadz@gmail.com" || dbEmail === "admin@corevia.com";

    if (isSuperRole || isSuperEmail || isDbSuperEmail || (saasUser && (saasUser.role === "super_admin" || saasUser.role === "super-admin"))) {
      return res.status(200).json({ isSuperAdmin: true });
    }

    return res.status(403).json({ isSuperAdmin: false, error: "Access Denied. Insufficient administrative privileges." });
  } catch (err) {
    return res.status(500).json({ isSuperAdmin: false, error: "Internal validation failure." });
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
      .or(`auth_user_id.eq.${decoded.user_id},id.eq.${decoded.user_id}`)
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
        allowedPages: employees 
          ? (() => {
              const val = employees.allowed_pages;
              if (!val) return [];
              try {
                const parsed = typeof val === "string" ? JSON.parse(val) : val;
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === "object" && Array.isArray(parsed.pages)) return parsed.pages;
                return [];
              } catch (pErr) {
                console.warn("Error parsing allowedPages in session:", pErr);
                return [];
              }
            })()
          : undefined,
        jobTitle: employees ? employees.job_title : undefined,
        isReadOnly: decoded.is_read_only
      }
    });
  } catch (err) {
    res.clearCookie("corevia_session_v1_cookie", { path: "/" });
    return res.status(401).json({ authenticated: false, error: "Stale or compromised JWT session credentials." });
  }
});

// Multi-Tenant RLS Enforcement Hooks are located above

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

import { supabase } from "./supabaseClient";
import type { EnterpriseWorker, EnterpriseCompanyUser } from "./types";

// ---------------------------------------------------------------------------
// WORKER CRUD (HR records)
// ---------------------------------------------------------------------------

export async function getWorkers(_companyId?: string): Promise<EnterpriseWorker[]> {
  try {
    const res = await fetch("/api/workers");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

// ---------------------------------------------------------------------------
// COMPANY USER CRUD (login accounts linked to workers)
// ---------------------------------------------------------------------------

export async function getCompanyUsers(_companyId?: string): Promise<EnterpriseCompanyUser[]> {
  try {
    const res = await fetch("/api/company-users");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

export function generateInvitationToken(): { token: string; expiresAt: string } {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(raw, b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

export async function generateUniqueUsername(fullName: string): Promise<string> {
  const base = fullName.toLowerCase().trim()
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-zA-Z0-9\u0621-\u064a\s]/g, "").replace(/\s+/g, ".")
    .replace(/^\.|\.$/g, "").substring(0, 30);
  if (!base) return "user." + Math.floor(100 + Math.random() * 900);
  let maxCounter = 0;
  if (supabase) {
    try {
      const { data } = await supabase.from("corevia_company_users")
        .select("username").like("username", base + ".%").limit(1000);
      if (data) {
        data.forEach((row: any) => {
          const suffix = row.username?.substring(base.length + 1);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxCounter) maxCounter = num;
        });
      }
    } catch {}
  }
  return base + "." + String(maxCounter + 1).padStart(3, "0");
}

export async function createCompanyUser(params: {
  workerId: string;
  companyId: string;
  email: string;
  username: string;
  fullName: string;
  role?: string;
}): Promise<{ companyUser?: EnterpriseCompanyUser; error?: string }> {
  const { token } = generateInvitationToken();
  try {
    const res = await fetch("/api/auth/invite-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email,
        fullName: params.fullName,
        username: params.username,
        workerId: params.workerId,
        invitationToken: token,
        role: params.role || "employee"
      })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Failed to create user" };
    const cu: EnterpriseCompanyUser = {
      id: data.companyUserId,
      company_id: params.companyId,
      worker_id: params.workerId,
      auth_user_id: data.authUserId,
      email: params.email,
      username: params.username,
      phone: "",
      role: (params.role as any) || "employee",
      allowed_pages: [],
      invitation_token: token,
      invitation_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invitation_used: false,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null
    };
    return { companyUser: cu };
  } catch (e: any) {
    return { error: "Server offline: " + e.message };
  }
}

export async function deleteCompanyUser(userId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/company-users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId })
    });
    return res.ok;
  } catch { return false; }
}

export async function updateUserRole(userId: string, role: string): Promise<boolean> {
  try {
    const res = await fetch("/api/company-users/role", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role })
    });
    return res.ok;
  } catch { return false; }
}

export async function updateUserPages(userId: string, pages: string[]): Promise<boolean> {
  try {
    const res = await fetch("/api/company-users/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, allowed_pages: pages })
    });
    return res.ok;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// BACKWARD COMPATIBILITY (old Employee type -> EnterpriseWorker + EnterpriseCompanyUser)
// ---------------------------------------------------------------------------

export interface Employee {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email?: string;
  username?: string;
  jobTitle: string;
  allowedPages: string[];
  assignedResponsibilities?: string;
  status: "Active" | "Read Only" | "Suspended";
  employee_status?: string;
  employee_role?: string;
  lastActivity?: string;
  createdAt: string;
  auth_user_id?: string;
  invitation_token?: string;
  invitation_expires_at?: string;
  invitation_expires?: string;
  invitation_used?: boolean;
  password_set?: boolean;
}

export async function getEmployees(companyId: string): Promise<Employee[]> {
  const users = await getCompanyUsers(companyId);
  return users.map(u => ({
    id: u.id,
    companyId: u.company_id,
    fullName: u.corevia_workers?.full_name || u.username || u.email,
    phone: u.corevia_workers?.phone || u.phone || "",
    email: u.email || undefined,
    username: u.username || undefined,
    jobTitle: u.corevia_workers?.position || "",
    allowedPages: Array.isArray(u.allowed_pages) ? u.allowed_pages : [],
    status: u.status === "read_only" ? "Read Only" : u.status === "active" ? "Active" : "Suspended",
    employee_status: u.status,
    employee_role: u.role,
    createdAt: u.created_at,
    auth_user_id: u.auth_user_id || undefined,
    invitation_token: u.invitation_token || undefined,
    invitation_expires_at: u.invitation_expires_at || undefined,
    invitation_used: u.invitation_used,
    password_set: u.invitation_used
  }));
}

export async function saveEmployee(employee: Employee): Promise<boolean> {
  const worker = {
    id: employee.id,
    company_id: employee.companyId,
    full_name: employee.fullName,
    phone: employee.phone,
    position: employee.jobTitle,
    salary: 0,
    status: "active" as const
  };
  try {
    const res = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(worker)
    });
    return res.ok;
  } catch { return false; }
}

export async function deleteEmployee(employeeId: string, _companyId?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/company-users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employeeId })
    });
    return res.ok;
  } catch { return false; }
}

export async function createEmployeeWithAuth(params: {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email?: string;
  username: string;
  jobTitle: string;
  allowedPages: string[];
  status: "Active" | "Read Only" | "Suspended";
  assignedResponsibilities?: string;
}): Promise<{ employee: Employee | null; error?: string }> {
  const result = await createCompanyUser({
    workerId: params.id,
    companyId: params.companyId,
    email: params.email || `${params.username}@corevia.dz`,
    username: params.username,
    fullName: params.fullName,
    role: (params.allowedPages?.includes("admin") || params.allowedPages?.includes("owner")) ? "admin" : "employee"
  });
  if (result.error) return { employee: null, error: result.error };
  const emp: Employee = {
    id: result.companyUser!.id,
    companyId: result.companyUser!.company_id,
    fullName: params.fullName,
    phone: params.phone,
    email: params.email,
    username: params.username,
    jobTitle: params.jobTitle,
    allowedPages: params.allowedPages,
    status: params.status,
    employee_status: "active",
    employee_role: result.companyUser!.role,
    createdAt: result.companyUser!.created_at,
    auth_user_id: result.companyUser!.auth_user_id || undefined,
    invitation_token: result.companyUser!.invitation_token || undefined,
    invitation_expires_at: result.companyUser!.invitation_expires_at || undefined,
    invitation_used: false,
    password_set: false
  };
  return { employee: emp };
}

export async function updateEmployeeLastActive(employeeId: string, activeTime: string): Promise<void> {
  try {
    await fetch("/api/company-users/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employeeId, last_activity: activeTime })
    });
  } catch {}
}

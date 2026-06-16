import { supabase } from "./supabaseClient";

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

const STORAGE_KEY = "corevia_employees_list_v2";

export function getLocalEmployees(): Employee[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read local employees", e);
    return [];
  }
}

function saveLocalEmployees(employees: Employee[]): void {
  try {
    const sanitized = employees.map(({ ...e }) => e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error("Failed to save local employees", e);
  }
}

export async function generateUniqueUsername(fullName: string): Promise<string> {
  const base = fullName
    .toLowerCase()
    .trim()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-zA-Z0-9\u0621-\u064a\s]/g, "")
    .replace(/\s+/g, ".")
    .replace(/^\.|\.$/g, "")
    .substring(0, 30);

  if (!base) return "user." + Math.floor(100 + Math.random() * 900);

  let maxCounter = 0;
  if (supabase) {
    try {
      const { data } = await supabase
        .from("corevia_company_users")
        .select("username")
        .like("username", base + ".%")
        .limit(1000);

      if (data) {
        data.forEach((row: any) => {
          const suffix = row.username?.substring(base.length + 1);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxCounter) {
            maxCounter = num;
          }
        });
      }
    } catch (e) {
      console.warn("Could not query usernames for uniqueness:", e);
    }
  }

  const candidate = base + "." + String(maxCounter + 1).padStart(3, "0");

  const local = getLocalEmployees();
  const localExists = local.some(e => e.username === candidate);
  if (localExists) {
    return base + "." + String(maxCounter + 2).padStart(3, "0");
  }

  return candidate;
}

export function generateInvitationToken(): { token: string; expiresAt: string } {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(raw, b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
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
}): Promise<{ employee: Employee; error?: string }> {
  const loginEmail = params.email || `${params.username}@corevia.dz`;
  const { token, expiresAt } = generateInvitationToken();

  let authUserId = "";
  try {
    const res = await fetch("/api/auth/invite-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail,
        fullName: params.fullName,
        username: params.username,
        companyId: params.companyId,
        employeeId: params.id,
        invitationToken: token
      })
    });
    const data = await res.json();
    if (!res.ok) {
      return { employee: null as any, error: data.error || "Failed to create auth account" };
    }
    authUserId = data.authUserId;
  } catch (e: any) {
    return { employee: null as any, error: "Server offline: " + e.message };
  }

  const employee: Employee = {
    id: params.id,
    companyId: params.companyId,
    fullName: params.fullName,
    phone: params.phone,
    email: params.email,
    username: params.username,
    jobTitle: params.jobTitle,
    allowedPages: params.allowedPages,
    assignedResponsibilities: params.assignedResponsibilities,
    status: params.status,
    employee_status: "pending",
    employee_role: "employee",
    createdAt: new Date().toISOString(),
    auth_user_id: authUserId,
    invitation_token: token,
    invitation_expires_at: expiresAt,
    invitation_expires: expiresAt,
    invitation_used: false,
    password_set: false
  };

  const saveOk = await saveEmployee(employee);
  if (!saveOk) {
    return { employee: null as any, error: "Failed to save employee record." };
  }

  return { employee };
}

export async function getEmployees(companyId: string): Promise<Employee[]> {
  const localList = getLocalEmployees().filter(e => e.companyId === companyId);

  try {
    const res = await fetch("/api/employees?companyId=" + encodeURIComponent(companyId));
    if (!res.ok) {
      return localList;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      const mapped: Employee[] = data.map((item: any) => {
        let pages: string[] = [];
        if (item.allowed_pages) {
          try {
            const parsed = typeof item.allowed_pages === "string" ? JSON.parse(item.allowed_pages) : item.allowed_pages;
            if (Array.isArray(parsed)) pages = parsed;
            else if (parsed && typeof parsed === "object") pages = parsed.pages || [];
          } catch (e) {}
        }
        return {
          id: item.id,
          companyId: item.company_id,
          fullName: item.full_name,
          phone: item.phone,
          email: item.email || undefined,
          username: item.username || undefined,
          jobTitle: item.job_title || "",
          allowedPages: pages,
          assignedResponsibilities: item.assigned_responsibilities || undefined,
          status: item.status || "Active",
          employee_status: item.employee_status || undefined,
          employee_role: item.employee_role || undefined,
          lastActivity: item.last_activity || undefined,
          createdAt: item.created_at || new Date().toISOString(),
          auth_user_id: item.auth_user_id || undefined,
          invitation_token: item.invitation_token || undefined,
          invitation_expires_at: item.invitation_expires_at || undefined,
          invitation_expires: item.invitation_expires || undefined,
          invitation_used: typeof item.invitation_used === "boolean" ? item.invitation_used : undefined,
          password_set: typeof item.password_set === "boolean" ? item.password_set : undefined
        };
      });

      const otherCompaniesObj = getLocalEmployees().filter(e => e.companyId !== companyId);
      const mergedList = [...localList];
      mapped.forEach(dbEmp => {
        const idx = mergedList.findIndex(e => e.id === dbEmp.id);
        if (idx !== -1) mergedList[idx] = dbEmp;
        else mergedList.push(dbEmp);
      });
      saveLocalEmployees([...otherCompaniesObj, ...mergedList]);
      return mergedList;
    }
  } catch (e) {
    console.warn("Failed to fetch employees from server, using local cache:", e);
  }

  return localList;
}

export async function saveEmployee(employee: Employee): Promise<boolean> {
  const currentLocal = getLocalEmployees();
  const index = currentLocal.findIndex(e => e.id === employee.id);
  if (index !== -1) {
    currentLocal[index] = employee;
  } else {
    currentLocal.push(employee);
  }
  saveLocalEmployees(currentLocal);

  try {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: employee.id,
        company_id: employee.companyId,
        full_name: employee.fullName,
        phone: employee.phone,
        email: employee.email || null,
        username: employee.username || null,
        job_title: employee.jobTitle,
        assigned_responsibilities: employee.assignedResponsibilities || null,
        allowed_pages: employee.allowedPages || [],
        status: employee.status,
        employee_status: employee.employee_status || (employee.status === "Active" ? "active" : "inactive"),
        employee_role: employee.employee_role || "employee",
        last_activity: employee.lastActivity || null,
        auth_user_id: employee.auth_user_id || null,
        invitation_token: employee.invitation_token || null,
        invitation_expires_at: employee.invitation_expires_at || employee.invitation_expires || null,
        invitation_used: typeof employee.invitation_used === "boolean" ? employee.invitation_used : null,
        password_set: typeof employee.password_set === "boolean" ? employee.password_set : null
      })
    });
    return res.ok;
  } catch (err) {
    console.warn("Network offline during employee save:", err);
    return false;
  }
}

export async function deleteEmployee(employeeId: string, companyId: string): Promise<boolean> {
  const currentLocal = getLocalEmployees().filter(e => e.id !== employeeId);
  saveLocalEmployees(currentLocal);

  try {
    const res = await fetch("/api/employees/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employeeId, company_id: companyId })
    });
    return res.ok;
  } catch (err) {
    console.warn("Network offline during employee delete:", err);
    return false;
  }
}

export async function updateEmployeeLastActive(employeeId: string, activeTime: string): Promise<void> {
  const currentLocal = getLocalEmployees();
  const index = currentLocal.findIndex(e => e.id === employeeId);
  if (index !== -1) {
    currentLocal[index].lastActivity = activeTime;
    saveLocalEmployees(currentLocal);
  }

  try {
    await fetch("/api/employees/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employeeId, last_activity: activeTime })
    });
  } catch (e) {}
}

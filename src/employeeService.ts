import { supabase, createSecondaryClient } from "./supabaseClient";

export interface Employee {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email?: string;
  username?: string;
  jobTitle: string;
  password?: string;
  allowedPages: string[];
  assignedResponsibilities?: string;
  status: "Active" | "Read Only" | "Suspended";
  lastActivity?: string;
  createdAt: string;
  auth_user_id?: string;
  invitation_token?: string;
  invitation_expires?: string;
  invitation_used?: boolean;
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

export function saveLocalEmployees(employees: Employee[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  } catch (e) {
    console.error("Failed to save local employees", e);
  }
}

/**
 * Generate a globally unique username based on the employee's full name.
 * Pattern: firstname.lastname or firstname.lastname.NNN
 */
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

  // Query Supabase for max counter on this base username
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

  // Also check local cache for uniqueness
  const local = getLocalEmployees();
  const localExists = local.some(e => e.username === candidate);
  if (localExists) {
    return base + "." + String(maxCounter + 2).padStart(3, "0");
  }

  return candidate;
}

/**
 * Generate a secure single-use invitation token (7-day expiry).
 */
export function generateInvitationToken(): { token: string; expiresAt: string } {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(raw, b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * Create a real Supabase Auth account for the employee,
 * upsert the employee record into corevia_company_users,
 * and return the full Employee object.
 */
export async function createEmployeeWithAuth(params: {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email?: string;
  username: string;
  jobTitle: string;
  password: string;
  allowedPages: string[];
  status: "Active" | "Read Only" | "Suspended";
  assignedResponsibilities?: string;
}): Promise<{ employee: Employee; error?: string }> {
  const signUpSecondary = createSecondaryClient();
  if (!signUpSecondary) {
    return { employee: null as any, error: "Supabase client not available" };
  }

  const loginEmail = params.email || `${params.username}@corevia.dz`;

  // Step 1: Create Supabase Auth account
  const { data: authData, error: authError } = await signUpSecondary.auth.signUp({
    email: loginEmail,
    password: params.password,
    options: {
      data: {
        company_id: params.companyId,
        employee_id: params.id,
        role: "employee",
        username: params.username,
        full_name: params.fullName
      }
    }
  });

  if (authError) {
    return { employee: null as any, error: authError.message };
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    return { employee: null as any, error: "Failed to get auth user ID" };
  }

  // Step 2: Generate invitation token
  const { token, expiresAt } = generateInvitationToken();

  // Step 3: Create employee record with auth_user_id
  const employee: Employee = {
    id: params.id,
    companyId: params.companyId,
    fullName: params.fullName,
    phone: params.phone,
    email: params.email,
    username: params.username,
    jobTitle: params.jobTitle,
    password: params.password,
    allowedPages: params.allowedPages,
    assignedResponsibilities: params.assignedResponsibilities,
    status: params.status,
    createdAt: new Date().toISOString(),
    auth_user_id: authUserId,
    invitation_token: token,
    invitation_expires: expiresAt,
    invitation_used: false
  };

  // Step 4: Save to Supabase corevia_company_users
  const saveOk = await saveEmployee(employee);
  if (!saveOk) {
    return { employee: null as any, error: "Failed to save employee record" };
  }

  return { employee };
}

/**
 * Fetch all employees for this company from Supabase,
 * falling back to local cache if offline.
 */
export async function getEmployees(companyId: string): Promise<Employee[]> {
  const localList = getLocalEmployees().filter(e => e.companyId === companyId);

  if (!supabase) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from("corevia_company_users")
      .select("*")
      .eq("company_id", companyId);

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        return localList;
      }
      throw error;
    }

    if (data) {
      const mapped: Employee[] = data.map((item: any) => ({
        id: item.id,
        companyId: item.company_id,
        fullName: item.full_name,
        phone: item.phone,
        email: item.email || undefined,
        username: item.username || undefined,
        jobTitle: item.job_title || "",
        password: item.password,
        allowedPages: Array.isArray(item.allowed_pages) ? item.allowed_pages : JSON.parse(item.allowed_pages || "[]"),
        assignedResponsibilities: item.assigned_responsibilities || undefined,
        status: item.status || "Active",
        lastActivity: item.last_activity || undefined,
        createdAt: item.created_at || new Date().toISOString(),
        auth_user_id: item.auth_user_id || undefined,
        invitation_token: item.invitation_token || undefined,
        invitation_expires: item.invitation_expires || undefined,
        invitation_used: typeof item.invitation_used === "boolean" ? item.invitation_used : undefined
      }));

      const otherCompaniesObj = getLocalEmployees().filter(e => e.companyId !== companyId);
      const mergedList = [...localList];
      mapped.forEach(dbEmp => {
        const idx = mergedList.findIndex(e => e.id === dbEmp.id);
        if (idx !== -1) {
          mergedList[idx] = dbEmp;
        } else {
          mergedList.push(dbEmp);
        }
      });

      saveLocalEmployees([...otherCompaniesObj, ...mergedList]);
      return mergedList;
    }
  } catch (e) {
    console.warn("Failed to fetch employees from Supabase, reverting to local cache:", e);
  }

  return localList;
}

/**
 * Find a single employee by identifier (email, phone, or username) from Supabase.
 */
export async function findEmployeeByIdentifier(identifier: string): Promise<Employee | null> {
  if (!supabase) {
    const local = getLocalEmployees();
    return local.find(e =>
      e.email?.toLowerCase() === identifier.toLowerCase() ||
      e.phone === identifier ||
      e.username?.toLowerCase() === identifier.toLowerCase()
    ) || null;
  }

  try {
    const searchVal = identifier.toLowerCase().trim();
    const { data, error } = await supabase
      .from("corevia_company_users")
      .select("*")
      .or(`username.eq.${searchVal},email.eq.${searchVal},phone.eq.${searchVal}`)
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const item = data[0];
    return {
      id: item.id,
      companyId: item.company_id,
      fullName: item.full_name,
      phone: item.phone,
      email: item.email || undefined,
      username: item.username || undefined,
      jobTitle: item.job_title || "",
      password: item.password,
      allowedPages: Array.isArray(item.allowed_pages) ? item.allowed_pages : JSON.parse(item.allowed_pages || "[]"),
      assignedResponsibilities: item.assigned_responsibilities || undefined,
      status: item.status || "Active",
      lastActivity: item.last_activity || undefined,
      createdAt: item.created_at || new Date().toISOString(),
      auth_user_id: item.auth_user_id || undefined,
      invitation_token: item.invitation_token || undefined,
      invitation_expires: item.invitation_expires || undefined,
      invitation_used: typeof item.invitation_used === "boolean" ? item.invitation_used : undefined
    };
  } catch (e) {
    console.warn("findEmployeeByIdentifier error:", e);
    return null;
  }
}

/**
 * Saves or updates an employee onto both Supabase database and local storage.
 */
export async function saveEmployee(employee: Employee): Promise<boolean> {
  const currentLocal = getLocalEmployees();
  const index = currentLocal.findIndex(e => e.id === employee.id);
  if (index !== -1) {
    currentLocal[index] = employee;
  } else {
    currentLocal.push(employee);
  }
  saveLocalEmployees(currentLocal);

  if (!supabase) {
    return true;
  }

  try {
    const dbPayload: any = {
      id: employee.id,
      company_id: employee.companyId,
      full_name: employee.fullName,
      phone: employee.phone,
      email: employee.email || null,
      username: employee.username || null,
      job_title: employee.jobTitle,
      password: employee.password || "",
      assigned_responsibilities: employee.assignedResponsibilities || null,
      allowed_pages: employee.allowedPages,
      status: employee.status,
      last_activity: employee.lastActivity || null,
      auth_user_id: employee.auth_user_id || null,
      invitation_token: employee.invitation_token || null,
      invitation_expires: employee.invitation_expires || null,
      invitation_used: typeof employee.invitation_used === "boolean" ? employee.invitation_used : null
    };

    const { error } = await supabase
      .from("corevia_company_users")
      .upsert(dbPayload, { onConflict: "id" });

    if (error) {
      console.warn("Could not save employee to remote db table:", error);
      return true;
    }
    return true;
  } catch (err) {
    console.warn("Network offline or missing table during employee save:", err);
    return true;
  }
}

/**
 * Removes an employee from both Supabase database and local storage.
 * Also attempts to delete the Supabase Auth user (requires admin privileges).
 */
export async function deleteEmployee(employeeId: string, companyId: string): Promise<boolean> {
  const emp = getLocalEmployees().find(e => e.id === employeeId);
  const currentLocal = getLocalEmployees().filter(e => e.id !== employeeId);
  saveLocalEmployees(currentLocal);

  if (!supabase) {
    return true;
  }

  try {
    const { error } = await supabase
      .from("corevia_company_users")
      .delete()
      .eq("id", employeeId)
      .eq("company_id", companyId);

    if (error) {
      console.warn("Could not delete employee on remote database table:", error);
      return false;
    }

    // Attempt to delete the Supabase Auth user (may fail if not admin)
    if (emp?.auth_user_id) {
      try {
        const sec = createSecondaryClient();
        if (sec) {
          await sec.auth.admin.deleteUser(emp.auth_user_id);
        }
      } catch (authDelErr) {
        console.warn("Could not delete Supabase Auth user (may require admin):", authDelErr);
      }
    }

    return true;
  } catch (err) {
    console.warn("Network offline or missing database table during employee delete:", err);
    return false;
  }
}

/**
 * Updates the last active time of an employee.
 */
export async function updateEmployeeLastActive(employeeId: string, activeTime: string): Promise<void> {
  const currentLocal = getLocalEmployees();
  const index = currentLocal.findIndex(e => e.id === employeeId);
  if (index !== -1) {
    currentLocal[index].lastActivity = activeTime;
    saveLocalEmployees(currentLocal);
  }

  if (!supabase) return;

  try {
    await supabase
      .from("corevia_company_users")
      .update({ last_activity: activeTime })
      .eq("id", employeeId);
  } catch (e) {
    // Silent fail
  }
}

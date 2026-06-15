import { supabase } from "./supabaseClient";

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

// Local Storage helper for holding offline/cached copies
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
 * Fetch all employees for this company from Supabase if configured,
 * falling back and syncing with local storage.
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
        // Table not created yet, return local cached state
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

      // Cache back locally for stability, sorting by creation date
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
 * Saves or updates an employee onto both local storage and Supabase database.
 */
export async function saveEmployee(employee: Employee): Promise<boolean> {
  // Update local storage first
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
    const dbPayload = {
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
      .upsert(dbPayload);

    if (error) {
      console.warn("Could not save employee to remote db table:", error);
      // Return true anyway so local storage save continues and UI is not frozen
      return true;
    }
    return true;
  } catch (err) {
    console.warn("Network offline or missing table during employee save:", err);
    return true;
  }
}

/**
 * Removes an employee from both local storage and Supabase database.
 */
export async function deleteEmployee(employeeId: string, companyId: string): Promise<boolean> {
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

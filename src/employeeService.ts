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
  baseSalary?: number;
  monthlySalary?: number;
  dailyHours?: number;
  workingDaysPerMonth?: number;
  overtimeRate?: number;
  absenceDeductionRate?: number;
  notes?: string;
  status: "Active" | "Read Only" | "Suspended";
  authUserId?: string;
  lastActivity?: string;
  createdAt: string;
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
 * Creates a real Supabase Auth account for an employee and links it to the company.
 * The employee can then log in via Supabase Auth with their email.
 */
export async function createEmployeeAuthAccount(
  email: string,
  password: string,
  fullName: string
): Promise<{ userId: string | null; error: string | null }> {
  if (!supabase) {
    return { userId: null, error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: "employee"
        }
      }
    });

    if (error) {
      return { userId: null, error: error.message };
    }

    return { userId: data.user?.id || null, error: null };
  } catch (err: any) {
    return { userId: null, error: err.message || "Unknown error" };
  }
}

/**
 * Deletes an employee's Supabase Auth account.
 * Note: Admin delete requires service_role key.
 * Falls back gracefully since anon key cannot perform admin operations.
 */
export async function deleteEmployeeAuthAccount(authUserIdOrEmail: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // Attempt to sign in as this user to trigger any cleanup, then try admin delete
    const { error } = await supabase.rpc("delete_user_by_id", {
      user_id: authUserIdOrEmail
    });
    if (error) {
      console.warn("Could not delete employee auth account via RPC (expected if function not created):", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Failed to delete employee auth account:", err);
    return false;
  }
}

/**
 * Signs in an employee using Supabase Auth if they have an auth account.
 * Falls back to custom table authentication.
 */
export async function authenticateEmployee(
  loginKey: string,
  password: string
): Promise<{ employee: Employee | null; error: string | null }> {
  // First try custom table auth
  const employees = getLocalEmployees();
  const match = employees.find(
    emp => (
      emp.email?.toLowerCase().trim() === loginKey.toLowerCase().trim() ||
      emp.phone?.trim() === loginKey.trim() ||
      emp.username?.toLowerCase().trim() === loginKey.toLowerCase().trim()
    ) && emp.password === password
  );

  if (match) {
    return { employee: match, error: null };
  }

  // If not found locally and Supabase is available, try Supabase Auth
  if (supabase && loginKey.includes("@")) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginKey,
        password: password
      });

      if (error) {
        return { employee: null, error: error.message };
      }

      if (data.user) {
        // Look up the employee record by auth user email
        const allEmployees = getLocalEmployees();
        const authEmployee = allEmployees.find(
          e => e.email?.toLowerCase().trim() === loginKey.toLowerCase().trim()
        );
        if (authEmployee) {
          return { employee: authEmployee, error: null };
        }
      }
    } catch (err: any) {
      return { employee: null, error: err.message };
    }
  }

  return { employee: null, error: "Invalid credentials" };
}

/**
 * Fetches all employee data for a given company and sets up a Realtime subscription
 * to listen for live changes.
 */
export function subscribeToEmployees(
  companyId: string,
  onUpdate: (employees: Employee[]) => void
): (() => void) | null {
  if (!supabase) return null;

  // Fetch initial data
  getEmployees(companyId).then(onUpdate);

  // Subscribe to realtime changes
  const channel = supabase
    .channel(`employees-${companyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "corevia_company_users",
        filter: `company_id=eq.${companyId}`
      },
      async () => {
        const updated = await getEmployees(companyId);
        onUpdate(updated);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
        baseSalary: item.base_salary || undefined,
        monthlySalary: item.monthly_salary || undefined,
        dailyHours: item.daily_hours || undefined,
        workingDaysPerMonth: item.working_days_per_month || undefined,
        overtimeRate: item.overtime_rate || undefined,
        absenceDeductionRate: item.absence_deduction_rate || undefined,
        notes: item.notes || undefined,
        status: item.status || "Active",
        authUserId: item.auth_user_id || undefined,
        lastActivity: item.last_activity || undefined,
        createdAt: item.created_at || new Date().toISOString()
      }));

      // Cache back locally for stability, sorting by creation date
      const otherCompaniesObj = getLocalEmployees().filter(e => e.companyId !== companyId);
      saveLocalEmployees([...otherCompaniesObj, ...mapped]);

      return mapped;
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
      base_salary: employee.baseSalary || null,
      monthly_salary: employee.monthlySalary || null,
      daily_hours: employee.dailyHours || null,
      working_days_per_month: employee.workingDaysPerMonth || null,
      overtime_rate: employee.overtimeRate || null,
      absence_deduction_rate: employee.absenceDeductionRate || null,
      notes: employee.notes || null,
      auth_user_id: employee.authUserId || null,
      status: employee.status,
      last_activity: employee.lastActivity || null
    };

    const { error } = await supabase
      .from("corevia_company_users")
      .upsert(dbPayload);

    if (error) {
      console.warn("Could not save employee to remote db table:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Network offline or missing table during employee save:", err);
    return false;
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
      .eq("id", employeeId);

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

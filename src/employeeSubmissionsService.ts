import { supabase } from "./supabaseClient";

export interface EmployeeSubmission {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  type: "overtime" | "missing_hours" | "absence" | "expense";
  amount: number; // hours, days, or currency amount
  description: string; // detail notes, e.g. "Fuel", "Transportation"
  date: string; // YYYY-MM-DD
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const STORAGE_KEY = "corevia_employee_submissions_v2";

export function getLocalSubmissions(): EmployeeSubmission[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read local employee submissions", e);
    return [];
  }
}

export function saveLocalSubmissions(submissions: EmployeeSubmission[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error("Failed to save local employee submissions", e);
  }
}

/**
 * Fetch all employee submissions for a specific company
 */
export async function getSubmissions(companyId: string): Promise<EmployeeSubmission[]> {
  let localList = getLocalSubmissions().filter(s => s.companyId === companyId);

  // Auto seed helpers for local listing fallback
  const getSeedItems = () => [
    {
      id: `seed-sub-exp-${companyId}`,
      companyId: companyId,
      employeeId: "emp-seed-1",
      employeeName: "توفيق العلمي",
      type: "expense" as const,
      amount: 4500,
      description: "مصاريف وقود مركبة التوصيل ونقل البضائع للزبائن",
      date: new Date().toISOString().substring(0, 10),
      status: "pending" as const,
      createdAt: new Date().toISOString()
    },
    {
      id: `seed-sub-over-${companyId}`,
      companyId: companyId,
      employeeId: "emp-seed-1",
      employeeName: "توفيق العلمي",
      type: "overtime" as const,
      amount: 3,
      description: "ساعات عمل إضافية لإنهاء وفرز طلبيات الولايات المتأخرة وشحنها",
      date: new Date().toISOString().substring(0, 10),
      status: "pending" as const,
      createdAt: new Date().toISOString()
    }
  ];

  if (!supabase) {
    if (localList.length === 0) {
      localList = getSeedItems();
      const otherCompaniesObj = getLocalSubmissions().filter(s => s.companyId !== companyId);
      saveLocalSubmissions([...otherCompaniesObj, ...localList]);
    }
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from("corevia_employee_submissions")
      .select("*")
      .eq("company_id", companyId);

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        if (localList.length === 0) {
          localList = getSeedItems();
          const otherCompaniesObj = getLocalSubmissions().filter(s => s.companyId !== companyId);
          saveLocalSubmissions([...otherCompaniesObj, ...localList]);
        }
        return localList;
      }
      throw error;
    }

    if (data) {
      const mapped: EmployeeSubmission[] = data.map((item: any) => ({
        id: item.id,
        companyId: item.company_id,
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        type: item.type,
        amount: Number(item.amount || 0),
        description: item.description || "",
        date: item.date || new Date().toISOString().substring(0, 10),
        status: item.status || "pending",
        createdAt: item.created_at || new Date().toISOString()
      }));

      // Cache back locally for stability, matching DB elements and preserving client elements not in database
      const otherCompaniesObj = getLocalSubmissions().filter(s => s.companyId !== companyId);
      
      const mergedList = [...localList];
      mapped.forEach(dbSub => {
        const idx = mergedList.findIndex(s => s.id === dbSub.id);
        if (idx !== -1) {
          mergedList[idx] = dbSub;
        } else {
          mergedList.push(dbSub);
        }
      });

      if (mergedList.length === 0) {
        const seedItems = getSeedItems();
        mergedList.push(...seedItems);
        
        try {
          await supabase.from("corevia_employee_submissions").upsert(
            seedItems.map(s => ({
              id: s.id,
              company_id: s.companyId,
              employee_id: s.employeeId,
              employee_name: s.employeeName,
              type: s.type,
              amount: s.amount,
              description: s.description,
              date: s.date,
              status: s.status,
              created_at: s.createdAt
            }))
          );
        } catch (dbErr) {
          console.warn("Could not upsert seeded submissions to Supabase:", dbErr);
        }
      }

      saveLocalSubmissions([...otherCompaniesObj, ...mergedList]);
      return mergedList;
    }
  } catch (err) {
    console.warn("Failed to fetch employee submissions from Supabase, returning local store:", err);
  }

  if (localList.length === 0) {
    localList = getSeedItems();
    const otherCompaniesObj = getLocalSubmissions().filter(s => s.companyId !== companyId);
    saveLocalSubmissions([...otherCompaniesObj, ...localList]);
  }

  return localList;
}

/**
 * Saves or updates a submission record in local storage & Supabase
 */
export async function saveSubmission(submission: EmployeeSubmission): Promise<boolean> {
  const current = getLocalSubmissions();
  const idx = current.findIndex(s => s.id === submission.id);
  if (idx !== -1) {
    current[idx] = submission;
  } else {
    current.push(submission);
  }
  saveLocalSubmissions(current);

  if (!supabase) {
    return true;
  }

  try {
    const dbPayload = {
      id: submission.id,
      company_id: submission.companyId,
      employee_id: submission.employeeId,
      employee_name: submission.employeeName,
      type: submission.type,
      amount: submission.amount,
      description: submission.description,
      date: submission.date,
      status: submission.status,
      created_at: submission.createdAt
    };

    const { error } = await supabase
      .from("corevia_employee_submissions")
      .upsert(dbPayload);

    if (error) {
      console.warn("Failed to save employee submission in Supabase (locally saved anyway):", error);
      return true;
    }
    return true;
  } catch (err) {
    console.warn("Network offline during submission save (locally saved anyway):", err);
    return true;
  }
}

/**
 * Soft or hard delete submission
 */
export async function deleteSubmission(id: string, companyId: string): Promise<boolean> {
  const current = getLocalSubmissions().filter(s => s.id !== id);
  saveLocalSubmissions(current);

  if (!supabase) {
    return true;
  }

  try {
    const { error } = await supabase
      .from("corevia_employee_submissions")
      .delete()
      .eq("id", id);

    if (error) {
      console.warn("Failed to delete employee submission from Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Network offline during submission delete:", err);
    return false;
  }
}

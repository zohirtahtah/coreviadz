import { supabase } from "./supabaseClient";

export interface ActivityLogEntry {
  id: string;
  companyId: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  userName: string;
  userId: string;
  jobTitle: string;
  actionType: string;
  pageName: string;
  affectedRecord: string;
  previousValue?: string;
  newValue?: string;
}

const STORAGE_KEY = "corevia_company_activity_logs_v2";

export function getLocalActivityLogs(): ActivityLogEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read local activity logs", e);
    return [];
  }
}

export function saveLocalActivityLogs(logs: ActivityLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to save local activity logs", e);
  }
}

export interface LogActivityParams {
  companyId: string;
  userName: string;
  userId: string;
  jobTitle: string;
  actionType: string;
  pageName: string;
  affectedRecord: string;
  previousValue?: string;
  newValue?: string;
}

/**
 * Log a new activity onto local cache and Supabase corevia_activity_center.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const now = new Date();
  
  // Format Date (YYYY-MM-DD)
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Format Time (HH:MM)
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${min}`;

  const entry: ActivityLogEntry = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    companyId: params.companyId,
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    userName: params.userName || "Owner",
    userId: params.userId || "owner_id",
    jobTitle: params.jobTitle || "Employee",
    actionType: params.actionType,
    pageName: params.pageName,
    affectedRecord: params.affectedRecord,
    previousValue: params.previousValue,
    newValue: params.newValue
  };

  // 1. Save locally
  const currentLogs = getLocalActivityLogs();
  currentLogs.unshift(entry); // prepend latest
  // cap logs at 3000 to avoid clogging local storage
  if (currentLogs.length > 3000) {
    currentLogs.pop();
  }
  saveLocalActivityLogs(currentLogs);

  // 2. Save to Supabase (if available)
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("corevia_activity_center")
      .insert({
        id: entry.id,
        company_id: entry.companyId,
        timestamp: entry.timestamp,
        user_name: entry.userName,
        user_id: entry.userId,
        job_title: entry.jobTitle,
        action_type: entry.actionType,
        page_name: entry.pageName,
        affected_record: entry.affectedRecord,
        previous_value: entry.previousValue || null,
        new_value: entry.newValue || null
      });

    if (error) {
      console.warn("Could not insert log entry into corevia_activity_center table:", error);
    }
  } catch (err) {
    console.warn("Failed to contact Supabase table corevia_activity_center", err);
  }
}

/**
 * Fetch all activity logs of a specific company.
 */
export async function getActivityLogs(companyId: string): Promise<ActivityLogEntry[]> {
  const localList = getLocalActivityLogs().filter(log => log.companyId === companyId);

  if (!supabase) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from("corevia_activity_center")
      .select("*")
      .eq("company_id", companyId)
      .order("timestamp", { ascending: false });

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        return localList;
      }
      throw error;
    }

    if (data && data.length > 0) {
      const mapped: ActivityLogEntry[] = data.map((item: any) => ({
        id: item.id,
        companyId: item.company_id,
        timestamp: item.timestamp,
        date: item.timestamp ? item.timestamp.split("T")[0] : "",
        time: item.timestamp ? item.timestamp.split("T")[1]?.substring(0, 5) || "" : "",
        userName: item.user_name,
        userId: item.user_id,
        jobTitle: item.job_title || "",
        actionType: item.action_type,
        pageName: item.page_name || "",
        affectedRecord: item.affected_record || "",
        previousValue: item.previous_value || undefined,
        newValue: item.new_value || undefined
      }));

      // Merge and save to cache
      const otherCompaniesObj = getLocalActivityLogs().filter(log => log.companyId !== companyId);
      saveLocalActivityLogs([...otherCompaniesObj, ...mapped]);

      return mapped;
    }
  } catch (e) {
    console.warn("Failed to fetch logs from Supabase:", e);
  }

  return localList;
}

/**
 * Filtering logs client side helper.
 */
export function filterActivityLogs(
  logs: ActivityLogEntry[],
  filters: {
    searchTerm: string; // matches username or phone number (wait, userName/jobTitle matcher)
    actionType: string;
    page: string;
    timeRange: "all" | "today" | "week" | "month" | "custom";
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  }
): ActivityLogEntry[] {
  const { searchTerm, actionType, page, timeRange, startDate, endDate } = filters;
  const now = new Date();

  return logs.filter(log => {
    // 1. Search filter (username or job title or ID match)
    if (searchTerm) {
      const targetStr = `${log.userName} ${log.jobTitle} ${log.affectedRecord} ${log.actionType}`.toLowerCase();
      if (!targetStr.includes(searchTerm.toLowerCase())) return false;
    }

    // 2. Action Type filter
    if (actionType && actionType !== "all") {
      if (log.actionType.toLowerCase() !== actionType.toLowerCase()) return false;
    }

    // 3. Page Name filter
    if (page && page !== "all") {
      if (log.pageName.toLowerCase() !== page.toLowerCase()) return false;
    }

    // 4. Time Range filters
    const logDate = new Date(log.timestamp);
    if (timeRange === "today") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (logDate < startOfToday) return false;
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (logDate < startOfWeek) return false;
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (logDate < startOfMonth) return false;
    } else if (timeRange === "custom") {
      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        if (logDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59");
        if (logDate > end) return false;
      }
    }

    return true;
  });
}

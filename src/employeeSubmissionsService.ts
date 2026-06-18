export interface EmployeeSubmission {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  type: "overtime" | "missing_hours" | "absence" | "expense";
  amount: number;
  description: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// The corevia_employee_submissions table was dropped in final_migration.sql.
// All Supabase/localStorage CRUD functions have been removed.
// If this table is re-added, reimplement getSubmissions, saveSubmission, deleteSubmission.

export function getSubmissions(): any[] { return []; }
export function saveSubmission(s: any): void {}
export function deleteSubmission(id: string): void {}

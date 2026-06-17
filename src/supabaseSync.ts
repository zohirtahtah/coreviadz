// supabaseSync.ts - Legacy sync layer (deprecated).
// Business data now reads/writes directly from/to Supabase.
// These stubs provide backward compatibility for existing imports.

export interface SaasUserMeta {
  userId: string;
  companyId: string;
  hasCompletedOnboarding: boolean;
  email: string;
  username: string;
  role: string;
}

export async function fetchUserSaaSMeta(userId: string, email?: string, fullName?: string): Promise<SaasUserMeta> {
  return { userId, companyId: `cop_${userId.substring(0, 15)}`, hasCompletedOnboarding: true, email: email || "", username: fullName || email?.split("@")[0] || "User", role: "admin" };
}

export async function saveOnboardingCompletionInCloud(companyId: string): Promise<void> {}

export async function pushSingleDatasetToCloud(companyId: string, table: string, data: any[]): Promise<void> {}

export async function pullMultiTenantData(companyId: string): Promise<boolean> { return true; }

export async function pushFullTenantData(companyId: string, email: string): Promise<void> {}

export async function cleanSlateResetSandbox(userId: string, companyId: string, email: string): Promise<void> {}

export async function calculateWorkerPayroll(companyId: string, workerId: string): Promise<any> { return null; }

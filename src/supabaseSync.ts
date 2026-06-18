// supabaseSync.ts - cloud persistence layer
import { supabase } from "./supabaseClient";

export interface SaasUserMeta {
  userId: string;
  companyId: string;
  hasCompletedOnboarding: boolean;
  email: string;
  username: string;
  role: string;
}

export async function fetchUserSaaSMeta(userId: string, email?: string, fullName?: string): Promise<SaasUserMeta> {
  if (supabase) {
    const { data } = await supabase
      .from("corevia_saas_users")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return {
        userId: data.user_id,
        companyId: data.company_id,
        hasCompletedOnboarding: data.has_completed_onboarding,
        email: data.email || email || "",
        username: data.username || fullName || email?.split("@")[0] || "User",
        role: data.role || "admin",
      };
    }
  }
  return { userId, companyId: `cop_${userId.substring(0, 15)}`, hasCompletedOnboarding: true, email: email || "", username: fullName || email?.split("@")[0] || "User", role: "admin" };
}

export async function saveOnboardingCompletionInCloud(userId: string, companyId: string, email: string, profile: any): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("corevia_saas_users").update({ has_completed_onboarding: true }).eq("user_id", userId).eq("company_id", companyId);
    await supabase.from("corevia_companies").update({
      name: profile.businessName,
      business_type: profile.businessType,
      owner_name: profile.ownerName,
      phone: profile.phone,
      email: profile.email,
    }).eq("id", companyId);
    await supabase.from("corevia_profile").upsert({
      id: companyId,
      company_id: companyId,
      business_name: profile.businessName,
      business_type: profile.businessType,
      owner_name: profile.ownerName,
      phone: profile.phone,
      email: profile.email,
      country: profile.country,
      currency: profile.currency,
    }, { onConflict: "id" });
  } catch (err) {
    console.warn("saveOnboardingCompletionInCloud error:", err);
  }
}

export async function pushSingleDatasetToCloud(companyId: string, table: string, data: any[]): Promise<void> {}

export async function pullMultiTenantData(companyId: string): Promise<boolean> { return true; }

export async function pushFullTenantData(companyId: string, email: string): Promise<void> {}

export async function cleanSlateResetSandbox(userId: string, companyId: string, email: string): Promise<void> {}

export async function calculateWorkerPayroll(companyId: string, workerId: string): Promise<any> { return null; }

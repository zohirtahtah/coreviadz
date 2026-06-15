import { supabase } from "./supabaseClient";
import type { SubscriptionRecord, SubscriptionHistoryRecord, SubscriptionNotificationRecord, SeatManagementRecord } from "./types";

// ==================== SUBSCRIPTIONS ====================

export async function getSubscription(companyId: string): Promise<SubscriptionRecord | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("corevia_subscriptions").select("*").eq("company_id", companyId).maybeSingle();
  return data;
}

export async function upsertSubscription(sub: Partial<SubscriptionRecord> & { company_id: string }): Promise<boolean> {
  if (!supabase) return false;
  const endDate = sub.start_date && sub.duration_months
    ? calcEndDate(sub.start_date, sub.duration_months)
    : sub.end_date;
  const { error } = await supabase.from("corevia_subscriptions").upsert({
    ...sub,
    end_date: endDate || sub.end_date,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  return !error;
}

export async function updateSubscriptionSeats(companyId: string, seatsLimit: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("corevia_subscriptions").update({
    seats_limit: seatsLimit,
    updated_at: new Date().toISOString()
  }).eq("company_id", companyId);
  return !error;
}

export async function renewSubscription(
  companyId: string,
  planName: string,
  durationMonths: number,
  seatsLimit: number,
  amountPaid: number,
  adminUser: string
): Promise<boolean> {
  if (!supabase) return false;
  const startDate = new Date().toISOString().split("T")[0];
  const endDate = calcEndDate(startDate, durationMonths);
  const { error } = await supabase.from("corevia_subscriptions").upsert({
    company_id: companyId,
    plan_name: planName,
    start_date: startDate,
    duration_months: durationMonths,
    end_date: endDate,
    seats_limit: seatsLimit,
    status: "Active",
    renewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) return false;
  return addSubscriptionHistory(companyId, durationMonths, planName, seatsLimit, amountPaid, adminUser);
}

// ==================== SUBSCRIPTION HISTORY ====================

export async function getSubscriptionHistory(companyId: string): Promise<SubscriptionHistoryRecord[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("corevia_subscription_history")
    .select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  return data || [];
}

export async function addSubscriptionHistory(
  companyId: string, durationMonths: number, planName: string,
  seatsPurchased: number, amountPaid: number, adminUser: string, notes?: string
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("corevia_subscription_history").insert({
    company_id: companyId, duration_months: durationMonths,
    plan_name: planName, seats_purchased: seatsPurchased,
    amount_paid: amountPaid, admin_user: adminUser, notes: notes || ""
  });
  return !error;
}

// ==================== SEAT MANAGEMENT ====================

export async function getSeatManagement(companyId: string): Promise<SeatManagementRecord | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("corevia_company_seat_management")
    .select("*").eq("company_id", companyId).maybeSingle();
  return data;
}

export async function upsertSeatManagement(sm: Partial<SeatManagementRecord> & { company_id: string }): Promise<boolean> {
  if (!supabase) return false;
  const available = (sm.current_seats_limit ?? 0) - (sm.used_seats ?? 0);
  const { error } = await supabase.from("corevia_company_seat_management").upsert({
    ...sm,
    available_seats: Math.max(0, available),
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  return !error;
}

export async function updateSeatsLimit(companyId: string, newLimit: number, modifiedBy: string): Promise<boolean> {
  if (!supabase) return false;
  const existing = await getSeatManagement(companyId);
  const used = existing?.used_seats ?? 0;
  const available = Math.max(0, newLimit - used);
  const now = new Date().toISOString();
  const { error } = await supabase.from("corevia_company_seat_management").upsert({
    company_id: companyId,
    current_seats_limit: newLimit,
    used_seats: used,
    available_seats: available,
    last_modified_by: modifiedBy,
    increased_at: newLimit > (existing?.current_seats_limit ?? 0) ? now : undefined,
    decreased_at: newLimit < (existing?.current_seats_limit ?? 0) ? now : undefined,
    custom_set_at: now,
    updated_at: now
  }, { onConflict: "company_id" });
  return !error;
}

// ==================== NOTIFICATIONS ====================

export async function getNotificationsForCompany(companyId: string): Promise<SubscriptionNotificationRecord[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("corevia_subscription_notifications")
    .select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  return data || [];
}

export async function createNotification(
  companyId: string, daysBefore: number, message: string
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("corevia_subscription_notifications").insert({
    company_id: companyId, days_before: daysBefore, message,
    sent_to_super_admin: true, sent_to_company_owner: true
  });
  return !error;
}

export async function acknowledgeNotification(notifId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("corevia_subscription_notifications")
    .update({ acknowledged: true }).eq("id", notifId);
  return !error;
}

// ==================== AGGREGATION QUERIES ====================

export interface ExpirationGroup {
  period: string;
  companies: { id: string; companyName: string; email: string; plan: string; endDate: string; daysLeft: number }[];
}

export async function getExpirationGroups(companies: { id: string; companyName: string; email: string; subscriptionPlan: string; expirationDate: string }[]): Promise<ExpirationGroup[]> {
  const today = new Date();
  const groups: ExpirationGroup[] = [
    { period: "30 days", companies: [] },
    { period: "15 days", companies: [] },
    { period: "7 days", companies: [] },
    { period: "3 days", companies: [] },
    { period: "Expired", companies: [] },
  ];
  for (const co of companies) {
    if (!co.expirationDate) continue;
    const days = Math.ceil((new Date(co.expirationDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const entry = { id: co.id, companyName: co.companyName, email: co.email, plan: co.subscriptionPlan, endDate: co.expirationDate, daysLeft: days };
    if (days <= 0) groups[4].companies.push(entry);
    else if (days <= 3) groups[3].companies.push(entry);
    else if (days <= 7) groups[2].companies.push(entry);
    else if (days <= 15) groups[1].companies.push(entry);
    else if (days <= 30) groups[0].companies.push(entry);
  }
  return groups;
}

// ==================== HELPERS ====================

export function calcEndDate(startDate: string, durationMonths: number): string {
  const s = new Date(startDate);
  const end = new Date(s.getFullYear(), s.getMonth() + durationMonths, s.getDate());
  return end.toISOString().split("T")[0];
}

export function daysRemaining(expDate: string): number {
  if (!expDate) return 999;
  return Math.ceil((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getDaysColor(days: number): { text: string; bg: string; label: string } {
  if (days <= 0) return { text: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Expired" };
  if (days <= 7) return { text: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: `${days} days` };
  if (days <= 15) return { text: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: `${days} days` };
  if (days <= 30) return { text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: `${days} days` };
  return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: `${days} days` };
}

export const PLAN_DETAILS: Record<string, { price: number; seats: number; color: string }> = {
  Free: { price: 0, seats: 2, color: "bg-slate-600" },
  Basic: { price: 29, seats: 5, color: "bg-blue-600" },
  Pro: { price: 79, seats: 15, color: "bg-indigo-600" },
  Enterprise: { price: 249, seats: 100, color: "bg-violet-600" }
};

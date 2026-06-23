import { supabase } from "../supabaseClient";

export async function handleLoginSeatCheck(companyId: string): Promise<void> {
  if (!supabase) return;

  const { data: company } = await supabase
    .from("corevia_companies")
    .select("total_seats, current_seats")
    .eq("id", companyId)
    .single();

  if (!company) return;

  const totalSeats = company.total_seats ?? 5;
  const currentSeats = company.current_seats ?? 0;

  if (currentSeats >= totalSeats) {
    throw new Error("SEAT_LIMIT_EXCEEDED");
  }

  await supabase
    .from("corevia_companies")
    .update({ current_seats: currentSeats + 1 })
    .eq("id", companyId);
}

export async function releaseSeatOnSignOut(companyId?: string): Promise<void> {
  if (!supabase || !companyId) return;

  const { data: company } = await supabase
    .from("corevia_companies")
    .select("current_seats")
    .eq("id", companyId)
    .single();

  if (!company) return;

  const currentSeats = company.current_seats ?? 0;
  if (currentSeats > 0) {
    await supabase
      .from("corevia_companies")
      .update({ current_seats: currentSeats - 1 })
      .eq("id", companyId);
  }
}

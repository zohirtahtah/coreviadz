import { supabase } from "../supabaseClient";

export async function forceTerminateEmployeeSessions(
  employeeAuthUserId: string,
  employeeName: string,
  companyId: string
): Promise<boolean> {
  try {
    // 1. Call the SECURITY DEFINER RPC to clear auth sessions
    const { error: authError } = await supabase.rpc("force_logout_user_by_id", {
      user_uuid: employeeAuthUserId,
    });
    if (authError) throw authError;

    // 2. Decrement current_seats in corevia_companies
    const { data: company, error: fetchError } = await supabase
      .from("corevia_companies")
      .select("current_seats")
      .eq("id", companyId)
      .single();

    if (!fetchError && company) {
      const newSeats = Math.max(0, (company.current_seats || 0) - 1);
      await supabase
        .from("corevia_companies")
        .update({ current_seats: newSeats })
        .eq("id", companyId);
    }

    // 3. Log the action in activity center
    await supabase.from("corevia_activity_center").insert({
      company_id: companyId,
      user_name: "System",
      action_type: "TERMINATE_SESSIONS",
      page_name: "Users & Permissions",
      details: `تم إنهاء جميع الجلسات النشطة وطرد الموظف [${employeeName}] برمجياً وتحرير مقعده`,
      created_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Force terminate sessions failed:", error);
    return false;
  }
}

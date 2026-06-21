import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeColumn(tableName: string, colName: string) {
  const payload: any = { id: "test_comp_" + Date.now(), name: "Test Corp" };
  payload[colName] = colName.includes("limit") || colName.includes("Limit") ? 5 : "test";
  
  const { error } = await supabase.from(tableName).insert(payload);
  
  if (error) {
    if (error.message.includes("Could not find the")) {
      return { exists: false, error: error.message };
    } else {
      return { exists: true, error: error.message };
    }
  }
  return { exists: true, error: "Success" };
}

async function main() {
  console.log("--- PROBING corevia_companies columns ---");
  const compCols = [
    "id",
    "name",
    "business_type",
    "owner_name",
    "phone",
    "email",
    "seatsLimit",
    "seatslimit",
    "seats_limit",
    "accountStatus",
    "accountstatus",
    "account_status",
    "subscriptionPlan",
    "subscriptionplan",
    "subscription_plan",
    "created_at"
  ];
  for (const col of compCols) {
    const res = await probeColumn("corevia_companies", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }
}

main().catch(console.error);

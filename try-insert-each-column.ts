import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeColumn(tableName: string, colName: string) {
  const payload: any = { id: "test_" + Date.now() };
  payload[colName] = "test-value";
  
  const { error } = await supabase.from(tableName).insert(payload);
  
  if (error) {
    if (error.message.includes("Could not find the")) {
      return { exists: false, error: error.message };
    } else {
      // Returned an RLS violation or constraint error, meaning the column EXISTS!
      return { exists: true, error: error.message };
    }
  }
  return { exists: true, error: "Inserted successfully!" };
}

async function main() {
  console.log("--- PROBING corevia_companies ---");
  const compCols = ["email", "owner_email", "company_email", "mail", "contact_email", "owner_name", "phone", "name", "business_type", "subscription_plan", "seats_limit", "status", "account_status"];
  for (const col of compCols) {
    const res = await probeColumn("corevia_companies", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }

  console.log("\n--- PROBING corevia_company_users ---");
  const userCols = ["full_name", "fullname", "name", "username", "email", "phone", "password", "role", "job_title", "allowed_pages", "company_id", "invitation_token"];
  for (const col of userCols) {
    const res = await probeColumn("corevia_company_users", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }

  console.log("\n--- PROBING corevia_orders ---");
  const orderCols = ["customer_name", "customer", "customer_fullname", "client", "client_name", "name", "customerName", "phone", "date", "company_id"];
  for (const col of orderCols) {
    const res = await probeColumn("corevia_orders", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }
}

main().catch(console.error);

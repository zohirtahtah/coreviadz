import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeColumn(tableName: string, colName: string) {
  const payload: any = { id: "test_" + Date.now() };
  payload[colName] = "test-value";
  
  if (colName === "allowed_pages" || colName === "allowedPages" || colName === "items" || colName === "products") {
    // Some columns might be jsonb or json arrays, so try putting a valid array/object
    payload[colName] = [];
  }
  
  const { error } = await supabase.from(tableName).insert(payload);
  
  if (error) {
    if (error.message.includes("Could not find the")) {
      return { exists: false, error: error.message };
    } else {
      return { exists: true, error: error.message };
    }
  }
  return { exists: true, error: "Inserted successfully (or bypassed due to some trigger)!" };
}

async function main() {
  console.log("--- PROBING corevia_company_users ---");
  const userCols = [
    "full_name", "fullname", "fullName", "name", "username", "email", "phone", "password", 
    "role", "job_title", "jobTitle", "allowed_pages", "allowedPages", 
    "invitation_token", "invitationToken", "invitation_expires", "invitationExpires", 
    "invitation_used", "invitationUsed", "status", "created_at", "display_name",
    "password_hash", "auth_user_id"
  ];
  for (const col of userCols) {
    const res = await probeColumn("corevia_company_users", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }

  console.log("\n--- PROBING corevia_orders ---");
  const orderCols = [
    "date", "order_date", "created_at", "created_time", "customer", "customer_name", "phone", 
    "customer_phone", "phone_number", "status", "order_status", "total", "total_amount", 
    "amount", "payment_status", "delivery_status", "wilaya", "address", "items", "products", 
    "trash", "original_data", "seller_id", "delivery_cost", "subtotal", "notes", "is_deleted"
  ];
  for (const col of orderCols) {
    const res = await probeColumn("corevia_orders", col);
    console.log(`Column '${col}': ${res.exists ? "✅ EXISTS" : "❌ ABSENT"} (${res.error})`);
  }
}

main().catch(console.error);

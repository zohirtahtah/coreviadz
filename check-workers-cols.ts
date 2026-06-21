import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const testWorker = {
    id: "test-w-1",
    company_id: "cop_test_123",
    name: "مستخدم تجريبي للتحقق",
    code: "W-9999",
    phone: "0555555555",
    base_salary: 45000,
    daily_hours: 8,
    overtime_rate: 2,
    role: "Sales"
  };

  console.log("Attempting test insert into corevia_workers...");
  const { data, error } = await supabase
    .from("corevia_workers")
    .insert([testWorker]);

  if (error) {
    console.error("❌ INSERT FAILED! Error Details:", error);
  } else {
    console.log("✅ INSERT SUCCESSFUL!");
    
    // Clean up
    console.log("Cleaning up test worker...");
    await supabase.from("corevia_workers").delete().eq("id", "test-w-1");
  }
}

main();

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Testing query on corevia_saas_users...");
  const { data: users, error: err1 } = await supabase.from("corevia_saas_users").select("*");
  if (err1) {
    console.error("❌ corevia_saas_users select fails:", err1);
  } else {
    console.log("✅ corevia_saas_users select succeeds! Items count:", users?.length);
  }

  console.log("\nTesting query on corevia_companies...");
  const { data: comps, error: err2 } = await supabase.from("corevia_companies").select("*");
  if (err2) {
    console.error("❌ corevia_companies select fails:", err2);
  } else {
    console.log("✅ corevia_companies select succeeds! Items count:", comps?.length);
  }
}

main().catch(console.error);

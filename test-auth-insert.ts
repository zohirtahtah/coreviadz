import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = "tester" + Date.now() + "@gmail.com";
  const password = "Password123!";
  
  console.log("Signing up test user...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (authError) {
    console.error("SignUp error:", authError);
    return;
  }
  
  const userId = authData.user?.id;
  console.log("Signed up successfully! User ID:", userId);
  
  if (!userId) return;
  
  // Try inserting with different company ID patterns
  // Pattern 1: company ID matches user ID (e.g., id = userId)
  console.log("\nTrying Pattern 1: company id matches user id...");
  const { error: err1 } = await supabase.from("corevia_companies").insert({
    id: userId,
    name: "Test Company Patterns",
    owner_name: "Test Owner",
    owner_email: email,
    phone: "12345678",
    country: "Algeria",
    seats_limit: 5,
    status: "pending_verification"
  });
  console.log("Pattern 1 Result:", err1 ? `❌ FAILED: ${err1.message}` : "✅ SUCCESS!");

  // Pattern 2: company ID is cop_<user_id_prefix>
  const compId2 = `cop_${userId.substring(0, 15)}`;
  console.log(`\nTrying Pattern 2: company id is ${compId2}...`);
  const { error: err2 } = await supabase.from("corevia_companies").insert({
    id: compId2,
    name: "Test Company Patterns 2",
    owner_name: "Test Owner",
    owner_email: email,
    phone: "12345678",
    country: "Algeria",
    seats_limit: 5,
    status: "pending_verification"
  });
  console.log("Pattern 2 Result:", err2 ? `❌ FAILED: ${err2.message}` : "✅ SUCCESS!");

  // clean up
  if (!err1) {
    await supabase.from("corevia_companies").delete().eq("id", userId);
  }
  if (!err2) {
    await supabase.from("corevia_companies").delete().eq("id", compId2);
  }
}

main().catch(console.error);

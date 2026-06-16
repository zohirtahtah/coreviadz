import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Inspecting database columns on the shared Supabase instance...");

  // 1. Inspect corevia_company_users
  const { data: users, error: err1 } = await supabase.from("corevia_company_users").select("*").limit(1);
  if (err1) {
    console.error("Error inspecting corevia_company_users:", err1);
  } else if (users && users.length > 0) {
    console.log("corevia_company_users structure:", Object.keys(users[0]));
  } else {
    console.log("corevia_company_users returned no records, trying to select partial properties...");
  }

  // 2. Inspect corevia_orders
  const { data: orders, error: err2 } = await supabase.from("corevia_orders").select("*").limit(1);
  if (err2) {
    console.error("Error inspecting corevia_orders:", err2);
  } else if (orders && orders.length > 0) {
    console.log("corevia_orders structure:", Object.keys(orders[0]));
  } else {
    console.log("corevia_orders returned no records.");
  }
}

inspect().catch(console.error);

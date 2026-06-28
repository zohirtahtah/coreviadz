import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  "corevia_support_tickets",
  "corevia_ticket_messages",
  "corevia_announcements",
  "corevia_notifications",
  "corevia_admin_activity"
];

async function main() {
  console.log("Probing tables...");
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    if (error) {
      console.log(`Table [${t}] -> ❌ ERROR: ${error.code} - ${error.message}`);
    } else {
      console.log(`Table [${t}] -> ✅ EXISTS (or no permission error). Data length:`, data?.length);
    }
  }
}

main().catch(console.error);

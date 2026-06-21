import fetch from "node-fetch";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

async function inspect(tableName: string) {
  const url = `${supabaseUrl}/rest/v1/${tableName}`;
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`
    }
  });
  
  const text = await res.text();
  console.log(`\nTable [${tableName}] structures (OPTIONS):`);
  console.log("Status:", res.status);
  try {
    const data = JSON.parse(text);
    if (data && data.columns) {
      console.log("  Columns:", data.columns.map((c: any) => `${c.name} (${c.type})`).join(", "));
    } else {
      console.log("Response JSON:", JSON.stringify(data, null, 2).substring(0, 500));
    }
  } catch (err) {
    console.log("Response text:", text.substring(0, 500));
  }
}

async function main() {
  await inspect("corevia_companies");
  await inspect("corevia_profile");
  await inspect("corevia_company_users");
  await inspect("corevia_orders");
}

main().catch(console.error);

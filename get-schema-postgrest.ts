import fetch from "node-fetch";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

async function main() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  console.log("Fetching url:", url);
  
  const res = await fetch(url, {
    headers: {
      "Accept": "application/openapi+json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`
    }
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  
  try {
    const data = JSON.parse(text) as any;
    if (data && data.definitions) {
      console.log("Found table definitions!");
      for (const tableName of Object.keys(data.definitions)) {
        if (tableName.includes("corevia_")) {
          console.log(`Table: ${tableName}`);
          const properties = data.definitions[tableName].properties;
          if (properties) {
            console.log("  Columns:", Object.keys(properties).join(", "));
          }
        }
      }
    } else {
      console.log("No definitions in JSON output:", text.substring(0, 500));
    }
  } catch (err) {
    console.log("Not a JSON response:", text.substring(0, 1000));
  }
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const commonRpcFuncs = [
  "exec_sql", "execute_sql", "run_sql", "sql", "query", "run_query",
  "exec_query", "db_query", "raw_sql", "execute_anonymous_sql"
];

async function main() {
  console.log("Probing for SQL helper functions in Supabase...");
  for (const fn of commonRpcFuncs) {
    try {
      // Try executing select 1
      const { data, error } = await supabase.rpc(fn, { 
        sql: "select 1 as val;", 
        query: "select 1 as val;",
        sql_query: "select 1 as val;",
        statement: "select 1 as val;"
      });
      console.log(`- RPC '${fn}': 🎉 FOUND OR NO ERROR! Data:`, data, "Error:", error);
    } catch (err: any) {
      if (err.message && err.message.includes("does not exist")) {
        console.log(`- RPC '${fn}': ❌ does not exist`);
      } else {
        console.log(`- RPC '${fn}': ⚠️ error:`, err.message || err);
      }
    }
  }
}

main().catch(console.error);

console.log("Checking database connection environment variables in Cloud Run workspace...");
const envs = Object.keys(process.env);
console.log("Available env keys:", envs.filter(k => k.includes("DB") || k.includes("URL") || k.includes("SUPABASE") || k.includes("POSTGRES")));
console.log("DATABASE_URL present?", Boolean(process.env.DATABASE_URL));
console.log("POSTGRES_URL present?", Boolean(process.env.POSTGRES_URL));

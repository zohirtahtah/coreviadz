import fetch from "node-fetch";

async function main() {
  console.log("Requesting http://localhost:3000...");
  try {
    const res = await fetch("http://localhost:3000/");
    console.log("Status:", res.status);
    console.log("Headers:");
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    const body = await res.text();
    console.log("Body excerpt (first 300 chars):", body.substring(0, 300));
  } catch (err: any) {
    console.error("Fetch failed:", err.message || err);
  }
}

main().catch(console.error);

const keys = Object.keys(process.env);
console.log("Available environment variables keys:");
keys.forEach(k => {
  const size = process.env[k] ? process.env[k].length : 0;
  console.log(`- ${k}: present (length: ${size})`);
});

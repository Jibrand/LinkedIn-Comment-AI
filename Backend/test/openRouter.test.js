const API_URL =
  process.env.API_URL || "http://localhost:3001/api/v1/openrouter/generate";

const response = await fetch(API_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "In one short sentence, what is an API?" }),
});

const data = await response.json().catch(() => null);

if (!response.ok || !data?.success || typeof data.text !== "string") {
  console.error("OpenRouter API test failed:", response.status, data);
  process.exit(1);
}

console.log("OpenRouter API test passed.");
console.log("Model:", data.model);
console.log("Answer:", data.text);

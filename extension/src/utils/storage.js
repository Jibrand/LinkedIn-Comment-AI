// Settings persisted in chrome.storage.local (never synced, never hardcoded).
export const DEFAULT_SETTINGS = {
  model: "openrouter/free",
  style: "Professional",
  systemPrompt: "", // user's own context / extra instructions
  token: "", // JWT token
  lastLog: "", // Stores debug logs
};

export const MODELS = [
  { id: "openrouter/free", label: "OpenRouter: Free model router" }
];

export const STYLES = ["Professional", "Casual", "Technical", "Thoughtful", "Short"];

export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

// Settings persisted in chrome.storage.local (never synced, never hardcoded).
export const DEFAULT_SETTINGS = {
  model: "gpt-4o-mini",
  style: "Professional",
  commentLength: "Medium",
  readThread: true,
  threadCommentCount: 10,
  dmEnabled: true,
  dmMessageCount: 10,
  dmGoal: "Reply naturally",
  adjustStyle: {
    shorter: false,
    moreCasual: false,
    lessAiSounding: false,
  },
  systemPrompt: "", // user's own context / extra instructions
  usage: {
    generations: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastTokens: 0,
  },
  token: "", // JWT token
  lastLog: "", // Stores debug logs
};

export const MODELS = [
  { id: "gpt-4o-mini", label: "OpenAI: GPT-4o mini" }
];

export const STYLES = ["Professional", "Casual", "Technical", "Thoughtful", "Short"];

export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    adjustStyle: {
      ...DEFAULT_SETTINGS.adjustStyle,
      ...(stored.adjustStyle || {}),
    },
    usage: {
      ...DEFAULT_SETTINGS.usage,
      ...(stored.usage || {}),
    },
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

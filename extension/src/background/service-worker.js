import { generateComment } from "../utils/gemini.js";
import { getSettings } from "../utils/storage.js";
import { API_BASE } from "../config.js";

async function recordCommentUsage(token, usage = {}) {
  if (!token) return;
  try {
    await fetch(`${API_BASE}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(usage),
    });
  } catch (error) {
    console.error("Failed to record usage:", error);
  }
}

async function recordTokenUsage(usage) {
  const inputTokens = Number(usage?.prompt_tokens || usage?.input_tokens || 0);
  const outputTokens = Number(usage?.completion_tokens || usage?.output_tokens || 0);
  const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return;

  const settings = await getSettings();
  const previous = settings.usage || {};
  await chrome.storage.local.set({
    usage: {
      generations: Number(previous.generations || 0) + 1,
      inputTokens: Number(previous.inputTokens || 0) + inputTokens,
      outputTokens: Number(previous.outputTokens || 0) + outputTokens,
      totalTokens: Number(previous.totalTokens || 0) + totalTokens,
      lastTokens: totalTokens,
    },
  });
  return { inputTokens, outputTokens, totalTokens };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "GENERATE_COMMENT") return;
  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.token) {
        throw new Error("Please log in via the extension popup first.");
      }
      
      const result = await generateComment(msg.postData, settings);
      const { comment } = result;
      const tokenUsage = await recordTokenUsage(result.usage);
      
      // Fire and forget usage recording
      recordCommentUsage(settings.token, {
        model: settings.model || "gpt-4o-mini",
        inputTokens: tokenUsage?.inputTokens || 0,
        outputTokens: tokenUsage?.outputTokens || 0,
        totalTokens: tokenUsage?.totalTokens || 0,
      });
      
      const adjustments = Object.entries(settings.adjustStyle || {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(", ") || "none";
      chrome.storage.local.set({
        lastLog: `SUCCESS: Comment generated with ${settings.model} | length=${settings.commentLength || "Medium"} | tokens=${tokenUsage?.totalTokens || "unreported"} | adjustments=${adjustments}`,
      });
      sendResponse({ ok: true, comment });
    } catch (e) {
      const errorMsg = e.code ? e.message : "Couldn't generate a comment. Try again.";
      const rawLog = e.raw || "";
      chrome.storage.local.set({ lastLog: `ERROR [${e.code || 'UNKNOWN'}]: ${errorMsg}\n\nDetails:\n${rawLog}` });
      sendResponse({ ok: false, code: e.code || "UNKNOWN", error: errorMsg });
    }
  })();
  return true; // async response
});

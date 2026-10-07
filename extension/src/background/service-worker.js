import { generateComment } from "../utils/gemini.js";
import { getSettings } from "../utils/storage.js";
import { API_BASE } from "../config.js";

async function recordCommentUsage(token) {
  if (!token) return;
  try {
    await fetch(`${API_BASE}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error("Failed to record usage:", error);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "GENERATE_COMMENT") return;
  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.token) {
        throw new Error("Please log in via the extension popup first.");
      }
      
      const { comment } = await generateComment(msg.postData, settings);
      
      // Fire and forget usage recording
      recordCommentUsage(settings.token);
      
      chrome.storage.local.set({ lastLog: `SUCCESS: Comment generated with ${settings.model}` });
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

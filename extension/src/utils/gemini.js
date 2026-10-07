import { API_BASE } from "../config.js";

const API_URL = `${API_BASE}/openrouter/generate`;

const STYLE_GUIDES = {
  Professional: "Polished, credible, and professional.",
  Casual: "Relaxed and conversational, like talking to a colleague.",
  Technical: "Precise and technical; add a concrete technical angle where relevant.",
  Thoughtful: "Reflective; offer a deeper perspective or a thoughtful question.",
  Short: "Very brief: one short sentence.",
};

export class GeminiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function buildPrompt(postData, style = "Professional", systemPrompt = "") {
  const extra = [];
  if (postData.articleTitle) extra.push(`Shared link/article title: ${postData.articleTitle}`);
  if (postData.hashtags?.length) extra.push(`Hashtags on post: ${postData.hashtags.join(" ")}`);

  return `You are an expert LinkedIn commenter.

Write a natural, thoughtful LinkedIn comment in response to the provided post.

Rules:
1. Actually respond to the content, do not simply summarize it.
2. Avoid generic phrases such as "Great post!" or "Absolutely!".
3. Add a useful observation, perspective, question, example, or practical insight.
4. Sound like a real professional person, not an AI.
5. Keep the comment concise, usually 1 to 3 short sentences.
6. Do not use excessive emojis, invent facts, make exaggerated claims, or use sales pitches.
7. Match the tone of the original post and answer its question when relevant.
8. Never use dashes or hyphens of any kind. Use commas, periods, or separate words.

Comment style: ${style}. ${STYLE_GUIDES[style] || ""}
${systemPrompt.trim() ? `\nContext about me and extra instructions:\n\n${systemPrompt.trim()}\n` : ""}
Post:

${postData.postText.length > 4000 ? `${postData.postText.substring(0, 4000)}... [truncated]` : postData.postText}
${extra.length ? `\n${extra.join("\n")}\n` : ""}
Author:

${postData.authorName || "Unknown"}

Author headline:

${postData.authorHeadline || "Unknown"}

Generate ONLY the comment text.`;
}

export function removeDashes(text) {
  return text
    .replace(/\s*[—–―]\s*/g, ", ")
    .replace(/\s+-+\s+/g, ", ")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/(\w)-(?=\w)/g, "$1 ")
    .replace(/-/g, "")
    .replace(/,\s*([,.!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

function cleanComment(text) {
  return removeDashes(
    text.trim().replace(/^["“']+|["”']+$/g, "").replace(/^\s*(comment|reply)\s*:\s*/i, "")
  ).trim();
}

export async function generateComment(postData, { token, model, style, systemPrompt = "" }) {
  if (!token) throw new GeminiError("NO_AUTH", "Please log in via the extension popup first.");
  if (!postData?.postText?.trim()) throw new GeminiError("EMPTY_POST", "Couldn't find text in this post.");

  const prompt = buildPrompt(postData, style, systemPrompt);
  const fail = (code, message, raw = "") =>
    Object.assign(new GeminiError(code, message), { prompt, raw });

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model, prompt, temperature: 0.8, max_tokens: 1500 }),
    });
  } catch (error) {
    throw fail("NETWORK", "Network error contacting the local generation API.", String(error));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const raw = `HTTP ${response.status}: ${detail}`;
    console.error("API Error Response:", raw);
    if (response.status === 401 || response.status === 403) {
      throw fail("AUTH", "Your login session is invalid. Log in again.", raw);
    }
    if (response.status === 429) {
      throw fail("RATE_LIMIT", "OpenRouter rate limit reached. Wait a moment and retry.", raw);
    }
    throw fail("API", `API Error (${response.status}): ${detail.substring(0, 100)}`, raw);
  }

  const data = await response.json().catch(() => null);
  const comment = cleanComment(data?.text || "");
  if (!comment) throw fail("EMPTY", "AI returned an empty comment. Try again.", JSON.stringify(data).slice(0, 2000));
  return { comment, raw: data.text, prompt };
}

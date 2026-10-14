const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
import { COMMENT_LIMITS } from "../config/comment-limits.js";

const getOpenAIKey = () => process.env.OPENAI_API_KEY;

export const generateText = async (req, res) => {
  const { prompt, temperature, max_tokens: maxTokens, postData, threadContext, dmContext } = req.body;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, message: "A non-empty prompt is required" });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ success: false, message: "Prompt must be 8000 characters or fewer" });
  }
  if (postData?.postText && String(postData.postText).length > COMMENT_LIMITS.MAX_POST_CHARS) {
    return res.status(400).json({ success: false, message: "Post text exceeds the allowed limit" });
  }
  if (threadContext) {
    const comments = Array.isArray(threadContext.comments) ? threadContext.comments : [];
    if (comments.length > COMMENT_LIMITS.MAX_THREAD_COMMENTS_OPTIONS.at(-1)) {
      return res.status(400).json({ success: false, message: "Too many thread comments" });
    }
    if (dmContext) {
      const prospect = dmContext.prospect || {};
      const messages = Array.isArray(dmContext.messages) ? dmContext.messages : [];
      if (messages.length > COMMENT_LIMITS.MAX_DM_MESSAGES_OPTIONS.at(-1)) {
        return res.status(400).json({ success: false, message: "Too many direct messages" });
      }
      if (String(prospect.name || "").length > COMMENT_LIMITS.MAX_DM_NAME_CHARS ||
          String(prospect.headline || "").length > COMMENT_LIMITS.MAX_DM_HEADLINE_CHARS) {
        return res.status(400).json({ success: false, message: "Prospect information exceeds the allowed limit" });
      }
      const totalChars = messages.reduce((sum, item) => sum + String(item?.text || "").length, 0);
      if (totalChars > COMMENT_LIMITS.MAX_DM_TOTAL_CHARS ||
          messages.some((item) => !["me", "them"].includes(item?.from) ||
            String(item?.text || "").length > COMMENT_LIMITS.MAX_DM_MESSAGE_CHARS)) {
        return res.status(400).json({ success: false, message: "Direct message limits exceeded" });
      }
    }
    const totalChars = comments.reduce((sum, item) => sum + String(item?.text || "").length, 0)
      + String(threadContext.replyingTo?.text || "").length;
    if (totalChars > COMMENT_LIMITS.MAX_THREAD_TOTAL_CHARS ||
        comments.some((item) => String(item?.text || "").length > COMMENT_LIMITS.MAX_CHARS_PER_COMMENT)) {
      return res.status(400).json({ success: false, message: "Thread comment limits exceeded" });
    }
    if (threadContext.replyingTo &&
        String(threadContext.replyingTo.text || "").length > COMMENT_LIMITS.MAX_CHARS_PER_COMMENT) {
      return res.status(400).json({ success: false, message: "Reply context limit exceeded" });
    }
  }

  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error("OpenAI API key is missing. Set OPENAI_API_KEY.");
    return res.status(500).json({ success: false, message: "OpenAI is not configured on the server" });
  }

  const requestBody = {
    model: MODEL,
    messages: [{ role: "user", content: prompt.trim() }],
    ...(typeof temperature === "number" ? { temperature } : {}),
    ...(Number.isInteger(maxTokens) ? { max_tokens: maxTokens } : {}),
  };

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("OpenAI request failed:", response.status, data);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        success: false,
        message: "OpenAI request failed",
        details: data?.error?.message || data?.message,
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.filter((part) => part?.type === "text").map((part) => part.text).join("")
      : content || data?.choices?.[0]?.text;

    if (typeof text !== "string" || text.length === 0) {
      console.error("OpenAI returned no generated text:", data);
      return res.status(502).json({ success: false, message: "OpenAI returned no generated text" });
    }

    return res.status(200).json({
      success: true,
      text,
      model: data.model || requestBody.model,
      usage: data.usage,
    });
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return res.status(502).json({ success: false, message: "Unable to reach OpenAI" });
  }
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";

const getOpenRouterKey = () => process.env.OPENROUTER_API_KEY;

export const generateText = async (req, res) => {
  const { prompt, model, temperature, max_tokens: maxTokens } = req.body;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, message: "A non-empty prompt is required" });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ success: false, message: "Prompt must be 8000 characters or fewer" });
  }

  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    console.error("OpenRouter API key is missing. Set OPENROUTER_API_KEY.");
    return res.status(500).json({ success: false, message: "OpenRouter is not configured on the server" });
  }

  const requestBody = {
    model: model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt.trim() }],
    ...(typeof temperature === "number" ? { temperature } : {}),
    ...(Number.isInteger(maxTokens) ? { max_tokens: maxTokens } : {}),
  };

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "LinkedIn AI Comment",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("OpenRouter request failed:", response.status, data);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        success: false,
        message: "OpenRouter request failed",
        details: data?.error?.message || data?.message,
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.filter((part) => part?.type === "text").map((part) => part.text).join("")
      : content || data?.choices?.[0]?.text;

    if (typeof text !== "string" || text.length === 0) {
      console.error("OpenRouter returned no generated text:", data);
      return res.status(502).json({ success: false, message: "OpenRouter returned no generated text" });
    }

    return res.status(200).json({
      success: true,
      text,
      model: data.model || requestBody.model,
      usage: data.usage,
    });
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    return res.status(502).json({ success: false, message: "Unable to reach OpenRouter" });
  }
};

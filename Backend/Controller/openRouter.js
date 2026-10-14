const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const getOpenAIKey = () => process.env.OPENAI_API_KEY;

export const generateText = async (req, res) => {
  const { prompt, temperature, max_tokens: maxTokens } = req.body;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, message: "A non-empty prompt is required" });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ success: false, message: "Prompt must be 8000 characters or fewer" });
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

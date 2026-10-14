import commentModal from "../Models/comment.js";

// Add a comment usage record
export const addCommentRecord = async (req, res) => {
  try {
    const {
      model = "gpt-4o-mini",
      inputTokens = 0,
      outputTokens = 0,
      totalTokens = Number(inputTokens) + Number(outputTokens),
    } = req.body || {};
    const values = [inputTokens, outputTokens, totalTokens].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({ success: false, message: "Token values must be non-negative numbers" });
    }
    const result = await commentModal.create({
      userId: req.userId,
      model: typeof model === "string" && model.trim() ? model.trim() : "gpt-4o-mini",
      inputTokens: values[0],
      outputTokens: values[1],
      totalTokens: values[2],
    });
    res.status(201).json({ success: true, message: "Comment usage recorded successfully", result });
  } catch (error) {
    console.error("Error adding comment record:", error);
    res.status(500).json({ success: false, message: "Failed to record comment usage" });
  }
};

// Get comment usage stats for a user
export const getUserCommentStats = async (req, res) => {
  try {
    const count = await commentModal.countDocuments({ userId: req.userId });
    res.status(200).json({ success: true, totalComments: count });
  } catch (error) {
    console.error("Error fetching comment stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

export const getUserCommentHistory = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
    const history = await commentModal
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("model inputTokens outputTokens totalTokens createdAt -_id")
      .lean();
    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("Error fetching comment token history:", error);
    res.status(500).json({ success: false, message: "Failed to fetch comment token history" });
  }
};

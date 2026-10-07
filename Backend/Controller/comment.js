import commentModal from "../Models/comment.js";

// Add a comment usage record
export const addCommentRecord = async (req, res) => {
  try {
    const result = await commentModal.create({ userId: req.userId });
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

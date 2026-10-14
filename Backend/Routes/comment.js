import express from "express";
const router = express.Router();

import { addCommentRecord, getUserCommentStats, getUserCommentHistory } from "../Controller/comment.js";
import auth from "../middleware/auth.js";

router.post("/v1/comment", auth, addCommentRecord);
router.get("/v1/comment/stats", auth, getUserCommentStats);
router.get("/v1/comment/history", auth, getUserCommentHistory);

export default router;

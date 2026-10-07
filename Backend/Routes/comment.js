import express from "express";
const router = express.Router();

import { addCommentRecord, getUserCommentStats } from "../Controller/comment.js";
import auth from "../middleware/auth.js";

router.post("/v1/comment", auth, addCommentRecord);
router.get("/v1/comment/stats", auth, getUserCommentStats);

export default router;

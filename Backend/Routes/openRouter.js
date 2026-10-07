import express from "express";
import { generateText } from "../Controller/openRouter.js";

const router = express.Router();

router.post("/v1/openrouter/generate", generateText);

export default router;

import express from "express";
const router = express.Router();

import { register, login, getUserInfo } from "../Controller/auth.js";
import auth from "../middleware/auth.js";

router.post("/v1/auth/register", register);
router.post("/v1/auth/login", login);
router.get("/v1/auth/me", auth, getUserInfo);

export default router;

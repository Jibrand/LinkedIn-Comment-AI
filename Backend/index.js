import express from "express";
import cors from "cors";  
import contactRoutes from "./Routes/contact.js";
import authRoutes from "./Routes/auth.js";
import commentRoutes from "./Routes/comment.js";
import openRouterRoutes from "./Routes/openRouter.js";
import dotenv from "dotenv";
import database from "./middleware/database.js";

dotenv.config();
const PORT = process.env.PORT || 3001;
const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.status(200).send("Hello world"));

app.use("/api", database);
app.use("/api", contactRoutes);
app.use("/api", authRoutes);
app.use("/api", commentRoutes);
app.use("/api", openRouterRoutes);


if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log("Listening on port", PORT));
}

export default app;

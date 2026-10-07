import express from "express";
import mongoose from "mongoose";
import cors from "cors";  
import contactRoutes from "./Routes/contact.js";
import authRoutes from "./Routes/auth.js";
import commentRoutes from "./Routes/comment.js";
import openRouterRoutes from "./Routes/openRouter.js";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 3001;
const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.status(200).send("Hello world"));

app.use("/api", contactRoutes);
app.use("/api", authRoutes);
app.use("/api", commentRoutes);
app.use("/api", openRouterRoutes);


const CONNECTION_URL = process.env.CONNECTION_URL;
mongoose
  .connect(CONNECTION_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected Successfully."))
  .catch((err) => console.error("No connection", err));

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log("Listening on port", PORT));
}

export default app;

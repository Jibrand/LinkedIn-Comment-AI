import { connectDatabase } from "../db.js";

export default async function database(req, res, next) {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({
      success: false,
      message: "Database is unavailable. Check the server database configuration.",
    });
  }
}

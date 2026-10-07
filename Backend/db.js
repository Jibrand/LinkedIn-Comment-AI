import mongoose from "mongoose";

let connectionPromise;

export async function connectDatabase() {
  if (!process.env.CONNECTION_URL) {
    throw new Error("CONNECTION_URL is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.CONNECTION_URL, {
      serverSelectionTimeoutMS: 8000,
      family: 4,
    });
  }

  try {
    await connectionPromise;
  } catch (error) {
    connectionPromise = undefined;
    throw error;
  }
}

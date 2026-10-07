import { getSettings, saveSettings } from "./storage.js";
import { API_BASE } from "../config.js";

async function fetchApi(endpoint, options = {}) {
  const settings = await getSettings();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (settings.token) {
    headers.Authorization = `Bearer ${settings.token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }
  return data;
}

export async function registerUser(fullName, email, password) {
  const data = await fetchApi("/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName, email, password }),
  });
  await saveSettings({ token: data.token });
  return data;
}

export async function loginUser(email, password) {
  const data = await fetchApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await saveSettings({ token: data.token });
  return data;
}

export async function getUserInfo() {
  return await fetchApi("/auth/me", { method: "GET" });
}

export async function getCommentStats() {
  return await fetchApi("/comment/stats", { method: "GET" });
}

export async function recordCommentUsage() {
  return await fetchApi("/comment", { method: "POST" });
}

export function logout() {
  saveSettings({ token: "" });
}

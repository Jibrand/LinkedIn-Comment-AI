// Change this one value to "development" while running the local backend.
// export const API_ENVIRONMENT = "production";
export const API_ENVIRONMENT = "development";

const API_BASES = {
  development: "http://localhost:3001/api/v1",
  production: "https://linked-in-comment-ai.vercel.app/api/v1",
};

export const API_BASE = API_BASES[API_ENVIRONMENT];

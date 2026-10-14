# LinkedIn AI Commenter

This repository contains the LinkedIn Chrome extension and its Express backend.

## Backend deployment

Deploy the `Backend` folder as the Vercel project root. Add these Vercel environment
variables before deploying:

- `CONNECTION_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- The backend uses `gpt-4o-mini` for comment generation.
- `NODE_ENV=production`

The extension production API is configured as:

`https://linked-in-comment-ai.vercel.app/api/v1`

## Local development

1. Copy `Backend/.env.example` to `Backend/.env` and fill in the values.
2. Run `npm install` and `npm start` from `Backend`.
3. Set `API_ENVIRONMENT` to `"development"` in
   `extension/src/config.js`.
4. Reload the unpacked extension from `chrome://extensions`.

Before distributing the extension, set `API_ENVIRONMENT` back to `"production"`
and reload the extension.

## Publishing

The GitHub repository is `https://github.com/Jibrand/LinkedIn-Comment-AI.git`.

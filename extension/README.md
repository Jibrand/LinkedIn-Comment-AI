# LinkedIn AI Commenter (Chrome MV3)

Adds a small **✨ AI** button to every LinkedIn post's action bar (`Like · Comment · Repost · Send · ✨ AI`).
Click it → the post data goes to the secured OpenAI generation API → a natural comment is typed into LinkedIn's comment box.
**You review/edit it and click LinkedIn's Post button yourself.** The extension never submits anything.

## Install
1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Pin the extension (puzzle icon → pin).

## Where to enter the Gemini API key
1. Get a key at https://aistudio.google.com/app/apikey.
2. Click the extension's toolbar icon and sign in.
3. Choose **Model**, **Comment Style**, **Comment Length**, and any **Adjust Style** options, then **Save**.
4. Refresh any open LinkedIn tabs.

## Usage
Open https://www.linkedin.com/feed → click **✨ AI** under a post → wait for "Generating…" → the comment
appears in the comment box → edit → click **Post** manually.

## Structure
```
manifest.json
src/content/linkedin-dom.js   findLinkedInPosts, extractPostContent, findCommentButton, findCommentEditor
src/content/content.js        attachAIButton, insertComment, MutationObserver + SPA navigation
src/content/styles.css        native-looking button + toast
src/background/service-worker.js  receives requests, calls the generation API
src/utils/gemini.js           generateComment(postData), prompt, error mapping
src/utils/storage.js          settings (chrome.storage.local), model list
src/popup/*                   settings UI
```

## Permissions
| Permission | Why |
|---|---|
| `storage` | Save API key, model, style locally (`chrome.storage.local`, not synced). |
| `https://www.linkedin.com/*` | Inject the button and read the post you click on. |
| `https://generativelanguage.googleapis.com/*` | Call the Gemini API. |

## Privacy
- The generation API is called **only when you click ✨ AI**, and only for that post.
- Sent: post text, author name/headline, visible article title, hashtags. Nothing is stored or sent elsewhere.
- Comment length and style adjustments are stored locally in `chrome.storage.local`; they are included in the generation prompt and are not stored in the database.

## Troubleshooting
- **No ✨ button**: refresh the page; LinkedIn may have changed its DOM — selectors live in `linkedin-dom.js`.
- **"Please log in via the extension popup first."**: open the popup and sign in.
- **"Extension was updated. Refresh the page."**: after reloading the extension, refresh LinkedIn tabs.
- Add custom model IDs to `MODELS` in `src/utils/storage.js`.

// LinkedIn DOM helpers. Each function uses several strategies (semantic attributes,
// structure, text) so a single class rename won't break the extension.
(() => {
  const POST_SELECTORS = [
    'div[data-urn^="urn:li:activity"]',
    'div[data-id^="urn:li:activity"]',
    'div[data-urn^="urn:li:share"]',
    'div[data-urn^="urn:li:ugcPost"]',
    '[data-view-name="feed-full-update"]',
    ".feed-shared-update-v2",
    'div[role="article"]',
  ];

  const COMMENT_LABEL = /\bcomment\b/i;

  const isVisible = (el) => !!el && el.getClientRects().length > 0;

  function isCommentButton(btn) {
    const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.trim();
    if (!COMMENT_LABEL.test(label)) return false;
    // Exclude "N comments" counters, "Post comment" submit, and comment-level actions.
    if (/\d+\s+comments?/i.test(label) && !/^comment/i.test(btn.textContent.trim())) return false;
    if (/post comment|submit|comments? on|reply|load more/i.test(label)) return false;
    if (btn.closest("form, .comments-comment-box, .comments-comment-item, article.comments-comment-entity")) return false;
    return true;
  }

  function findPostContainer(el) {
    for (const sel of POST_SELECTORS) {
      const c = el.closest(sel);
      if (c) {
        // Prefer the outermost activity container (reshares nest updates).
        const outer = c.parentElement?.closest('div[data-urn^="urn:li:activity"], div[data-id^="urn:li:activity"]');
        return outer || c;
      }
    }
    return null;
  }

  /** Returns unique, visible-or-rendered LinkedIn post containers. */
  function findLinkedInPosts(root = document) {
    const posts = new Set();
    root.querySelectorAll(POST_SELECTORS.join(",")).forEach((el) => {
      const c = findPostContainer(el);
      if (c && findCommentButton(c)) posts.add(c);
    });
    // Fallback: walk up from any "Comment" action button.
    root.querySelectorAll("button").forEach((btn) => {
      if (!isCommentButton(btn)) return;
      const c = findPostContainer(btn);
      if (c) posts.add(c);
    });
    // Drop containers nested inside another found container.
    return [...posts].filter((p) => ![...posts].some((o) => o !== p && o.contains(p)));
  }

  function findCommentButton(post) {
    const buttons = [...post.querySelectorAll('button, [role="button"]')];
    return (
      buttons.find((b) => /^comment$/i.test((b.getAttribute("aria-label") || "").trim())) ||
      buttons.find((b) => b.matches(".comment-button, [data-control-name='comment']")) ||
      buttons.find((b) => /^comment$/i.test(b.textContent.trim())) ||
      buttons.find(isCommentButton) ||
      null
    );
  }

  function findActionBar(post) {
    const btn = findCommentButton(post);
    if (!btn) return null;
    return (
      btn.closest(".feed-shared-social-action-bar, .social-details-social-actions, [class*='social-action']") ||
      btn.parentElement?.parentElement ||
      btn.parentElement
    );
  }

  function findCommentEditor(post) {
    const candidates = [
      ...post.querySelectorAll(
        '.comments-comment-box [contenteditable="true"], .ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"], [contenteditable="true"]'
      ),
    ].filter((el) => !el.closest(".comments-comment-item, article.comments-comment-entity") || el.closest("form"));
    return candidates.find(isVisible) || candidates[0] || null;
  }

  const textOf = (el) => (el?.innerText || el?.textContent || "").replace(/\s+\n/g, "\n").trim();

  function extractPostContent(post) {
    const pick = (sels) => {
      for (const s of sels) {
        const el = post.querySelector(s);
        const t = textOf(el);
        if (t) return t;
      }
      return "";
    };

    let postText = pick([
      ".update-components-text",
      ".feed-shared-inline-show-more-text",
      ".feed-shared-update-v2__description",
      ".feed-shared-text",
      '[data-view-name="feed-commentary"]',
      '[data-test-id="main-feed-activity-card__commentary"]',
      ".attributed-text-segment-list__content",
    ]);

    if (!postText) {
      // Fallback: longest dir="ltr" text block outside comments/actor header.
      let best = "";
      post.querySelectorAll('span[dir="ltr"], div[dir="ltr"], p').forEach((el) => {
        if (el.closest(".comments-comments-list, .comments-comment-item, .update-components-actor, button")) return;
        const t = textOf(el);
        if (t.length > best.length) best = t;
      });
      postText = best;
    }
    postText = postText.replace(/…\s*(see more|more)\s*$/i, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);

    const authorName = pick([
      ".update-components-actor__title span[aria-hidden='true']",
      ".update-components-actor__name span[aria-hidden='true']",
      ".update-components-actor__title",
      ".feed-shared-actor__name",
      '[data-view-name="feed-actor-name"]',
    ]).split("\n")[0];

    const authorHeadline = pick([
      ".update-components-actor__description span[aria-hidden='true']",
      ".update-components-actor__description",
      ".feed-shared-actor__description",
    ]).split("\n")[0];

    const articleTitle = pick([
      ".update-components-article__title",
      ".feed-shared-article__title",
      ".article-card__title",
    ]).slice(0, 300);

    const hashtags = [...new Set((postText.match(/#[\p{L}\d_]+/gu) || []))].slice(0, 10);

    return { postText, authorName, authorHeadline, articleTitle, hashtags };
  }

  /** Expand a truncated post ("…see more") so we extract the full text. */
  function expandPost(post) {
    const more = [...post.querySelectorAll("button")].find((b) =>
      /see more|…more/i.test(b.textContent) && !b.closest(".comments-comments-list")
    );
    if (more) more.click();
  }

  // ---------- New LinkedIn UI (obfuscated classes, TipTap/ProseMirror editor) ----------

  /** All comment editors on the page (old Quill and new TipTap). */
  function findAllCommentEditors(root = document) {
    return [...root.querySelectorAll('[contenteditable="true"]')].filter((el) => {
      const label = el.getAttribute("aria-label") || "";
      const ph = el.querySelector("[data-placeholder]")?.getAttribute("data-placeholder") || "";
      return /comment|reply/i.test(label + " " + ph) || el.matches(".ql-editor, .tiptap, .ProseMirror");
    });
  }

  /** The toolbar next to the editor (holds the emoji / GIF / photo buttons). */
  function findEditorToolbar(editor) {
    let node = editor;
    for (let i = 0; i < 8 && node; i++) {
      node = node.parentElement;
      const emoji = node?.querySelector('button[aria-label*="Emoji" i], button[aria-label*="emoji" i]');
      if (emoji && !editor.contains(emoji)) return emoji.parentElement;
    }
    return null;
  }

  /** Walk up from an editor to the post that owns it. */
  function findPostForEditor(editor) {
    const known = findPostContainer(editor);
    if (known) return known;
    // Climb until an ancestor contains post text (before the editor) and a Like/Comment button.
    let node = editor.parentElement;
    while (node && node !== document.body) {
      const hasActions = [...node.querySelectorAll("button")].some((b) => !b.closest('[contenteditable]') && isCommentButton(b));
      if (hasActions && textBeforeEditor(node, editor).length > 30) return node;
      node = node.parentElement;
    }
    return editor.closest('[role="listitem"], article') || editor.parentElement;
  }

  /** Longest meaningful text block that appears before the editor (i.e. the post, not comments). */
  function textBeforeEditor(post, editor) {
    let best = "";
    post.querySelectorAll('span[dir="ltr"], div[dir="ltr"], [data-testid*="text" i], p, span').forEach((el) => {
      if (el.closest('[contenteditable], button, a[href*="/in/"]')) return;
      if (!(el.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      if (el.children.length > 8) return; // skip big wrappers
      const t = textOf(el);
      if (t.length > best.length) best = t;
    });
    return best;
  }

  function extractPostContentForEditor(post, editor) {
    const data = extractPostContent(post);
    const before = textBeforeEditor(post, editor);
    if (before.length > 30 || !data.postText) {
      data.postText = before.replace(/…\s*(see more|more)\s*$/i, "").trim().slice(0, 4000);
      data.hashtags = [...new Set(data.postText.match(/#[\p{L}\d_]+/gu) || [])].slice(0, 10);
    }
    return data;
  }

  window.LIDom = {
    findAllCommentEditors,
    findEditorToolbar,
    findPostForEditor,
    extractPostContentForEditor,
    findLinkedInPosts,
    findCommentButton,
    findActionBar,
    findCommentEditor,
    extractPostContent,
    expandPost,
    isVisible,
  };
})();

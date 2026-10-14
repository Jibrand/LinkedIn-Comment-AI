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
    return editor.closest(".msg-form")?.querySelector(".msg-form__left-actions, .msg-form__footer") || null;
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
      data.postText = before.replace(/…\s*(see more|more)\s*$/i, "").trim().slice(0, window.AICommenterConfig.MAX_POST_CHARS);
      data.hashtags = [...new Set(data.postText.match(/#[\p{L}\d_]+/gu) || [])].slice(0, 10);
    }
    return data;
  }

  const COMMENT_SELECTORS = [
    ".comments-comment-item",
    "article.comments-comment-entity",
    '[data-view-name*="comment" i]',
    '[data-testid*="comment" i]',
  ];
  const NOISE = /^(like|reply|edited|see more|more|follow|following|share|send|[\d,.]+[kKmM]?)$/i;

  function cleanCommentText(value) {
    return String(value || "")
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line && !NOISE.test(line) && !/^\d+[smhdwy]$/i.test(line))
      .join(" ")
      .replace(/…\s*(see more|more)$/i, "")
      .trim();
  }

  function commentAuthor(item) {
    const author = item.querySelector([
      ".comments-post-meta__name-text",
      ".comments-comment-item__post-meta .hoverable-link-text",
      ".comments-comment-item__post-meta a",
      '[data-view-name*="comment-author" i]',
      "a[href*='/in/']",
    ].join(", "));
    return cleanCommentText(author?.innerText || author?.textContent).split(" ")[0] || "Unknown";
  }

  function commentText(item) {
    const content = item.querySelector([
      ".comments-comment-item__main-content",
      ".comments-comment-item-content-body",
      ".update-components-text",
      '[data-view-name*="comment-content" i]',
      '[data-testid*="comment-content" i]',
    ].join(", "));
    const source = content || item;
    return cleanCommentText(source.innerText || source.textContent);
  }

  function isOwnComment(item, author) {
    return /^(you|me)$/i.test(author) ||
      item.matches("[data-is-self='true'], [data-owned-by-viewer='true']") ||
      Boolean(item.querySelector("[data-is-self='true'], [data-owned-by-viewer='true']"));
  }

  function getCommentItems(post) {
    const items = [];
    for (const selector of COMMENT_SELECTORS) {
      post.querySelectorAll(selector).forEach((item) => {
        if (!items.includes(item) && isVisible(item)) items.push(item);
      });
    }
    return items.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }

  function findParentComment(post, editor) {
    const direct = editor.closest(COMMENT_SELECTORS.join(","));
    if (direct && commentText(direct).length >= window.AICommenterConfig.MIN_COMMENT_CHARS) return direct;
    if (!isReplyEditor(editor)) return null;
    const items = getCommentItems(post);
    return items.filter((item) => item.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || null;
  }

  function isReplyEditor(editor) {
    const marker = `${editor.getAttribute("aria-label") || ""} ${editor.getAttribute("data-placeholder") || ""} ${editor.parentElement?.innerText || ""}`;
    return /\breply\b/i.test(marker);
  }

  function extractThreadContext(post, editor, requestedLimit = 10) {
    const config = window.AICommenterConfig;
    const limit = config.MAX_THREAD_COMMENTS_OPTIONS.includes(Number(requestedLimit))
      ? Number(requestedLimit)
      : config.MAX_THREAD_COMMENTS;
    const parentItem = findParentComment(post, editor);
    if (isReplyEditor(editor) && !parentItem) return { comments: [], replyingTo: null };
    const allItems = getCommentItems(post);
    const items = parentItem
      ? allItems.filter((item) => item !== parentItem && parentItem.contains(item))
      : allItems.filter((item) => !item.parentElement?.closest(COMMENT_SELECTORS.join(",")));
    const parentAuthor = parentItem ? commentAuthor(parentItem) : "";
    const parentRawText = parentItem ? commentText(parentItem) : "";
    const parentText = parentRawText.length > config.MAX_CHARS_PER_COMMENT
      ? `${parentRawText.slice(0, config.MAX_CHARS_PER_COMMENT - 1)}…`
      : parentRawText;
    const seen = new Set();
    const comments = [];
    let total = parentText.length;
    for (const item of items) {
      const author = commentAuthor(item);
      const text = commentText(item);
      const key = `${author.toLowerCase()}\n${text.toLowerCase()}`;
      if (isOwnComment(item, author) || text.length < config.MIN_COMMENT_CHARS || seen.has(key)) continue;
      const clipped = text.length > config.MAX_CHARS_PER_COMMENT
        ? `${text.slice(0, config.MAX_CHARS_PER_COMMENT - 1)}…`
        : text;
      if (total + clipped.length > config.MAX_THREAD_TOTAL_CHARS) break;
      seen.add(key);
      comments.push({ author, text: clipped });
      total += clipped.length;
      if (comments.length >= limit) break;
    }

      let replyingTo = null;
    if (parentItem) {
      if (parentText.length >= config.MIN_COMMENT_CHARS) {
        replyingTo = {
          author: parentAuthor,
          text: parentText,
        };
      }
    }
    return { comments: replyingTo ? comments.slice(0, config.MAX_NEARBY_REPLIES) : comments, replyingTo };
  }

  const DM_COMPOSER_SELECTORS = [
    '[contenteditable="true"][data-placeholder*="message" i]',
    '[contenteditable="true"][aria-label*="message" i]',
    '.msg-form__contenteditable[contenteditable="true"]',
    '.msg-form__msg-content-container [contenteditable="true"]',
  ];
  const DM_MESSAGE_SELECTORS = [
    ".msg-s-message-list__event",
    ".msg-s-message-list-content",
    '[data-event-urn*="messaging"]',
    '[data-view-name*="message" i]',
  ];
  const DM_NOISE = /^(seen|delivered|sent|today|yesterday|just now|like|reply|more|message|you joined|joined)$/i;

  function isMessagingPage() {
    return location.pathname.startsWith("/messaging/");
  }

  function findMessageEditors(root = document) {
    return [...root.querySelectorAll(DM_COMPOSER_SELECTORS.join(","))].filter(isVisible);
  }

  function dmText(el) {
    return cleanCommentText(el?.innerText || el?.textContent || "");
  }

  function dmProspect(editor) {
    const scope = editor.closest(".msg-overlay-conversation-bubble, .msg-conversation-card, main, body") || document.body;
    const nameSelectors = [
      ".msg-thread__link-to-profile",
      ".msg-entity-lockup__entity-title",
      ".msg-overlay-bubble-header__link",
      ".msg-conversation-card__participant-names",
      '[data-view-name*="conversation" i] a[href*="/in/"]',
    ];
    const headlineSelectors = [
      ".msg-entity-lockup__entity-subtitle",
      ".msg-thread__link-to-profile + div",
      ".msg-overlay-bubble-header__subtitle",
      '[data-view-name*="profile" i] [class*="subtitle" i]',
    ];
    const pick = (selectors) => {
      for (const selector of selectors) {
        const value = dmText(scope.querySelector(selector));
        if (value && !DM_NOISE.test(value)) return value;
      }
      return "";
    };
    return {
      name: pick(nameSelectors).slice(0, window.AICommenterConfig.MAX_DM_NAME_CHARS),
      headline: pick(headlineSelectors).slice(0, window.AICommenterConfig.MAX_DM_HEADLINE_CHARS),
    };
  }

  function dmSender(item, prospectName) {
    if (item.matches(".msg-s-message-list__event--outbound, .msg-s-message-list__event--outgoing") ||
        item.querySelector(".msg-s-message-list__event--outbound, [data-is-outgoing='true']")) return "me";
    const sender = dmText(item.querySelector(".msg-s-message__name, .msg-s-message-group__name, [data-view-name*='sender' i]"));
    if (sender && prospectName && sender.toLowerCase() !== prospectName.toLowerCase()) return "me";
    if (item.matches(".msg-s-message-list__event--inbound, .msg-s-message-list__event--incoming") ||
        item.querySelector(".msg-s-message-list__event--inbound, [data-is-outgoing='false']")) return "them";
    return sender && prospectName && sender.toLowerCase() === prospectName.toLowerCase() ? "them" : null;
  }

  function extractDMContext(editor, requestedLimit = 10) {
    const config = window.AICommenterConfig;
    const limit = config.MAX_DM_MESSAGES_OPTIONS.includes(Number(requestedLimit))
      ? Number(requestedLimit)
      : config.MAX_DM_MESSAGES;
    const prospect = dmProspect(editor);
    const scope = editor.closest(".msg-overlay-conversation-bubble, .msg-conversation-card, main") || document.body;
    const nodes = [];
    for (const selector of DM_MESSAGE_SELECTORS) {
      scope.querySelectorAll(selector).forEach((item) => {
        if (!nodes.includes(item) && isVisible(item)) nodes.push(item);
      });
    }
    nodes.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const messages = [];
    let total = 0;
    for (const item of nodes.slice(-limit * 2)) {
      const content = item.querySelector(".msg-s-event-listitem__body, .msg-s-message__content, [data-view-name*='message-content' i]");
      const text = dmText(content || item) ||
        (item.querySelector("img, [data-test-icon='image'], [class*='attachment' i]") ? "[image]" : "");
      if (!text || DM_NOISE.test(text) || /^\d+[smhd]$/.test(text)) continue;
      const from = dmSender(item, prospect.name);
      if (!from) continue;
      const clipped = text.length > config.MAX_DM_MESSAGE_CHARS
        ? `${text.slice(0, config.MAX_DM_MESSAGE_CHARS - 1)}…`
        : text;
      if (total + clipped.length > config.MAX_DM_TOTAL_CHARS) break;
      messages.push({ from, text: clipped });
      total += clipped.length;
    }
    return { prospect, messages: messages.slice(-limit) };
  }

  window.LIDom = {
    findAllCommentEditors,
    findEditorToolbar,
    findPostForEditor,
    extractPostContentForEditor,
    extractThreadContext,
    isMessagingPage,
    findMessageEditors,
    extractDMContext,
    findLinkedInPosts,
    findCommentButton,
    findActionBar,
    findCommentEditor,
    extractPostContent,
    expandPost,
    isVisible,
  };
})();

// Content script: injects the ✨ AI button and inserts generated comments.
// It NEVER clicks LinkedIn's "Post" button — the user always submits manually.
(() => {
  const { findLinkedInPosts, findCommentButton, findActionBar, findCommentEditor, extractPostContent, expandPost, isVisible } = window.LIDom;
  const ATTR = "data-ai-commenter-attached";
  const BUTTON_ATTR = "data-ai-commenter-button";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function requestComment(postData) {
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      throw new Error("Extension connection unavailable. Reload this LinkedIn tab and try again.");
    }
    try {
      return await chrome.runtime.sendMessage({ type: "GENERATE_COMMENT", postData });
    } catch (error) {
      if (/Extension context invalidated|Receiving end does not exist|message port closed/i.test(error.message || "")) {
        throw new Error("Extension connection unavailable. Reload this LinkedIn tab and try again.");
      }
      throw error;
    }
  }

  // Extension logo, embedded as a data URI (no extension URL requests).
  const ICON = `<img class="aic-icon" src="data:image/png;base64,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" width="20" height="20" alt="" draggable="false">`;
  (function injectGradient() {
    if (document.getElementById("aic-grad")) return;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    defs.setAttribute("width", "0"); defs.setAttribute("height", "0");
    defs.setAttribute("aria-hidden", "true");
    defs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    defs.innerHTML = `<defs><linearGradient id="aic-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A66C2"/><stop offset="1" stop-color="#7B3FE4"/></linearGradient></defs>`;
    document.body.appendChild(defs);
  })();

  function attachAIButton(post) {
    if (post.getAttribute(ATTR) === "true" && post.querySelector(`[${BUTTON_ATTR}]`)) return;
    const bar = findActionBar(post);
    if (!bar) return;
    post.setAttribute(ATTR, "true");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-commenter-btn";
    btn.setAttribute(BUTTON_ATTR, "true");
    btn.title = "Generate AI comment";
    btn.setAttribute("aria-label", "Generate AI comment");
    btn.innerHTML = `${ICON}<span class="ai-commenter-label">AI</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleClick(post, btn);
    });
    bar.appendChild(btn);
  }

  function setState(btn, state, msg) {
    const label = btn.querySelector(".ai-commenter-label");
    btn.classList.remove("is-loading", "is-error");
    btn.disabled = false;
    if (state === "loading") {
      btn.classList.add("is-loading");
      btn.disabled = true;
      label.textContent = "Generating…";
    } else if (state === "error") {
      btn.classList.add("is-error");
      label.textContent = "Retry";
    } else {
      label.textContent = "AI";
    }
    if (msg) toast(msg, state === "error");
  }

  function toast(text, isError) {
    document.querySelector(".ai-commenter-toast")?.remove();
    const t = document.createElement("div");
    t.className = `ai-commenter-toast${isError ? " is-error" : ""}`;
    t.setAttribute("role", "status");
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  async function handleClick(post, btn) {
    if (btn.disabled) return;
    setState(btn, "loading");
    try {
      expandPost(post);
      await sleep(150);
      const postData = extractPostContent(post);
      if (!postData.postText) throw new Error("Couldn't find text in this post.");

      const res = await requestComment(postData);
      if (!res?.ok) throw new Error(res?.error || "Couldn't generate a comment. Try again.");

      const editor = await openCommentEditor(post);
      if (!editor) throw new Error("Comment box not found. Click Comment, then try again.");

      const ok = insertComment(editor, res.comment);
      if (!ok) throw new Error("Couldn't insert the comment. Try again.");
      setState(btn, "idle", "Comment inserted — review and click Post yourself.");
    } catch (e) {
      const msg = /Extension context invalidated/i.test(e.message)
        ? "Extension was updated. Refresh the page."
        : e.message || "Couldn't generate comment";
      setState(btn, "error", msg);
    }
  }

  async function openCommentEditor(post) {
    let editor = findCommentEditor(post);
    if (editor && isVisible(editor)) return editor;
    findCommentButton(post)?.click();
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      editor = findCommentEditor(post);
      if (editor && isVisible(editor)) return editor;
    }
    return editor;
  }

  function insertComment(editor, text) {
    editor.scrollIntoView({ block: "center", behavior: "smooth" });
    editor.focus();

    // Replace any existing draft: select all inside the editor.
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch {}

    const visible = () => editor.innerText.replace(/\s+/g, " ").includes(text.replace(/\s+/g, " ").slice(0, 40));

    if (!ok || !visible()) {
      // Fallback: synthetic paste, which Quill/LinkedIn editors handle.
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      } catch {}
    }
    if (!visible()) {
      // Last resort: replace only the editor's text through a Range.
      const fallbackRange = document.createRange();
      fallbackRange.selectNodeContents(editor);
      fallbackRange.deleteContents();
      fallbackRange.insertNode(document.createTextNode(text));
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));

    // Caret at end so the user can keep typing.
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    sel.removeAllRanges();
    sel.addRange(end);
    return visible();
  }

  // --- AI button inside the comment box toolbar (emoji / GIF / photo row) ---
  function attachEditorButton(editor) {
    const toolbar = LIDom.findEditorToolbar(editor);
    if (!toolbar || toolbar.querySelector(`[${BUTTON_ATTR}]`)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-commenter-btn ai-commenter-btn--icon";
    btn.setAttribute(BUTTON_ATTR, "true");
    btn.title = "Generate AI comment";
    btn.setAttribute("aria-label", "Generate AI comment");
    btn.innerHTML = `${ICON}<span class="ai-commenter-label"></span>`;
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep editor focus
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      btn.classList.remove("is-error");
      btn.classList.add("is-loading");
      btn.disabled = true;
      btn.title = "Generating…";
      try {
        const post = LIDom.findPostForEditor(editor);
        expandPost(post);
        await sleep(150);
        const postData = LIDom.extractPostContentForEditor(post, editor);
        if (!postData.postText) throw new Error("Couldn't find text in this post.");
        const res = await requestComment(postData);
        if (!res?.ok) throw new Error(res?.error || "Couldn't generate a comment. Try again.");
        if (!insertComment(editor, res.comment)) throw new Error("Couldn't insert the comment. Try again.");
        toast("Comment inserted — review and click Post yourself.");
        btn.title = "Generate AI comment";
      } catch (err) {
        btn.classList.add("is-error");
        btn.title = "Couldn't generate comment — click to retry";
        toast(/context invalidated/i.test(err.message) ? "Extension was updated. Refresh the page." : err.message, true);
      } finally {
        btn.classList.remove("is-loading");
        btn.disabled = false;
      }
    });
    toolbar.insertBefore(btn, toolbar.firstChild);
  }

  // --- Dynamic detection: MutationObserver + SPA navigation ---
  let scheduled = false;
  function scan() {
    scheduled = false;
    try {
      LIDom.findAllCommentEditors().forEach((editor) => {
        if (editor.isConnected) attachEditorButton(editor);
      });
    } catch (e) { console.error("AI commenter editor scan failed:", e); }
    try { findLinkedInPosts().forEach(attachAIButton); } catch (e) { console.error("AI commenter post scan failed:", e); }
  }
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    if (window.requestIdleCallback) window.requestIdleCallback(scan, { timeout: 500 });
    else setTimeout(scan, 100);
  }

  const pageObserver = new MutationObserver((muts) => {
    if (muts.some((m) => m.addedNodes.length || m.removedNodes.length)) scheduleScan();
  });
  pageObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("focusin", (event) => {
    if (event.target.matches?.('[contenteditable="true"]')) {
      attachEditorButton(event.target);
      scheduleScan();
    }
  }, true);

  let lastUrl = location.href;
  const navigationTimer = setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; scheduleScan(); }
  }, 1000);
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("beforeunload", () => {
    pageObserver.disconnect();
    clearInterval(navigationTimer);
  }, { once: true });

  scan();
})();

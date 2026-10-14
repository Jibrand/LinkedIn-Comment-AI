// Content script: injects the ✨ AI button and inserts generated comments.
// It NEVER clicks LinkedIn's "Post" button — the user always submits manually.
(() => {
  const { findLinkedInPosts, findCommentButton, findActionBar, findCommentEditor, extractPostContent, expandPost, isVisible } = window.LIDom;
  const ATTR = "data-ai-commenter-attached";
  const BUTTON_ATTR = "data-ai-commenter-button";
  const boxStates = new WeakMap();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getBoxKey(editor) {
    const replyContainer = editor.closest(".comments-comment-item, article.comments-comment-entity");
    if (replyContainer) return replyContainer;
    if (editor.closest(".msg-form")) return editor.closest(".msg-form");
    // The post container survives LinkedIn replacing the comment form/editor.
    // Use it for the main comment box so focus and blur cannot create a new state.
    try {
      const post = window.LIDom?.findPostForEditor(editor);
      if (post) return post;
    } catch {}
    return editor.closest("form, .comments-comment-box, [data-test-id*='comment' i]") || editor;
  }

  function getBoxState(editor) {
    const key = getBoxKey(editor);
    let state = boxStates.get(key);
    if (!state) {
      state = {
        key,
        editor,
        status: "idle",
        loading: false,
        isInsertingProgrammatically: false,
        history: [],
        buttons: new Set(),
        postData: () => ({}),
      };
      boxStates.set(key, state);
    }
    state.editor = editor;
    return state;
  }

  function renderButton(state) {
    const buttons = state.buttons || new Set([state.button].filter(Boolean));
    buttons.forEach((btn) => {
      if (!btn.isConnected) return;
      btn.classList.toggle("done", state.status === "done");
      btn.classList.toggle("is-loading", state.status === "loading");
      btn.classList.toggle("is-error", state.status === "error");
      btn.disabled = state.status === "loading";
      btn.title = state.status === "done" ? "Refine or regenerate" : state.status === "loading" ? "Generating…" : state.status === "error" ? "Retry" : "Generate AI comment";
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function syncPostButtons(post, state) {
    if (!post) return;
    post.querySelectorAll(`[${BUTTON_ATTR}]`).forEach((host) => {
      const button = host.shadowRoot?.querySelector("button");
      if (!button) return;
      state.buttons.add(button);
      button.__controller = state;
    });
    renderButton(state);
  }

  function setBoxState(state, status, message) {
    state.status = status;
    renderButton(state);
    if (message) toast(message, status === "error");
  }

  async function requestComment(postData, refine = {}, signal) {
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      throw new Error("Extension connection unavailable. Reload this LinkedIn tab and try again.");
    }

    try {
      const request = chrome.runtime.sendMessage({ type: "GENERATE_COMMENT", postData, refine });
      if (!signal) return await request;
      return await Promise.race([
        request,
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Generation cancelled.")), { once: true })),
      ]);
    } catch (error) {
      if (/Extension context invalidated|Receiving end does not exist|message port closed/i.test(error.message || "")) {
        throw new Error("Extension connection unavailable. Reload this LinkedIn tab and try again.");
      }
      throw error;
    }
  }

  async function requestDM(dmData, refine = {}, signal) {
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      throw new Error("Extension connection unavailable. Reload this LinkedIn tab and try again.");
    }
    const request = chrome.runtime.sendMessage({ type: "GENERATE_COMMENT", kind: "DM", dmData, refine });
    if (!signal) return request;
    return Promise.race([
      request,
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Generation cancelled.")), { once: true })),
    ]);
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

    const widget = createShadowButton();
    const btn = widget.button;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains("done")) {
        openRefinePanel(btn.__controller);
        return;
      }
      handleClick(post, btn);
    });
    bar.appendChild(widget.host);
  }

  function setState(btn, state, msg) {
    btn.classList.remove("done", "is-loading", "is-error");
    btn.disabled = state === "loading";
    if (state === "loading") {
      btn.classList.add("is-loading");
      btn.title = "Generating…";
    } else if (state === "done") {
      btn.classList.add("done");
      btn.title = "Refine or regenerate";
    } else if (state === "error") {
      btn.classList.add("is-error");
      btn.title = "Retry";
    } else {
      btn.title = "Generate AI comment";
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

  const SHADOW_STYLES = `
    :host { all: initial; }
    button { box-sizing: border-box; border: 0; font: 600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .button { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; padding:0; border-radius:50%; background:transparent; color:#0a66c2; cursor:pointer; }
    .button:hover { background:rgba(10,102,194,.12); }
    .button.done { color:#16834b; }
    .button.done img { display:none !important; }
    .button.done::after { content:"↻"; font:700 24px/1 sans-serif; }
    .button.loading img,.button.is-loading img { animation:spin .8s linear infinite; }
    .button.error { color:#b24020; }
    img { width:20px; height:20px; border-radius:5px; pointer-events:none; }
    .panel { position:fixed; z-index:2147483647; width:min(330px,calc(100vw - 20px)); padding:12px; color:#1d2226; background:#fff; border:1px solid #e3e6e8; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); font:13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    @media (prefers-color-scheme:dark) { .panel { color:#f3f6f8; background:#1d2226; border-color:#38434d; } }
    h3 { margin:0 0 9px; font-size:14px; } .pills { display:flex; flex-wrap:wrap; gap:5px; }
    .pill,.action { padding:6px 8px; border:1px solid #cfd3d8; border-radius:999px; background:transparent; color:inherit; cursor:pointer; }
    .pill:hover,.action:hover { border-color:#7b3fe4; } .divider { height:1px; margin:11px 0; background:#e3e6e8; }
    .custom { display:flex; gap:6px; } input { min-width:0; flex:1; padding:7px 8px; border:1px solid #cfd3d8; border-radius:7px; font:inherit; }
    .send,.primary { padding:7px 10px; border-radius:7px; background:linear-gradient(135deg,#0a66c2,#7b3fe4); color:white; cursor:pointer; }
    .send:disabled { opacity:.5; cursor:not-allowed; } .counter,.message { color:#666; font-size:11px; margin-top:4px; }
    .bottom { display:flex; gap:6px; margin-top:10px; } .message.error { color:#b24020; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `;

  function createShadowButton() {
    const host = document.createElement("span");
    host.setAttribute(BUTTON_ATTR, "true");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${SHADOW_STYLES}</style><button class="button" type="button" aria-label="Generate AI comment" title="Generate AI comment">${ICON}</button>`;
    return { host, button: root.querySelector("button"), root };
  }

  function positionPanel(panel, host) {
    const rect = host.getBoundingClientRect();
    panel.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 340))}px`;
    panel.style.top = `${rect.top > 250 ? rect.top - panel.offsetHeight - 8 : rect.bottom + 8}px`;
  }

  function openRefinePanel(controller) {
    if (controller.panel) {
      controller.panel.remove();
      controller.panel = null;
      return;
    }
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Refine this comment");
    const pills = controller.kind === "dm"
      ? ["Shorter", "More casual", "More professional", "Less AI-sounding", "Add a question", "Softer", "More direct", "Suggest a call", "Follow up politely", "Remove emojis"]
      : ["Shorter", "Longer", "More casual", "More professional", "Less AI-sounding", "Add a question", "Add a touch of humor", "Remove emojis", "More direct", "Agree more", "Respectfully disagree"];
    panel.innerHTML = `<h3>Refine this comment</h3><div class="pills">${pills.map((p) => `<button class="pill" type="button">${p}</button>`).join("")}</div><div class="divider"></div><div class="custom"><input maxlength="200" placeholder="e.g. mention my experience in sales, keep it under 20 words" aria-label="Custom refinement instruction"><button class="send" type="button" disabled>Send</button></div><div class="counter">0/200</div><div class="message" role="status"></div><div class="bottom"><button class="action fresh" type="button">Regenerate fresh</button><button class="action undo" type="button">Undo</button></div>`;
    controller.root.appendChild(panel);
    controller.panel = panel;
    positionPanel(panel, controller.host);
    const input = panel.querySelector("input");
    const message = panel.querySelector(".message");
    const send = panel.querySelector(".send");
    const run = (instruction) => refineComment(controller, instruction, message);
    panel.querySelectorAll(".pill").forEach((pill) => pill.addEventListener("click", () => run(pill.textContent)));
    input.addEventListener("input", () => {
      panel.querySelector(".counter").textContent = `${input.value.length}/200`;
      send.disabled = !input.value.trim() || controller.loading;
    });
    send.addEventListener("click", () => run(input.value.trim()));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && input.value.trim()) { event.preventDefault(); run(input.value.trim()); }
    });
    panel.querySelector(".fresh").addEventListener("click", () => run("Regenerate fresh"));
    panel.querySelector(".undo").addEventListener("click", () => {
      const previous = controller.history.pop();
      if (previous) {
        insertComment(controller.editor, previous);
        message.textContent = "Restored the previous version.";
      }
    });
    const close = (event) => {
      if (event.key === "Escape") {
        panel.remove();
        controller.panel = null;
        document.removeEventListener("keydown", close, true);
      }
    };
    const outside = (event) => {
      if (!controller.host.contains(event.target) && !panel.contains(event.target)) {
        panel.remove();
        controller.panel = null;
        document.removeEventListener("keydown", close, true);
        document.removeEventListener("pointerdown", outside, true);
      }
    };
    document.addEventListener("keydown", close, true);
    document.addEventListener("pointerdown", outside, true);
    setTimeout(() => positionPanel(panel, controller.host), 0);
  }

  async function refineComment(controller, instruction, message) {
    if (!instruction || controller.loading) return;
    controller.loading = true;
    controller.status = "loading";
    renderButton(controller);
    message.textContent = "Generating…";
    message.className = "message";
    controller.abortController?.abort();
    controller.abortController = new AbortController();
    try {
      const context = controller.kind === "dm" ? controller.dmData() : controller.postData();
      const previousText = controller.editor.innerText;
      const response = controller.kind === "dm" ? await requestDM(
        context,
        instruction === "Regenerate fresh" ? {} : { currentMessage: controller.editor.innerText, instruction },
        controller.abortController.signal
      ) : await requestComment(
        context,
        instruction === "Regenerate fresh"
          ? {}
          : { currentComment: controller.editor.innerText, instruction },
        controller.abortController.signal
      );
      if (!response?.ok) throw new Error(response?.error || "Could not refine this comment.");
      controller.history.push(previousText);
      controller.history = controller.history.slice(-window.AICommenterConfig.MAX_REFINE_HISTORY);
      if (!insertComment(controller.editor, response.comment)) throw new Error("Could not insert the refined comment.");
      controller.status = "done";
      renderButton(controller);
      message.textContent = "Updated. You can refine again or undo.";
    } catch (error) {
      if (error.message !== "Generation cancelled.") {
        message.textContent = error.message || "Could not refine this comment.";
        message.className = "message error";
      }
    } finally {
      controller.loading = false;
      if (controller.status === "loading") controller.status = "done";
      renderButton(controller);
    }
  }

  async function handleClick(post, btn) {
    if (btn.disabled) return;
    setState(btn, "loading");
    let generatedPostData;
    try {
      const editor = await openCommentEditor(post);
      if (!editor) throw new Error("Comment box not found. Click Comment, then try again.");
      const postData = extractPostContent(post);
      if (!postData.postText) throw new Error("Couldn't find text in this post.");
      await addThreadContext(postData, post, editor);
      generatedPostData = postData;

      const res = await requestComment(postData);
      if (!res?.ok) throw new Error(res?.error || "Couldn't generate a comment. Try again.");

      const ok = insertComment(editor, res.comment);
      if (!ok) throw new Error("Couldn't insert the comment. Try again.");
      const state = getBoxState(editor);
      state.button = btn;
      state.buttons.add(btn);
      state.host = btn.getRootNode().host;
      state.root = btn.getRootNode();
      state.postData = () => ({ ...generatedPostData });
      state.status = "done";
      btn.__controller = state;
      attachEditorButton(editor);
      syncPostButtons(post, state);
      scheduleScan();
      renderButton(state);
      // This action-bar button starts outside the editor state lifecycle.
      // Apply the final visual state explicitly so it changes on generation 1.
      setState(btn, "done");
      // LinkedIn may repaint the composer in the next render frame. Reapply
      // the same state to every icon after that repaint as well.
      requestAnimationFrame(() => syncPostButtons(post, state));
      toast("Comment inserted — review and click Post yourself.");
      renderButton(state);
    } catch (e) {
      const msg = /Extension context invalidated/i.test(e.message)
        ? "Extension was updated. Refresh the page."
        : e.message || "Couldn't generate comment";
      setState(btn, "error", msg);
    }

  }

  async function addThreadContext(postData, post, editor) {
    try {
      const settings = await chrome.storage.local.get({ readThread: true, threadCommentCount: 10 });
      if (settings.readThread === false) return;
      postData.postText = postData.postText.slice(0, window.AICommenterConfig.MAX_POST_CHARS);
      const owner = post || (editor && LIDom.findPostForEditor(editor));
      if (owner) postData.threadContext = LIDom.extractThreadContext(owner, editor, settings.threadCommentCount);
    } catch (error) {
      if (window.AICommenterConfig.DEBUG_THREAD) console.debug("Thread scrape skipped:", error);
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
    const state = getBoxState(editor);
    state.isInsertingProgrammatically = true;
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
    const result = visible();
    queueMicrotask(() => { state.isInsertingProgrammatically = false; });
    return result;
  }

  // --- AI button inside the comment box toolbar (emoji / GIF / photo row) ---
  function attachEditorButton(editor) {
    const toolbar = LIDom.findEditorToolbar(editor);
    if (!toolbar) return;

    const state = getBoxState(editor);
    const existingHost = toolbar.querySelector(`[${BUTTON_ATTR}]`);
    if (existingHost) {
      const existingButton = existingHost.shadowRoot?.querySelector("button");
      if (existingButton) {
        // Preserve the completed visual state when LinkedIn keeps the host
        // but replaces the editor that originally owned it.
        if (state.status === "idle" && existingButton.classList.contains("done")) {
          state.status = "done";
        }
        state.button = existingButton;
        state.buttons.add(existingButton);
        existingButton.__controller = state;
        renderButton(state);
      }
      return;
    }
    const widget = createShadowButton();
    const btn = widget.button;
    state.button = btn;
    state.buttons.add(btn);
    state.host = widget.host;
    state.root = widget.root;
    renderButton(state);
    editor.addEventListener("input", () => {
      // A replaced editor may emit a final empty event while LinkedIn moves
      // focus. It must not reset the state owned by the current editor.
      if (
        state.editor === editor &&
        editor.isConnected &&
        !state.isInsertingProgrammatically &&
        !editor.innerText.trim()
      ) {
        state.status = "idle";
        renderButton(state);
      }
    });
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep editor focus
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.status === "loading") return;
      if (state.status === "done") {
        openRefinePanel(state);
        return;
      }
      state.status = "loading";
      state.loading = true;
      renderButton(state);
      try {
        const post = LIDom.findPostForEditor(editor);
        const postData = LIDom.extractPostContentForEditor(post, editor);
        if (!postData.postText) throw new Error("Couldn't find text in this post.");
        await addThreadContext(postData, post, editor);
        const res = await requestComment(postData);
        if (!res?.ok) throw new Error(res?.error || "Couldn't generate a comment. Try again.");
        if (!insertComment(editor, res.comment)) throw new Error("Couldn't insert the comment. Try again.");
        state.postData = () => ({ ...postData });
        state.status = "done";
        state.loading = false;
        btn.__controller = state;
        renderButton(state);
        toast("Comment inserted — review and click Post yourself.");
      } catch (err) {
        state.status = "error";
        renderButton(state);
        toast(/context invalidated/i.test(err.message) ? "Extension was updated. Refresh the page." : err.message, true);
      } finally {
        state.loading = false;
        if (state.status === "loading") state.status = "idle";
        renderButton(state);
      }
    });
    toolbar.insertBefore(widget.host, toolbar.firstChild);
  }

  function attachDMButton(editor) {
    const toolbar = LIDom.findEditorToolbar(editor) ||
      editor.closest(".msg-form")?.querySelector(".msg-form__left-actions, .msg-form__footer");
    if (!toolbar || toolbar.querySelector(`[${BUTTON_ATTR}]`)) return;
    const settingsPromise = chrome.storage.local.get({ dmEnabled: true, dmMessageCount: 10, dmGoal: "Reply naturally" });
    const state = getBoxState(editor);
    state.kind = "dm";
    const widget = createShadowButton();
    const btn = widget.button;
    state.button = btn;
    state.buttons.add(btn);
    state.host = widget.host;
    state.root = widget.root;
    btn.setAttribute("aria-label", "Generate AI message");
    renderButton(state);
    editor.addEventListener("input", () => {
      if (!state.isInsertingProgrammatically && !editor.innerText.trim()) {
        state.status = "idle";
        renderButton(state);
      }
    });
    btn.addEventListener("mousedown", (event) => event.preventDefault());
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.status === "loading") return;
      if (state.status === "done") return openRefinePanel(state);
      const settings = await settingsPromise;
      if (settings.dmEnabled === false) return;
      state.status = "loading";
      state.loading = true;
      renderButton(state);
      try {
        const dmData = LIDom.extractDMContext(editor, settings.dmMessageCount);
        state.dmData = () => ({ ...dmData, messages: [...dmData.messages] });
        state.dmGoal = settings.dmGoal;
        const response = await requestDM({ ...dmData, dmGoal: settings.dmGoal });
        if (!response?.ok) throw new Error(response?.error || "Could not draft a message.");
        if (!insertComment(editor, response.comment)) throw new Error("Could not insert the message.");
        state.status = "done";
        state.loading = false;
        renderButton(state);
        toast("Message drafted. Review it before sending.");
      } catch (error) {
        state.status = "error";
        renderButton(state);
        toast(error.message || "Could not draft a message.", true);
      } finally {
        state.loading = false;
        renderButton(state);
      }
    });
    toolbar.insertBefore(widget.host, toolbar.firstChild);
  }

  // --- Dynamic detection: MutationObserver + SPA navigation ---
  let scheduled = false;
  function scan() {
    scheduled = false;
    try {
      LIDom.findMessageEditors().forEach((editor) => {
        if (editor.isConnected) attachDMButton(editor);
      });
    } catch (e) {
      if (window.AICommenterConfig.DEBUG_DM) console.debug("DM scan failed:", e);
    }
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
      if (LIDom.findMessageEditors().includes(event.target)) attachDMButton(event.target);
      else attachEditorButton(event.target);
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

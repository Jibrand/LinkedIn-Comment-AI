(() => {
  "use strict";

  const cleanUrl = (href) => {
    if (!href) return "";
    try {
      const url = new URL(href);
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return href;
    }
  };

  function findMoreButton() {
    const buttons = [...document.querySelectorAll("button, [role='button']")]
      .filter((element) => element.getClientRects().length);
    return buttons.find((element) => /more|actions/i.test(
      `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`
    )) || buttons.find((element) => element.textContent.trim() === "...");
  }

  function findPublicUrl() {
    const link = [...document.querySelectorAll("a[href*='/in/']")]
      .find((element) => element.getClientRects().length);
    return cleanUrl(link?.href);
  }

  function findMenuProfileUrl() {
    const item = [...document.querySelectorAll("a, button, [role='menuitem']")]
      .find((element) => /view linkedin profile|copy linkedin\.com url/i.test(
        element.innerText || element.textContent || ""
      ));
    return cleanUrl(item?.href) || findPublicUrl();
  }

  function extract() {
    let sent = false;
    const sendResult = (linkedinUrl) => {
      if (sent) return;
      sent = true;
      chrome.runtime.sendMessage({ type: "LEAD_PUBLIC_URL", linkedinUrl });
    };

    const existing = findPublicUrl();
    if (existing) {
      sendResult(existing);
      return;
    }
    const menu = findMoreButton();
    if (!menu) {
      sendResult("");
      return;
    }
    menu.click();
    const started = Date.now();
    const timer = window.setInterval(() => {
      const url = findMenuProfileUrl();
      if (url || Date.now() - started > 8000) {
        window.clearInterval(timer);
        sendResult(url);
      }
    }, 250);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EXTRACT_PUBLIC_URL") extract();
  });
})();

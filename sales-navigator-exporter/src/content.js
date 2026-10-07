(() => {
  "use strict";

  const PANEL_ID = "sn-visible-exporter";
  let lastCount = -1;
  let refreshTimer = 0;
  const resolvedUrls = new Map();
  const CARD_SELECTORS = [
    "[data-x-search-result]",
    ".search-results__list-item",
    ".artdeco-list__item"
  ];

  const text = (element) => (element?.innerText || "").replace(/\s+/g, " ").trim();
  const visible = (element) => Boolean(element && element.getClientRects().length);

  function cleanUrl(link) {
    if (!link) return "";
    try {
      const url = new URL(link.href);
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return link.href;
    }
  }

  function publicProfileUrl(card) {
    const link = [...card.querySelectorAll("a[href*='/in/']")].find(visible);
    return cleanUrl(link);
  }

  function salesNavigatorUrl(card) {
    const link = [...card.querySelectorAll("a[href*='/sales/lead/']")].find(visible);
    if (!link) return "";
    return cleanUrl(link);
  }

  function nameFrom(card, link) {
    const candidate = card.querySelector([
      ".artdeco-entity-lockup__title",
      ".entity-result__title-text",
      "[data-anonymize='person-name']",
      "[data-anonymize='person-name'] span"
    ].join(","));
    if (candidate && text(candidate)) return text(candidate);
    return text(link).replace(/\s+(View|Message|Save|Connect)$/i, "");
  }

  function field(card, selectors) {
    for (const selector of selectors) {
      const element = card.querySelector(selector);
      if (element && text(element)) return text(element);
    }
    return "";
  }

  function extractCard(card) {
    if (!visible(card)) return null;
    const salesUrl = salesNavigatorUrl(card);
    const linkedinUrl = publicProfileUrl(card);
    if (!salesUrl && !linkedinUrl) return null;

    const link = [...card.querySelectorAll("a[href*='/in/'], a[href*='/sales/lead/']")]
      .find(visible);
    const name = nameFrom(card, link);
    if (!name) return null;

    return {
      name,
      headline: field(card, [
        "[data-anonymize='headline']",
        ".artdeco-entity-lockup__subtitle",
        ".entity-result__primary-subtitle"
      ]),
      location: field(card, [
        "[data-anonymize='location']",
        ".artdeco-entity-lockup__caption",
        ".entity-result__secondary-subtitle"
      ]),
      linkedinUrl: resolvedUrls.get(salesUrl) || linkedinUrl,
      salesNavigatorUrl: salesUrl,
      sourcePage: location.href
    };
  }

  function collectLeads() {
    const cards = [...new Set(CARD_SELECTORS.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
    ))];
    const seen = new Set();
    return cards.map(extractCard).filter((lead) => {
      if (!lead) return false;
      const key = lead.salesNavigatorUrl || lead.linkedinUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function csvValue(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function downloadCsv(leads) {
    const columns = ["name", "headline", "location", "linkedinUrl", "salesNavigatorUrl", "sourcePage"];
    const rows = [
      columns.join(","),
      ...leads.map((lead) => columns.map((column) => csvValue(lead[column])).join(","))
    ];
    download("sales-navigator-leads.csv", `\uFEFF${rows.join("\r\n")}`, "text/csv;charset=utf-8");
  }

  function downloadJson(leads) {
    download("sales-navigator-leads.json", JSON.stringify(leads, null, 2), "application/json");
  }

  function setStatus(message, isError = false) {
    const status = document.querySelector(`#${PANEL_ID} .sn-exporter-status`);
    if (status) {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
    }
  }

  function refreshCount() {
    const count = collectLeads().length;
    const element = document.querySelector(`#${PANEL_ID} .sn-exporter-count`);
    if (element && count !== lastCount) {
      element.textContent = `${count} visible lead${count === 1 ? "" : "s"}`;
      lastCount = count;
    }
    return count;
  }

  function exportLeads(format) {
    const leads = collectLeads();
    if (!leads.length) {
      setStatus("No rendered lead cards found. Scroll the results into view and try again.", true);
      return;
    }
    if (format === "csv") downloadCsv(leads);
    else downloadJson(leads);
    setStatus(`Exported ${leads.length} lead${leads.length === 1 ? "" : "s"}.`);
  }

  function resolvePublicUrls() {
    const leads = collectLeads().filter((lead) => lead.salesNavigatorUrl);
    if (!leads.length) {
      setStatus("No Sales Navigator lead URLs found.", true);
      return;
    }
    setStatus(`Resolving 0 of ${leads.length} public profile links...`);
    chrome.runtime.sendMessage({ type: "START_RESOLVE", leads }, (response) => {
      if (chrome.runtime.lastError || !response?.started) {
        setStatus("Could not start public-link resolution.", true);
      }
    });
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <strong>Lead exporter</strong>
      <span class="sn-exporter-count"></span>
      <button type="button" data-action="resolve">Resolve public URLs</button>
      <button type="button" data-format="csv">Download CSV</button>
      <button type="button" data-format="json">Download JSON</button>
      <span class="sn-exporter-status" role="status">Only leads currently rendered on this page are exported.</span>
    `;
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-format]");
      if (button) exportLeads(button.dataset.format);
      if (event.target.closest("button[data-action='resolve']")) resolvePublicUrls();
    });
    document.body.appendChild(panel);
    refreshCount();
  }

  createPanel();
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RESOLVE_PROGRESS") {
      setStatus(`Resolving ${message.completed} of ${message.total} public profile links...`);
    }
    if (message.type === "RESOLVE_COMPLETE") {
      Object.entries(message.resolved || {}).forEach(([salesUrl, linkedinUrl]) => {
        if (linkedinUrl) resolvedUrls.set(salesUrl, linkedinUrl);
      });
      refreshCount();
      const found = Object.values(message.resolved || {}).filter(Boolean).length;
      setStatus(`Resolved ${found} public profile link${found === 1 ? "" : "s"}.`);
    }
  });
  const observer = new MutationObserver(() => {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      if (!document.getElementById(PANEL_ID)) createPanel();
      else refreshCount();
    }, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

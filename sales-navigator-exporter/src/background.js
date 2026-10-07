const jobs = new Map();

function nextJob(job) {
  const item = job.queue.shift();
  if (!item) {
    chrome.tabs.sendMessage(job.sourceTabId, {
      type: "RESOLVE_COMPLETE",
      resolved: job.resolved
    }).catch(() => {});
    jobs.delete(job.sourceTabId);
    return;
  }

  chrome.tabs.create({ url: item.salesNavigatorUrl, active: false }, (tab) => {
    if (chrome.runtime.lastError || !tab?.id) {
      job.resolved[item.salesNavigatorUrl] = "";
      nextJob(job);
      return;
    }
    job.current = {
      tabId: tab.id,
      item,
      timeout: setTimeout(() => finishCurrent(job, "")
        , 12000)
    };
  });
}

function finishCurrent(job, linkedinUrl) {
  if (!job.current) return;
  const current = job.current;
  clearTimeout(current.timeout);
  job.resolved[current.item.salesNavigatorUrl] = linkedinUrl;
  job.current = null;
  chrome.tabs.remove(current.tabId).catch(() => {});
  chrome.tabs.sendMessage(job.sourceTabId, {
    type: "RESOLVE_PROGRESS",
    completed: Object.keys(job.resolved).length,
    total: job.total
  }).catch(() => {});
  nextJob(job);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_RESOLVE" && sender.tab?.id && Array.isArray(message.leads)) {
    const job = {
      sourceTabId: sender.tab.id,
      queue: message.leads.filter((lead) => lead.salesNavigatorUrl),
      resolved: {},
      total: message.leads.filter((lead) => lead.salesNavigatorUrl).length
    };
    jobs.set(sender.tab.id, job);
    nextJob(job);
    sendResponse({ started: true, total: job.queue.length });
    return true;
  }

  if (message.type === "LEAD_PUBLIC_URL" && sender.tab?.id) {
    for (const job of jobs.values()) {
      if (job.current?.tabId !== sender.tab.id) continue;
      finishCurrent(job, message.linkedinUrl || "");
      break;
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  for (const job of jobs.values()) {
    if (job.current?.tabId !== tabId) continue;
    chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PUBLIC_URL" }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const job of jobs.values()) {
    if (job.current?.tabId !== tabId) continue;
    clearTimeout(job.current.timeout);
    job.resolved[job.current.item.salesNavigatorUrl] = "";
    job.current = null;
    nextJob(job);
  }
});

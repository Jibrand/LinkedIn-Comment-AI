import { getSettings, saveSettings, MODELS, STYLES } from "../utils/storage.js";
import { registerUser, loginUser, getUserInfo, getCommentStats, getCommentHistory, logout } from "../utils/api.js";

const $ = (id) => document.getElementById(id);
let currentStyle = "Professional";
let currentCommentLength = "Medium";
let saveTimer;
const COMMENT_LENGTHS = [
  { value: "Short", range: "1–2 sentences" },
  { value: "Medium", range: "2–4 sentences" },
  { value: "Long", range: "4–6 sentences" },
];
let isLoginMode = false;

// ---------- Auth View ----------
async function checkAuthAndRender() {
  const settings = await getSettings();
  if (settings.token) {
    try {
      const userInfo = await getUserInfo();
      const stats = await getCommentStats();
      $("authContainer").style.display = "none";
      $("appContainer").style.display = "block";
      
      $("accName").textContent = userInfo.result.fullName;
      $("accEmail").textContent = userInfo.result.email;
      $("accPlan").textContent = userInfo.result.plan || "Free";
      $("accComments").textContent = stats.totalComments || 0;
      const usage = (await getSettings()).usage;
      $("accTokens").textContent = Number(usage.totalTokens || 0).toLocaleString();
      $("accLastTokens").textContent = Number(usage.lastTokens || 0).toLocaleString();
      try {
        const history = await getCommentHistory();
        renderCommentHistory(history.history || []);
      } catch (error) {
        console.error("Failed to load token history:", error);
        renderCommentHistory([]);
        $("tokenHistory").innerHTML = '<div class="history-empty">History temporarily unavailable.</div>';
      }
    } catch (e) {
      // Token invalid or expired
      logout();
      showAuth();
    }

  } else {
    showAuth();
  }
}

function renderCommentHistory(history) {
  const list = $("tokenHistory");
  list.innerHTML = "";
  if (!history.length) {
    list.innerHTML = '<div class="history-empty">No token history yet.</div>';
    return;
  }
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "history-row";
    const date = new Date(item.createdAt);
    row.innerHTML = `
      <div class="history-main">
        <strong>${Number(item.totalTokens || 0).toLocaleString()} tokens</strong>
        <span>${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="history-detail">${Number(item.inputTokens || 0).toLocaleString()} in · ${Number(item.outputTokens || 0).toLocaleString()} out</div>
    `;
    list.appendChild(row);
  }
}

function showAuth() {
  $("appContainer").style.display = "none";
  $("authContainer").style.display = "block";
  $("keyBadge").style.display = "none";
}

$("toggleAuthMode").addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  $("authTitle").textContent = isLoginMode ? "Login" : "Register";
  $("nameField").style.display = isLoginMode ? "none" : "block";
  if (isLoginMode) $("fullName").removeAttribute("required");
  else $("fullName").setAttribute("required", "true");
  $("authSubmit").textContent = isLoginMode ? "Login" : "Sign Up";
  $("toggleAuthMode").textContent = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login";
  $("authError").textContent = "";
});

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("authError").textContent = "";
  $("authSubmit").disabled = true;
  $("authSubmit").textContent = "Please wait...";

  try {
    const email = $("email").value.trim();
    const password = $("password").value;
    
    if (isLoginMode) {
      await loginUser(email, password);
    } else {
      const fullName = $("fullName").value.trim();
      await registerUser(fullName, email, password);
    }
    
    await checkAuthAndRender();
    $("keyBadge").style.display = "inline-block";
  } catch (error) {
    $("authError").textContent = error.message;
  } finally {
    $("authSubmit").disabled = false;
    $("authSubmit").textContent = isLoginMode ? "Login" : "Sign Up";
  }
});

$("logoutBtn").addEventListener("click", () => {
  logout();
  showAuth();
});

// ---------- Tabs ----------
document.querySelectorAll("[data-tab]").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("active", p.dataset.panel === tab.dataset.tab));
    $("saveBar").style.display = tab.dataset.tab === "account" ? "none" : "flex";
  })
);

// ---------- Settings ----------
function settingsFromForm() {
  return {
    model: $("model").value,
    style: currentStyle,
    commentLength: currentCommentLength,
    readThread: $("readThread").checked,
    threadCommentCount: Number($("threadCommentCount").value),
    dmEnabled: $("dmEnabled").checked,
    dmMessageCount: Number($("dmMessageCount").value),
    dmGoal: $("dmGoal").value,
    adjustStyle: {
      shorter: $("shorter").checked,
      moreCasual: $("moreCasual").checked,
      lessAiSounding: $("lessAiSounding").checked,
    },
    systemPrompt: $("systemPrompt").value,
  };
}

async function saveFormSettings() {
  try {
    await saveSettings(settingsFromForm());
    $("status").textContent = "Auto-saved";
    $("status").className = "ok";
  } catch (error) {
    console.error("Failed to save settings:", error);
    $("status").textContent = "Could not save";
    $("status").className = "warn";
  }
}

function scheduleSettingsSave() {
  $("status").textContent = "Saving...";
  $("status").className = "";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveFormSettings, 250);
}

function renderStyles() {
  $("styles").innerHTML = "";
  for (const st of STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (st === currentStyle ? " active" : "");
    b.textContent = st;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", st === currentStyle);
    b.onclick = () => { currentStyle = st; renderStyles(); scheduleSettingsSave(); };
    $("styles").appendChild(b);
  }
}

function renderCommentLengths() {
  $("commentLengths").innerHTML = "";
  for (const length of COMMENT_LENGTHS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip length-chip" + (length.value === currentCommentLength ? " active" : "");
    b.innerHTML = `${length.value}<small>${length.range}</small>`;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", length.value === currentCommentLength);
    b.setAttribute("aria-label", `${length.value}, ${length.range}`);
    b.onclick = () => { currentCommentLength = length.value; renderCommentLengths(); scheduleSettingsSave(); };
    $("commentLengths").appendChild(b);
  }
}

function updateBadge(isLoggedIn) {
  $("keyBadge").textContent = isLoggedIn ? "Server ready" : "Login required";
  $("keyBadge").className = "badge " + (isLoggedIn ? "ok" : "warn");
}

(async () => {
  await checkAuthAndRender();

  const s = await getSettings();
  for (const m of MODELS) $("model").add(new Option(m.label, m.id));
  $("model").value = MODELS.some((m) => m.id === s.model) ? s.model : MODELS[0].id;
  $("systemPrompt").value = s.systemPrompt;
  $("spCount").textContent = s.systemPrompt.length;
  currentStyle = s.style;
  renderStyles();
  currentCommentLength = COMMENT_LENGTHS.some((length) => length.value === s.commentLength)
    ? s.commentLength
    : "Medium";
  renderCommentLengths();
  $("shorter").checked = Boolean(s.adjustStyle?.shorter);
  $("moreCasual").checked = Boolean(s.adjustStyle?.moreCasual);
  $("lessAiSounding").checked = Boolean(s.adjustStyle?.lessAiSounding);
  $("readThread").checked = s.readThread !== false;
  $("threadCommentCount").value = [5, 10, 20].includes(Number(s.threadCommentCount))
    ? String(s.threadCommentCount)
    : "10";
  $("dmEnabled").checked = s.dmEnabled !== false;
  $("dmMessageCount").value = [5, 10, 15].includes(Number(s.dmMessageCount))
    ? String(s.dmMessageCount)
    : "10";
  $("dmGoal").value = ["Reply naturally", "Build relationship", "Book a call", "Follow up", "Say thanks"].includes(s.dmGoal)
    ? s.dmGoal
    : "Reply naturally";
  updateBadge(Boolean(s.token));
  $("debugLog").value = s.lastLog || "No logs yet. Run the commenter to see output.";
})();

$("model").addEventListener("change", scheduleSettingsSave);
$("shorter").addEventListener("change", scheduleSettingsSave);
$("moreCasual").addEventListener("change", scheduleSettingsSave);
$("lessAiSounding").addEventListener("change", scheduleSettingsSave);
$("readThread").addEventListener("change", scheduleSettingsSave);
$("threadCommentCount").addEventListener("change", scheduleSettingsSave);
$("dmEnabled").addEventListener("change", scheduleSettingsSave);
$("dmMessageCount").addEventListener("change", scheduleSettingsSave);
$("dmGoal").addEventListener("change", scheduleSettingsSave);
$("systemPrompt").addEventListener("input", () => {
  $("spCount").textContent = $("systemPrompt").value.length;
  scheduleSettingsSave();
});

$("appForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearTimeout(saveTimer);
  await saveFormSettings();
});

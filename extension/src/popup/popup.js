import { getSettings, saveSettings, MODELS, STYLES } from "../utils/storage.js";
import { registerUser, loginUser, getUserInfo, getCommentStats, logout } from "../utils/api.js";

const $ = (id) => document.getElementById(id);
let currentStyle = "Professional";
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
    } catch (e) {
      // Token invalid or expired
      logout();
      showAuth();
    }
  } else {
    showAuth();
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
function renderStyles() {
  $("styles").innerHTML = "";
  for (const st of STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (st === currentStyle ? " active" : "");
    b.textContent = st;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", st === currentStyle);
    b.onclick = () => { currentStyle = st; renderStyles(); };
    $("styles").appendChild(b);
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
  updateBadge(Boolean(s.token));
  $("debugLog").value = s.lastLog || "No logs yet. Run the commenter to see output.";
})();

$("systemPrompt").addEventListener("input", () => ($("spCount").textContent = $("systemPrompt").value.length));

$("appForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveSettings({ model: $("model").value, style: currentStyle, systemPrompt: $("systemPrompt").value });
  updateBadge(Boolean((await getSettings()).token));
  $("status").textContent = "Saved ✓";
  $("status").className = "ok";
  setTimeout(() => ($("status").textContent = ""), 2500);
});

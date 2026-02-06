// ===== Shareff v2 - Popup Script =====
// Links view only - settings are in settings.html

const api = typeof browser !== "undefined" ? browser : chrome;

// Hardcoded API URL
const API_URL = "https://dbooth.net/shareff/api.php";
const API_KEY = "sh2_2270d1d4054dde1695f2ccb4f5a84af0";

// Maximum number of read IDs to keep (prevent storage quota overflow)
const MAX_READ_IDS = 500;

// ===== State =====
let state = {
  myName: "",
  myEmail: "",
  users: [],
  groups: [],
  adminEmail: "",
  adminName: "",
  links: [],
  readIds: []
};

// ===== DOM Elements =====
const $ = id => document.getElementById(id);

const elements = {
  settingsBtn: $("settingsBtn"),
  status: $("status"),
  searchInput: $("searchInput"),
  linksList: $("linksList")
};

// ===== Storage =====
async function loadState() {
  const data = await api.storage.sync.get([
    "myName", "myEmail",
    "users", "groups",
    "adminEmail", "adminName",
    "readIds"
  ]);

  state.myName = data.myName || "";
  state.myEmail = data.myEmail || "";
  state.users = data.users || [];
  state.groups = data.groups || [];
  state.adminEmail = data.adminEmail || "";
  state.adminName = data.adminName || "";

  // Trim readIds to prevent storage quota overflow
  let readIds = data.readIds || [];
  if (readIds.length > MAX_READ_IDS) {
    readIds = readIds.slice(-MAX_READ_IDS);
  }
  state.readIds = readIds;

  return state;
}

async function saveState() {
  if (state.readIds.length > MAX_READ_IDS) {
    state.readIds = state.readIds.slice(-MAX_READ_IDS);
  }

  await api.storage.sync.set({
    myName: state.myName,
    myEmail: state.myEmail,
    users: state.users,
    groups: state.groups,
    adminEmail: state.adminEmail,
    adminName: state.adminName,
    readIds: state.readIds
  });
}

// ===== API Helpers =====
async function apiCall(action, params = {}, method = "GET") {
  let url = `${API_URL}?action=${action}`;

  if (method === "GET") {
    Object.entries(params).forEach(([key, value]) => {
      url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
  }

  const options = { method, headers: { "X-Shareff-Key": API_KEY } };
  if (method === "POST") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(params);
  }

  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("Invalid JSON response:", text);
    throw new Error("Invalid JSON response from server");
  }

  if (data.error) throw new Error(data.error);
  return data;
}

// ===== UI Helpers =====
function showStatus(msg, isError = false) {
  elements.status.textContent = msg;
  elements.status.className = isError
    ? "small text-center mb-2 text-danger"
    : "small text-center mb-2 text-success";
  if (msg) setTimeout(() => { elements.status.textContent = ""; }, 3000);
}

function openSettings() {
  // Open settings in a new tab
  api.tabs.create({ url: api.runtime.getURL("settings.html") });
  window.close();
}

// ===== Links =====
async function loadLinks() {
  if (!state.myEmail) {
    elements.linksList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">⚙️</div>
        <div>Configure settings to get started</div>
        <button class="btn btn-primary mt-3" id="setupBtn">Open Settings</button>
      </li>
    `;
    $("setupBtn").addEventListener("click", openSettings);
    return;
  }

  elements.linksList.innerHTML = '<li class="empty-state">Loading...</li>';

  try {
    let allLinks = [];

    // Get admin links (links sent to me as admin)
    if (state.users.length > 0 || state.groups.length > 0) {
      const adminData = await apiCall("getLinks", { adminEmail: state.myEmail });
      // Filter to inbox links (from recipients)
      const inboxLinks = (adminData.links || []).filter(link =>
        link.target === "inbox" || link.target === state.myEmail
      );
      allLinks = allLinks.concat(inboxLinks);

      // Update local users/groups from server
      if (adminData.users) state.users = adminData.users;
      if (adminData.groups) state.groups = adminData.groups;
    }

    // Get recipient links (links from my admin)
    if (state.adminEmail) {
      const recipientData = await apiCall("getLinks", {
        adminEmail: state.adminEmail,
        userEmail: state.myEmail
      });
      // Filter out my own links
      const adminLinks = (recipientData.links || []).filter(link =>
        link.from !== state.myEmail
      );
      allLinks = allLinks.concat(adminLinks);
    }

    // Remove duplicates by ID
    const seen = new Set();
    state.links = allLinks.filter(link => {
      if (seen.has(link.id)) return false;
      seen.add(link.id);
      return true;
    });

    await saveState();
    renderLinks(state.links);

    // Update badge
    const unreadCount = state.links.filter(l => !state.readIds.includes(l.id)).length;
    api.runtime.sendMessage({ action: "updateIcon", count: unreadCount }).catch(() => {});
  } catch (err) {
    console.error("Error loading links:", err);
    elements.linksList.innerHTML = `<li class="empty-state text-danger">${err.message}</li>`;
  }
}

function renderLinks(links) {
  if (links.length === 0) {
    elements.linksList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div>No links yet</div>
        <div class="small text-muted mt-2">Right-click any page to send links</div>
      </li>
    `;
    return;
  }

  // Sort: unread first, then by timestamp
  const sorted = [...links].sort((a, b) => {
    const aUnread = !state.readIds.includes(a.id);
    const bUnread = !state.readIds.includes(b.id);
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;
    return b.ts - a.ts;
  });

  elements.linksList.innerHTML = sorted.map(link => {
    const isUnread = !state.readIds.includes(link.id);
    const date = new Date(link.ts);
    const timeStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

    return `
      <li class="link-item">
        <a href="${escapeHtml(link.url)}" target="_blank" class="link-item-title ${isUnread ? 'fw-bold text-primary' : ''}" data-link-id="${link.id}">
          ${isUnread ? '<span class="badge bg-success me-1">NEW</span>' : ''}
          ${escapeHtml(link.title || link.url)}
        </a><span class="link-item-meta">  ${escapeHtml(link.fromName)} &bull; ${timeStr}</span>
      </li>
    `;
  }).join("");

  // Add click handlers to mark as read
  elements.linksList.querySelectorAll("[data-link-id]").forEach(a => {
    a.addEventListener("click", () => markAsRead(a.dataset.linkId));
  });
}

async function markAsRead(linkId) {
  if (!state.readIds.includes(linkId)) {
    state.readIds.push(linkId);
    await saveState();

    // Update UI
    const unreadCount = state.links.filter(l => !state.readIds.includes(l.id)).length;
    api.runtime.sendMessage({ action: "updateIcon", count: unreadCount }).catch(() => {});
  }
}

function filterLinks(query) {
  if (!query.trim()) {
    renderLinks(state.links);
    return;
  }

  const q = query.toLowerCase();
  const filtered = state.links.filter(link => {
    const title = (link.title || link.url).toLowerCase();
    const url = link.url.toLowerCase();
    const from = (link.fromName || "").toLowerCase();
    return title.includes(q) || url.includes(q) || from.includes(q);
  });

  renderLinks(filtered);
}

// ===== Utilities =====
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== Event Listeners =====
function setupEventListeners() {
  elements.settingsBtn.addEventListener("click", openSettings);
  elements.searchInput.addEventListener("input", e => filterLinks(e.target.value));
}

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  setupEventListeners();

  // If not configured, show setup prompt
  if (!state.myName || !state.myEmail) {
    elements.linksList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">👋</div>
        <div><strong>Welcome to Shareff!</strong></div>
        <div class="small text-muted mt-2">Set up your identity to start sharing links</div>
        <button class="btn btn-primary mt-3" id="setupBtn">Open Settings</button>
      </li>
    `;
    $("setupBtn").addEventListener("click", openSettings);
  } else {
    loadLinks();
  }
});

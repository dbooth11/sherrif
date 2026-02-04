# Sherrif (SpitNet) v2 Planning Handoff

## PROJECT OVERVIEW

**Sherrif** (branded "SpitNet") is a Chrome/Firefox browser extension for sharing links between two friends using GitHub Gist as a real-time backend.

**Core workflow:**
1. User right-clicks a link → "Send to [Friend]"
2. Link is stored in a shared GitHub Gist (links.json)
3. Recipient's extension polls every 30s, shows unread count badge
4. Desktop notifications for new links
5. Popup shows received links, click to open & mark read
6. Archive website (GitHub Pages) shows full history

---

## CURRENT ARCHITECTURE

| Component | Tech | Purpose |
|-----------|------|---------|
| manifest.json | MV3 | Extension config |
| background.js | Service Worker | Polling, notifications, context menu |
| popup.js/html | Vanilla JS + CSS | UI, settings, link list |
| docs/app.js | Vanilla JS | Archive website |
| GitHub Gist | JSON storage | Shared links.json backend |

**Key patterns:**
- Browser API abstraction for Chrome/Firefox compatibility
- OffscreenCanvas for dynamic icon with unread count
- Chrome Storage API (sync) for settings
- 50 link limit, newest first

---

## DRAWBACKS TO ADDRESS IN V2

### Architecture
- Two-user only (hardcoded Don/Kev)
- Hardcoded Gist ID in multiple files
- 30s polling (not real-time, wastes API calls)
- No conflict handling (last write wins)

### Security
- GitHub token stored in plaintext
- Single shared token for both users
- config.js with credentials in git history

### Reliability
- No retry logic for failed API calls
- No data validation on Gist structure
- No caching (full fetch every poll)
- No offline mode

### Missing Features
- No link deletion or editing
- No bulk operations
- No tagging/categories
- No link previews
- No export/backup
- 50 link limit, no pagination
- Archive requires re-login every visit

### UX
- Search doesn't highlight matches
- Generic error messages
- No visual feedback during operations

---

## QUESTIONS FOR V2 PLANNING

1. **Multi-user support?** Keep 2-person model or expand to groups?
2. **Real-time sync?** WebSockets, webhooks, or stick with polling?
3. **Backend change?** Stay with Gist or move to Firebase/Supabase/custom?
4. **Security model?** Per-user tokens? OAuth? Encrypted storage?
5. **Feature priority?** Delete/edit links? Tags? Previews? Which first?
6. **Platform scope?** Chrome-only or maintain Firefox? Safari? Mobile?

---

## V2 DECISIONS

### Read Tracking: Local Only
- **No server-side read tracking** - remove `read: {}` object from link data
- Each user tracks their own read IDs locally in browser storage
- Unread = link ID not in user's local `readIds` set
- Benefits:
  - Fewer API writes (no PATCH just to mark read)
  - No conflict issues from concurrent read updates
  - Simpler data model

### Groups: Just Shared Channels
- A "group" is simply multiple people sharing the same Gist/channel
- Links land in shared storage, each person marks read locally
- No participation tracking needed
- Same model works for 2 people or 10

### Simplified Link Data Model
```json
{
  "links": [
    {
      "id": "abc123",
      "from": "Don",
      "url": "https://example.com",
      "title": "Example Page",
      "ts": 1234567890
    }
  ]
}
```

### Local Storage (per user)
```javascript
// Browser storage (not synced)
{
  readIds: ["abc123", "xyz789", ...],  // IDs user has seen
  channels: [{ id: "...", name: "..." }]  // Configured channels/groups
}
```

---

## CURRENT SOURCE CODE

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "SpitNet",
  "version": "2.0",
  "description": "Fucking finally",
  "permissions": [
    "storage",
    "contextMenus",
    "notifications",
    "alarms",
    "activeTab"
  ],
  "host_permissions": [
    "https://api.github.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "scripts": ["background.js"]
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "SpitNet",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "friend-link-sender@donandkev.com",
      "strict_min_version": "109.0"
    }
  }
}
```

### background.js
```javascript
// ===== Background Script =====
// Uses GitHub Gist as shared storage for links between friends
// Compatible with both Firefox (MV2) and Chrome

const POLL_INTERVAL_MINUTES = 0.5; // 30 seconds
const ALARM_NAME = "checkNewLinks";
const GIST_API = "https://api.github.com/gists";

// Use browser API (Firefox) with fallback to chrome
const api = typeof browser !== "undefined" ? browser : chrome;

// ===== Dynamic Icon Generation =====
function updateIconWithCount(count) {
  const actionApi = api.action || api.browserAction;

  if (count === 0) {
    actionApi.setIcon({
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    });
    actionApi.setBadgeText({ text: "" });
    return;
  }

  try {
    const sizes = [16, 48, 128];
    const imageData = {};

    sizes.forEach(size => {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = '#00ff00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fontSize = Math.floor(size * 0.9);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillText(String(count), size / 2, size / 2);

      imageData[size] = ctx.getImageData(0, 0, size, size);
    });

    actionApi.setIcon({ imageData: imageData });
    actionApi.setBadgeText({ text: "" });
  } catch (error) {
    console.error('Error creating icon:', error);
    actionApi.setIcon({
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    });
    actionApi.setBadgeText({ text: String(count) });
    actionApi.setBadgeBackgroundColor({ color: "#00ff00" });
  }
}

// Config with hardcoded gist ID
let CONFIG = {
  gistId: "63dd9a97e8a2c0cd654de75253a16fbd",
  token: ""
};

async function loadConfig() {
  const data = await api.storage.sync.get(["gistToken"]);
  CONFIG.token = data.gistToken || "";
  return CONFIG;
}

async function getMyName() {
  const data = await api.storage.sync.get(["myName"]);
  return data.myName || "";
}

async function getFriendName() {
  const data = await api.storage.sync.get(["friendName"]);
  return data.friendName || "Friend";
}

async function fetchGist() {
  const res = await fetch(`${GIST_API}/${CONFIG.gistId}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${CONFIG.token}`
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch gist: ${res.status}`);

  const gist = await res.json();
  const content = gist.files["links.json"]?.content;
  return content ? JSON.parse(content) : { links: [] };
}

async function updateGist(data) {
  const res = await fetch(`${GIST_API}/${CONFIG.gistId}`, {
    method: "PATCH",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${CONFIG.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      files: {
        "links.json": {
          content: JSON.stringify(data, null, 2)
        }
      }
    })
  });

  if (!res.ok) throw new Error(`Failed to update gist: ${res.status}`);
  return res.json();
}

api.runtime.onInstalled.addListener(async () => {
  const friendName = await getFriendName();

  api.contextMenus.create({
    id: "sendToFriend",
    title: `Send to ${friendName || "Friend"}`,
    contexts: ["page", "link"]
  });

  api.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.5,
    periodInMinutes: POLL_INTERVAL_MINUTES
  });

  console.log("Friend Link Sender installed - using GitHub Gist backend");
});

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.friendName) {
    const newName = changes.friendName.newValue || "Friend";
    api.contextMenus.update("sendToFriend", {
      title: `Send to ${newName}`
    });
  }
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "sendToFriend") return;

  const myName = await getMyName();
  const friendName = await getFriendName();

  if (!myName) {
    showNotification("Setup Required", "Click the extension icon and set your name first!");
    return;
  }

  const urlToSend = info.linkUrl || info.pageUrl || tab.url;
  const title = info.linkUrl ? urlToSend : (tab.title || urlToSend);

  try {
    const data = await fetchGist();

    const newLink = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      from: myName,
      url: urlToSend,
      title: title,
      ts: Date.now(),
      read: {}
    };
    data.links.unshift(newLink);

    if (data.links.length > 50) {
      data.links = data.links.slice(0, 50);
    }

    await updateGist(data);
    showNotification("Link Sent!", `Sent to ${friendName}`);
  } catch (err) {
    console.error("Error sending link:", err);
    showNotification("Error", "Failed to send link.");
  }
});

function showNotification(title, message, url = null) {
  const notificationId = "link-" + Date.now();

  api.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message
  });

  if (url) {
    api.storage.local.set({ [`notif_${notificationId}`]: url });
  }
}

api.notifications.onClicked.addListener(async (notificationId) => {
  const data = await api.storage.local.get(`notif_${notificationId}`);
  const url = data[`notif_${notificationId}`];

  if (url) {
    api.tabs.create({ url });
    api.storage.local.remove(`notif_${notificationId}`);
  }

  api.notifications.clear(notificationId);
});

let lastSeenIds = new Set();

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await checkForNewLinks();
});

async function checkForNewLinks() {
  const myName = await getMyName();
  if (!myName) return;

  if (!CONFIG.token) {
    await loadConfig();
  }
  if (!CONFIG.token) return;

  try {
    const data = await fetchGist();
    const links = data.links || [];

    const unreadLinks = links.filter(link =>
      link.from.toLowerCase() !== myName.toLowerCase() &&
      !link.read?.[myName.toLowerCase()]
    );

    updateIconWithCount(unreadLinks.length);

    for (const link of links) {
      if (link.from.toLowerCase() !== myName.toLowerCase() &&
          !lastSeenIds.has(link.id) &&
          !link.read?.[myName.toLowerCase()]) {
        showNotification(
          `New link from ${link.from}`,
          link.title || link.url,
          link.url
        );
      }
    }

    lastSeenIds = new Set(links.map(l => l.id));
  } catch (err) {
    console.error("Error checking for new links:", err);
  }
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateIcon') {
    updateIconWithCount(message.count);
    sendResponse({ success: true });
  } else if (message.action === 'updateContextMenu') {
    api.contextMenus.update("sendToFriend", {
      title: `Send to ${message.friendName || "Friend"}`
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

api.runtime.onStartup.addListener(() => {
  checkForNewLinks();
});

(async () => {
  try {
    await loadConfig();
    if (CONFIG.token) {
      const data = await fetchGist();
      lastSeenIds = new Set((data.links || []).map(l => l.id));
    }
  } catch (e) {
    console.log("Initial load failed, will retry on next poll");
  }
  checkForNewLinks();
})();
```

### popup.js
```javascript
// ===== Friend Link Sender - Popup Script =====
const GIST_API = "https://api.github.com/gists";
const api = typeof browser !== "undefined" ? browser : chrome;

const CONFIG = {
  gistId: "63dd9a97e8a2c0cd654de75253a16fbd",
  token: ""
};

async function getSettings() {
  return api.storage.sync.get(["myName", "friendName", "gistToken"]);
}

async function saveSettings(settings) {
  return api.storage.sync.set(settings);
}

async function loadConfig() {
  const settings = await getSettings();
  CONFIG.token = settings.gistToken || "";
  return CONFIG;
}

const userSelect = document.getElementById("userSelect");
const gistTokenInput = document.getElementById("gistToken");
const saveSettingsBtn = document.getElementById("saveSettings");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const linksListEl = document.getElementById("linksList");
const setupCard = document.getElementById("setupCard");
const mainContent = document.getElementById("mainContent");
const searchInput = document.getElementById("searchInput");

let allLinks = [];
let currentMyName = "";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.className = isError ? "small text-danger" : "small text-success";
  if (msg) setTimeout(() => { statusEl.textContent = ""; }, 3000);
}

async function getActiveTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function fetchGist() {
  if (!CONFIG.token) throw new Error("No token configured.");

  const res = await fetch(`${GIST_API}/${CONFIG.gistId}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${CONFIG.token}`
    }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid token.");
    if (res.status === 404) throw new Error("Gist not found.");
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const gist = await res.json();
  const content = gist.files["links.json"]?.content;
  return content ? JSON.parse(content) : { links: [] };
}

async function updateGist(data) {
  const res = await fetch(`${GIST_API}/${CONFIG.gistId}`, {
    method: "PATCH",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${CONFIG.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      files: { "links.json": { content: JSON.stringify(data, null, 2) } }
    })
  });
  if (!res.ok) throw new Error(`Failed to update gist: ${res.status}`);
  return res.json();
}

async function loadSettingsIntoForm() {
  const { myName, friendName, gistToken } = await getSettings();
  if (myName && friendName) userSelect.value = `${myName}:${friendName}`;
  if (gistToken) gistTokenInput.value = gistToken;
  return { myName, friendName, gistToken };
}

async function handleSaveSettings() {
  const userSelection = userSelect.value;
  const gistToken = gistTokenInput.value.trim();

  if (!userSelection) { setStatus("Please select who you are", true); return; }
  if (!gistToken) { setStatus("Please enter GitHub Token", true); return; }

  const [myName, friendName] = userSelection.split(':');
  await saveSettings({ myName, friendName, gistToken });
  await loadConfig();

  api.runtime.sendMessage({ action: 'updateContextMenu', friendName }).catch(() => {});

  setStatus("Saved!");
  showMainUI();
  loadLinks();
}

function showMainUI() {
  setupCard.classList.add("d-none");
  mainContent.classList.remove("d-none");
}

function showSetupUI() {
  setupCard.classList.remove("d-none");
  mainContent.classList.add("d-none");
}

async function sendCurrentPage() {
  const { myName, friendName } = await getSettings();
  if (!myName) { setStatus("Set your name first!", true); showSetupUI(); return; }

  const tab = await getActiveTab();
  if (!tab?.url) { setStatus("Could not get current tab URL", true); return; }

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    const data = await fetchGist();
    const newLink = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      from: myName,
      url: tab.url,
      title: tab.title || tab.url,
      ts: Date.now(),
      read: {}
    };
    data.links.unshift(newLink);
    if (data.links.length > 50) data.links = data.links.slice(0, 50);

    await updateGist(data);
    setStatus(`Sent to ${friendName}!`);
    loadLinks();
  } catch (err) {
    setStatus(err.message || "Error sending link", true);
  } finally {
    sendBtn.disabled = false;
    const settings = await getSettings();
    sendBtn.textContent = `Send to ${settings.friendName || "Friend"}`;
  }
}

async function loadLinks() {
  const { myName } = await getSettings();
  currentMyName = myName;
  if (!myName) { linksListEl.innerHTML = ""; return; }

  linksListEl.innerHTML = "<li><small class='text-muted'>Loading...</small></li>";

  try {
    const data = await fetchGist();
    allLinks = data.links || [];
    if (searchInput) searchInput.value = "";
    renderLinks(allLinks);
  } catch (err) {
    linksListEl.innerHTML = `<li><small class='text-danger'>${err.message}</small></li>`;
  }
}

function renderLinks(links) {
  linksListEl.innerHTML = "";

  const myLinks = links.filter(link =>
    link.from.toLowerCase() !== currentMyName.toLowerCase()
  );

  if (myLinks.length === 0) {
    linksListEl.innerHTML = "<li><small class='text-muted'>No links</small></li>";
    return;
  }

  const sorted = [...myLinks].sort((a, b) => {
    const aUnread = !a.read?.[currentMyName.toLowerCase()];
    const bUnread = !b.read?.[currentMyName.toLowerCase()];
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;
    return b.ts - a.ts;
  });

  for (const link of sorted) {
    linksListEl.appendChild(createLinkElement(link, currentMyName));
  }
}

function filterLinks(query) {
  if (!query.trim()) { renderLinks(allLinks); return; }

  const q = query.toLowerCase();
  const filtered = allLinks.filter(link => {
    const title = (link.title || link.url).toLowerCase();
    return title.includes(q) || link.url.toLowerCase().includes(q) || link.from.toLowerCase().includes(q);
  });
  renderLinks(filtered);
}

function createLinkElement(link, myName) {
  const li = document.createElement("li");
  const fromLower = link.from.toLowerCase();

  if (fromLower === "don") li.classList.add("link-item", "from-don");
  else if (fromLower === "kev") li.classList.add("link-item", "from-kev");
  else li.classList.add("link-item", "from-other");

  const isUnread = link.from.toLowerCase() !== myName.toLowerCase() &&
                   !link.read?.[myName.toLowerCase()];

  const a = document.createElement("a");
  a.href = link.url;
  a.target = "_blank";
  a.className = "link-item-title d-block text-primary";

  if (isUnread) {
    a.classList.add("fw-bold");
    const badge = document.createElement("span");
    badge.className = "badge bg-success me-1";
    badge.textContent = "NEW";
    badge.style.fontSize = "0.6rem";
    a.appendChild(badge);
  }

  a.appendChild(document.createTextNode(link.title || link.url));

  if (isUnread) {
    a.addEventListener("click", async () => {
      await markLinksAsRead(myName, [link.id]);
      a.classList.remove("fw-bold");
      const badge = a.querySelector(".badge");
      if (badge) badge.remove();
    });
  }

  li.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "link-item-meta text-muted small";
  const date = new Date(link.ts);
  meta.textContent = `From: ${link.from} • ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  li.appendChild(meta);

  return li;
}

async function markLinksAsRead(myName, linkIds, existingData = null) {
  try {
    const data = existingData || await fetchGist();
    let changed = false;

    for (const link of data.links) {
      if (linkIds.includes(link.id)) {
        if (!link.read) link.read = {};
        if (!link.read[myName.toLowerCase()]) {
          link.read[myName.toLowerCase()] = true;
          changed = true;
        }
      }
    }

    if (changed) {
      await updateGist(data);
      const unreadCount = data.links.filter(link =>
        link.from.toLowerCase() !== myName.toLowerCase() &&
        !link.read?.[myName.toLowerCase()]
      ).length;

      api.runtime.sendMessage({ action: 'updateIcon', count: unreadCount }).catch(() => {});
    }
  } catch (err) {
    console.error("Error marking links as read:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { myName, friendName, gistToken } = await loadSettingsIntoForm();
  await loadConfig();

  sendBtn.textContent = `Send to ${friendName || "Friend"}`;

  if (!myName || !gistToken) showSetupUI();
  else { showMainUI(); loadLinks(); }

  saveSettingsBtn.addEventListener("click", handleSaveSettings);
  sendBtn.addEventListener("click", sendCurrentPage);
  gistTokenInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleSaveSettings(); });
  if (searchInput) searchInput.addEventListener("input", (e) => filterLinks(e.target.value));
});
```

### docs/app.js (Archive Website)
```javascript
let allLinks = [];
let sortColumn = 'ts';
let sortDirection = -1;

function getCredentials() {
  const gistId = localStorage.getItem('gistId') || '';
  const gistToken = localStorage.getItem('gistToken') || '';
  return { gistId, gistToken };
}

function saveCredentials(gistId, gistToken) {
  localStorage.setItem('gistId', gistId);
  localStorage.setItem('gistToken', gistToken);
}

function clearCredentials() {
  localStorage.removeItem('gistId');
  localStorage.removeItem('gistToken');
}

function showLoginForm() {
  const container = document.getElementById('linksContainer');
  container.innerHTML = `
    <div class="login-form">
      <h2>Login Required</h2>
      <form id="loginForm">
        <div class="form-group">
          <label for="gistIdInput">Gist ID</label>
          <input type="text" id="gistIdInput" placeholder="63dd9a97..." required>
        </div>
        <div class="form-group">
          <label for="gistTokenInput">GitHub Token</label>
          <input type="password" id="gistTokenInput" placeholder="ghp_..." required>
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const gistId = document.getElementById('gistIdInput').value.trim();
    const gistToken = document.getElementById('gistTokenInput').value.trim();
    if (gistId && gistToken) {
      saveCredentials(gistId, gistToken);
      loadLinks();
    }
  });
}

async function loadLinks() {
  const container = document.getElementById('linksContainer');
  container.innerHTML = '<div class="loading">Loading...</div>';

  const { gistId, gistToken } = getCredentials();
  if (!gistId || !gistToken) { showLoginForm(); return; }

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gistToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) { clearCredentials(); showLoginForm(); return; }
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const gist = await response.json();
    const data = JSON.parse(gist.files['links.json'].content);
    allLinks = data.links || [];
    renderLinks(allLinks);
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load: ${error.message}</div>`;
  }
}

function renderLinks(links) {
  const container = document.getElementById('linksContainer');
  if (links.length === 0) { container.innerHTML = '<div class="empty">No links</div>'; return; }

  const rows = links.map(link => {
    const date = new Date(link.ts);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<tr>
      <td><a href="${link.url}" target="_blank">${link.title || link.url}</a></td>
      <td>${link.from}</td>
      <td>${dateStr}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table>
      <thead><tr>
        <th onclick="sortLinks('title')">Title</th>
        <th onclick="sortLinks('from')">From</th>
        <th onclick="sortLinks('ts')">Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function sortLinks(column) {
  if (sortColumn === column) sortDirection *= -1;
  else { sortColumn = column; sortDirection = -1; }

  const sorted = [...allLinks].sort((a, b) => {
    let aVal, bVal;
    switch (column) {
      case 'title': aVal = (a.title || a.url).toLowerCase(); bVal = (b.title || b.url).toLowerCase(); break;
      case 'from': aVal = a.from.toLowerCase(); bVal = b.from.toLowerCase(); break;
      case 'ts': aVal = a.ts; bVal = b.ts; break;
    }
    if (aVal < bVal) return -1 * sortDirection;
    if (aVal > bVal) return 1 * sortDirection;
    return 0;
  });
  renderLinks(sorted);
}

window.sortLinks = sortLinks;
document.addEventListener('DOMContentLoaded', () => loadLinks());
```

---

Ready to plan v2 architecture and feature set.

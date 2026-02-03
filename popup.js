// ===== Friend Link Sender - Popup Script =====
// Uses GitHub Gist as shared storage
// Compatible with both Firefox and Chrome

const GIST_API = "https://api.github.com/gists";

// Use browser API (Firefox) with fallback to chrome
const api = typeof browser !== "undefined" ? browser : chrome;

// Config with hardcoded gist ID
const CONFIG = {
  gistId: "63dd9a97e8a2c0cd654de75253a16fbd",
  token: ""
};

// ===== Storage helpers =====
async function getSettings() {
  return api.storage.sync.get(["myName", "friendName", "gistToken"]);
}

async function saveSettings(settings) {
  return api.storage.sync.set(settings);
}

async function loadConfig() {
  const settings = await getSettings();
  CONFIG.token = settings.gistToken || "";
  console.log("Config loaded. Token present:", !!CONFIG.token);
  return CONFIG;
}

// ===== DOM elements =====
const myNameInput = document.getElementById("myName");
const friendNameInput = document.getElementById("friendName");
const gistTokenInput = document.getElementById("gistToken");
const saveSettingsBtn = document.getElementById("saveSettings");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const linksListEl = document.getElementById("linksList");
const unreadNoticeEl = document.getElementById("unreadNotice");
const setupCard = document.getElementById("setupCard");
const mainContent = document.getElementById("mainContent");

// ===== Utility functions =====
function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.className = isError ? "small text-danger" : "small text-success";
  if (msg) {
    setTimeout(() => { statusEl.textContent = ""; }, 3000);
  }
}

function getActiveTab() {
  return api.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);
}

// ===== Gist API helpers =====
async function fetchGist() {
  if (!CONFIG.token) {
    throw new Error("No token configured. Please enter your GitHub token in setup.");
  }

  const res = await fetch(`${GIST_API}/${CONFIG.gistId}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${CONFIG.token}`
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Invalid token. Please check your GitHub token in setup.");
    } else if (res.status === 404) {
      throw new Error("Gist not found. Please verify gist ID.");
    } else {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
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

// ===== Settings logic =====
async function loadSettingsIntoForm() {
  const { myName, friendName, gistToken } = await getSettings();
  if (myName) myNameInput.value = myName;
  if (friendName) friendNameInput.value = friendName;
  if (gistToken) gistTokenInput.value = gistToken;
  return { myName, friendName, gistToken };
}

async function handleSaveSettings() {
  const myName = myNameInput.value.trim();
  const friendName = friendNameInput.value.trim() || "Friend";
  const gistToken = gistTokenInput.value.trim();

  if (!myName) {
    setStatus("Please enter your name", true);
    return;
  }

  if (!gistToken) {
    setStatus("Please enter GitHub Token", true);
    return;
  }

  await saveSettings({ myName, friendName, gistToken });
  await loadConfig(); // Load token into CONFIG

  // Send message to background to update context menu
  api.runtime.sendMessage({
    action: 'updateContextMenu',
    friendName: friendName
  }).catch(err => {
    console.log('Could not update context menu:', err);
  });

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

// ===== Send current page =====
async function sendCurrentPage() {
  const { myName, friendName } = await getSettings();

  if (!myName) {
    setStatus("Set your name first!", true);
    showSetupUI();
    return;
  }

  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    setStatus("Could not get current tab URL", true);
    return;
  }

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

    if (data.links.length > 50) {
      data.links = data.links.slice(0, 50);
    }

    await updateGist(data);
    setStatus(`Sent to ${friendName}!`);
    loadLinks();
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Error sending link", true);
  } finally {
    sendBtn.disabled = false;
    const settings = await getSettings();
    sendBtn.textContent = `Send to ${settings.friendName || "Friend"}`;
  }
}

// ===== Load and display links =====
async function loadLinks() {
  const { myName } = await getSettings();

  if (!myName) {
    linksListEl.innerHTML = "";
    return;
  }

  linksListEl.innerHTML = "<li><small class='text-muted'>Loading...</small></li>";

  try {
    const data = await fetchGist();
    const links = data.links || [];

    // Show all links (limit to 50)
    linksListEl.innerHTML = "";
    if (links.length === 0) {
      linksListEl.innerHTML = "<li><small class='text-muted'>No links</small></li>";
    } else {
      for (const link of links.slice(0, 50)) {
        const li = createLinkElement(link, myName);
        linksListEl.appendChild(li);
      }
    }
  } catch (err) {
    console.error(err);
    linksListEl.innerHTML = `<li><small class='text-danger'>${err.message}</small></li>`;
  }
}

// ===== Create link element =====
function createLinkElement(link, myName) {
  const li = document.createElement("li");

  // Add color coding based on sender
  const fromLower = link.from.toLowerCase();
  if (fromLower === "don") {
    li.classList.add("link-item", "from-don");
  } else if (fromLower === "kev") {
    li.classList.add("link-item", "from-kev");
  } else {
    li.classList.add("link-item", "from-other");
  }

  // Check if unread
  const isUnread = link.from.toLowerCase() !== myName.toLowerCase() &&
                   !link.read?.[myName.toLowerCase()];

  const a = document.createElement("a");
  a.href = link.url;
  a.target = "_blank";
  a.className = "link-item-title d-block text-primary";

  // Make unread links bold
  if (isUnread) {
    a.classList.add("fw-bold");
  }

  // Add unread badge if unread
  if (isUnread) {
    const badge = document.createElement("span");
    badge.className = "badge bg-success me-1";
    badge.textContent = "NEW";
    badge.style.fontSize = "0.6rem";
    a.appendChild(badge);
  }

  const titleText = document.createTextNode(link.title || link.url);
  a.appendChild(titleText);

  // Add click handler to mark as read if unread
  if (isUnread) {
    a.addEventListener("click", async () => {
      // Mark as read in background
      await markLinksAsRead(myName, [link.id]);

      // Update UI to show as read
      a.classList.remove("fw-bold");
      const badge = a.querySelector(".badge");
      if (badge) badge.remove();
    });
  }

  li.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "link-item-meta text-muted small";

  const date = new Date(link.ts);
  const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.textContent = `From: ${link.from} • ${dateStr}`;
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

      // Calculate new unread count and update icon immediately
      const unreadCount = data.links.filter(link =>
        link.from.toLowerCase() !== myName.toLowerCase() &&
        !link.read?.[myName.toLowerCase()]
      ).length;

      // Send message to background to update icon
      api.runtime.sendMessage({
        action: 'updateIcon',
        count: unreadCount
      }).catch(() => {
        // Background script might not be ready, that's okay
        console.log('Background script not ready for icon update');
      });
    }
  } catch (err) {
    console.error("Error marking links as read:", err);
  }
}

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", async () => {
  const { myName, friendName, gistToken } = await loadSettingsIntoForm();

  // Load config from storage
  await loadConfig();

  // Update send button text
  sendBtn.textContent = `Send to ${friendName || "Friend"}`;

  if (!myName || !gistToken) {
    showSetupUI();
  } else {
    showMainUI();
    loadLinks();
  }

  saveSettingsBtn.addEventListener("click", handleSaveSettings);
  sendBtn.addEventListener("click", sendCurrentPage);

  // Allow pressing Enter in the name fields
  myNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSaveSettings();
  });
  friendNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSaveSettings();
  });
  gistTokenInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSaveSettings();
  });
});

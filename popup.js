// ===== Friend Link Sender - Popup Script =====
// Uses GitHub Gist as shared storage
// Compatible with both Firefox and Chrome

const GIST_API = "https://api.github.com/gists";

// Use browser API (Firefox) with fallback to chrome
const api = typeof browser !== "undefined" ? browser : chrome;

// ===== Hardcoded Config =====
const CONFIG = {
  gistId: "9d43dd466e59858fedc45967d1e9eba9",
  token: "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"
};

// ===== Storage helpers =====
function getSettings() {
  return api.storage.sync.get(["myName", "friendName"]);
}

function saveSettings(settings) {
  return api.storage.sync.set(settings);
}

// ===== DOM elements =====
const myNameInput = document.getElementById("myName");
const friendNameInput = document.getElementById("friendName");
const saveSettingsBtn = document.getElementById("saveSettings");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const linksListEl = document.getElementById("linksList");
const archiveListEl = document.getElementById("archiveList");
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

// ===== Settings logic =====
async function loadSettingsIntoForm() {
  const { myName, friendName } = await getSettings();
  if (myName) myNameInput.value = myName;
  if (friendName) friendNameInput.value = friendName;
  return { myName, friendName };
}

async function handleSaveSettings() {
  const myName = myNameInput.value.trim();
  const friendName = friendNameInput.value.trim() || "Friend";

  if (!myName) {
    setStatus("Please enter your name", true);
    return;
  }

  await saveSettings({ myName, friendName });

  // Update context menu title
  api.contextMenus.update("sendToFriend", {
    title: `Send to ${friendName}`
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
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
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
    setStatus("Error sending link", true);
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
    archiveListEl.innerHTML = "";
    unreadNoticeEl.textContent = "";
    return;
  }

  linksListEl.innerHTML = "<li><small class='text-muted'>Loading...</small></li>";
  archiveListEl.innerHTML = "<li><small class='text-muted'>Loading...</small></li>";

  try {
    const data = await fetchGist();
    const links = data.links || [];

    // Filter to links FROM others (sent to me)
    const linksForMe = links.filter(link =>
      link.from.toLowerCase() !== myName.toLowerCase()
    );

    // Separate into unread and read (archived)
    const unreadLinks = linksForMe.filter(link =>
      !link.read?.[myName.toLowerCase()]
    );
    const archivedLinks = linksForMe.filter(link =>
      link.read?.[myName.toLowerCase()]
    );

    // Update unread notice
    if (unreadLinks.length > 0) {
      unreadNoticeEl.textContent = `${unreadLinks.length} unread link${unreadLinks.length === 1 ? "" : "s"}`;
      unreadNoticeEl.className = "small fw-semibold mb-2 text-danger";
    } else {
      unreadNoticeEl.textContent = "";
      unreadNoticeEl.className = "";
    }

    // Populate Unread tab
    linksListEl.innerHTML = "";
    if (unreadLinks.length === 0) {
      linksListEl.innerHTML = "<li><small class='text-muted'>No unread links</small></li>";
    } else {
      for (const link of unreadLinks.slice(0, 20)) {
        const li = createLinkElement(link, myName, data, true);
        linksListEl.appendChild(li);
      }
    }

    // Populate Archive tab
    archiveListEl.innerHTML = "";
    if (archivedLinks.length === 0) {
      archiveListEl.innerHTML = "<li><small class='text-muted'>No archived links</small></li>";
    } else {
      for (const link of archivedLinks.slice(0, 20)) {
        const li = createLinkElement(link, myName, data, false);
        archiveListEl.appendChild(li);
      }
    }
  } catch (err) {
    console.error(err);
    linksListEl.innerHTML = "<li><small class='text-danger'>Error loading links</small></li>";
    archiveListEl.innerHTML = "<li><small class='text-danger'>Error loading links</small></li>";
  }
}

// ===== Create link element =====
function createLinkElement(link, myName, data, isUnread) {
  const li = document.createElement("li");
  li.classList.add("mb-2");

  const a = document.createElement("a");
  a.href = link.url;
  a.textContent = link.title || link.url;
  a.target = "_blank";
  a.className = "link-item-title d-block" + (isUnread ? " fw-bold text-primary" : "");

  // Add click handler to mark as read and move to archive
  if (isUnread) {
    a.addEventListener("click", async (e) => {
      await markLinksAsRead(myName, [link.id], data);
      // Switch to archive tab
      const archiveTab = document.getElementById("archive-tab");
      if (archiveTab) {
        archiveTab.click();
      }
      // Reload links to update both tabs
      await loadLinks();
    });
  }

  li.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "link-item-meta text-muted";

  const date = new Date(link.ts);
  const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.textContent = dateStr;
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
      // Update badge
      const badgeApi = api.browserAction || api.action;
      badgeApi.setBadgeText({ text: "" });
    }
  } catch (err) {
    console.error("Error marking links as read:", err);
  }
}

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", async () => {
  const { myName, friendName } = await loadSettingsIntoForm();

  // Update send button text
  sendBtn.textContent = `Send to ${friendName || "Friend"}`;

  if (!myName) {
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
});

// ===== Helpers to access storage =====
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["apiBase", "apiToken", "myUserId", "friendUserId"],
      (data) => resolve(data)
    );
  });
}

function saveSettingsToStorage(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => resolve());
  });
}

// ===== DOM elements =====
const apiBaseInput = document.getElementById("apiBase");
const apiTokenInput = document.getElementById("apiToken");
const myUserIdInput = document.getElementById("myUserId");
const friendUserIdInput = document.getElementById("friendUserId");
const saveSettingsBtn = document.getElementById("saveSettings");

const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const linksListEl = document.getElementById("linksList");
const unreadNoticeEl = document.getElementById("unreadNotice");

// ===== Utility functions =====
function setStatus(msg) {
  statusEl.textContent = msg || "";
  if (msg) {
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2500);
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

// ===== Settings logic =====
async function loadSettingsIntoForm() {
  const { apiBase, apiToken, myUserId, friendUserId } = await getSettings();
  if (apiBase) apiBaseInput.value = apiBase;
  if (apiToken) apiTokenInput.value = apiToken;
  if (myUserId) myUserIdInput.value = myUserId;
  if (friendUserId) friendUserIdInput.value = friendUserId;
}

async function saveSettings() {
  const apiBase = apiBaseInput.value.trim();
  const apiToken = apiTokenInput.value.trim();
  const myUserId = myUserIdInput.value.trim();
  const friendUserId = friendUserIdInput.value.trim();

  await saveSettingsToStorage({
    apiBase,
    apiToken,
    myUserId,
    friendUserId
  });

  setStatus("Settings saved");
  loadUnreadAndLinks();
}

// ===== API calls =====
async function sendCurrentPage() {
  const { apiBase, apiToken, myUserId, friendUserId } = await getSettings();

  if (!apiBase || !myUserId || !friendUserId) {
    setStatus("Please fill in API base, my user ID, and friend user ID.");
    return;
  }

  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    setStatus("Could not get current tab URL.");
    return;
  }

  const url = tab.url;
  const title = tab.title || url;

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiToken) headers["X-API-Token"] = apiToken;

    const res = await fetch(apiBase.replace(/\/$/, "") + "/send_link.php", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender_id: parseInt(myUserId, 10),
        receiver_id: parseInt(friendUserId, 10),
        url,
        title
      })
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    setStatus("Link sent!");
  } catch (err) {
    console.error(err);
    setStatus("Error sending link.");
  }
}

async function loadUnreadCount() {
  const { apiBase, apiToken, myUserId } = await getSettings();
  if (!apiBase || !myUserId) {
    unreadNoticeEl.textContent = "Configure settings to see unread links.";
    return;
  }

  try {
    const headers = {};
    if (apiToken) headers["X-API-Token"] = apiToken;

    const url =
      apiBase.replace(/\/$/, "") +
      "/get_unread_count.php?receiver_id=" +
      encodeURIComponent(myUserId);

    const res = await fetch(url, { headers });

    if (!res.ok) {
      unreadNoticeEl.textContent = "Error loading unread count.";
      return;
    }

    const data = await res.json();
    const count = Number(data.unreadCount) || 0;

    if (count > 0) {
      unreadNoticeEl.textContent =
        "You have " + count + " unread link" + (count === 1 ? "" : "s") + ".";
    } else {
      unreadNoticeEl.textContent = "No unread links.";
    }
  } catch (err) {
    console.error(err);
    unreadNoticeEl.textContent = "Error loading unread count.";
  }
}

async function loadLastLinks() {
  const { apiBase, apiToken, myUserId } = await getSettings();
  if (!apiBase || !myUserId) {
    linksListEl.innerHTML = "<li><small>Configure settings first.</small></li>";
    return;
  }

  linksListEl.innerHTML = "<li><small>Loading…</small></li>";

  try {
    const headers = {};
    if (apiToken) headers["X-API-Token"] = apiToken;

    const url =
      apiBase.replace(/\/$/, "") +
      "/get_links.php?receiver_id=" +
      encodeURIComponent(myUserId) +
      "&limit=6";

    const res = await fetch(url, { headers });

    if (!res.ok) {
      linksListEl.innerHTML = "<li><small>Error loading links.</small></li>";
      return;
    }

    const links = await res.json();
    linksListEl.innerHTML = "";

    if (!Array.isArray(links) || links.length === 0) {
      linksListEl.innerHTML = "<li><small>No links yet.</small></li>";
      return;
    }

    const unreadIds = [];

    links.forEach((link) => {
      const li = document.createElement("li");
      li.classList.add("mb-2");

      const a = document.createElement("a");
      a.href = link.url;
      a.textContent = link.title || link.url;
      a.target = "_blank";
      a.className = "link-item-title d-block";
      li.appendChild(a);

      const meta = document.createElement("div");
      meta.className = "link-item-meta text-muted";

      const dateStr = link.created_at
        ? new Date(link.created_at.replace(" ", "T")).toLocaleString()
        : "";
      const isRead = String(link.is_read) !== "0";

      if (!isRead) unreadIds.push(link.id);

      meta.textContent = dateStr + (!isRead ? " · Unread" : "");
      li.appendChild(meta);

      linksListEl.appendChild(li);
    });

    if (unreadIds.length > 0) {
      await markLinksRead(unreadIds);
      loadUnreadCount();
    }
  } catch (err) {
    console.error(err);
    linksListEl.innerHTML = "<li><small>Error loading links.</small></li>";
  }
}

async function markLinksRead(linkIds) {
  const { apiBase, apiToken, myUserId } = await getSettings();
  if (!apiBase || !myUserId) return;

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiToken) headers["X-API-Token"] = apiToken;

    await fetch(apiBase.replace(/\/$/, "") + "/mark_read.php", {
      method: "POST",
      headers,
      body: JSON.stringify({
        receiver_id: parseInt(myUserId, 10),
        link_ids: linkIds
      })
    });
  } catch (err) {
    console.error("Error marking links as read:", err);
  }
}

async function loadUnreadAndLinks() {
  await loadUnreadCount();
  await loadLastLinks();
}

// ===== Wire up events =====
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettingsIntoForm();

  saveSettingsBtn.addEventListener("click", saveSettings);
  sendBtn.addEventListener("click", sendCurrentPage);

  loadUnreadAndLinks();
});

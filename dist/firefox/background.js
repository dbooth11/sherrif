// ===== Shareff v2 - Background Script =====
// Service worker for polling, notifications, and context menus

const POLL_INTERVAL_MINUTES = 20;
const ALARM_NAME = "checkNewLinks";

// Hardcoded API URL for now
const API_URL = "https://dbooth.net/shareff/api.php";
const API_KEY = "sh2_2270d1d4054dde1695f2ccb4f5a84af0";

const api = typeof browser !== "undefined" ? browser : chrome;

// ===== State =====
let state = {
  myName: "",
  myEmail: "",
  users: [],
  groups: [],
  adminEmail: "",
  adminName: "",
  readIds: []
};

// Maximum number of read IDs to keep (prevent storage quota overflow)
const MAX_READ_IDS = 500;

let lastSeenIds = new Set();

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
    readIds = readIds.slice(-MAX_READ_IDS); // Keep most recent
    // Save trimmed version back to storage
    await api.storage.sync.set({ readIds });
  }
  state.readIds = readIds;

  return state;
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
  const data = await res.json();

  if (data.error) throw new Error(data.error);
  return data;
}

// ===== Dynamic Icon =====
function updateIconWithCount(count) {
  const actionApi = api.action || api.browserAction;

  try {
    const sizes = [16, 48, 128];
    const imageData = {};

    sizes.forEach(size => {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");

      // Solid black background - fill entire canvas, no alpha
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, size, size);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (count === 0) {
        // Draw 🤓 emoji filling the canvas
        const fontSize = Math.floor(size * 1.0);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillText("🤓", size / 2, size / 2);
      } else {
        // Green number filling the canvas
        ctx.fillStyle = "#00ff00";
        const text = String(count);
        const fontSize = text.length > 2
          ? Math.floor(size * 0.7)
          : text.length > 1
            ? Math.floor(size * 0.85)
            : Math.floor(size * 1.0);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillText(text, size / 2, size / 2);
      }

      // Force all transparent pixels to solid black
      const data = ctx.getImageData(0, 0, size, size);
      const px = data.data;
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] < 255) {
          // Blend onto black: premultiply then force opaque
          const a = px[i] / 255;
          px[i - 3] = Math.round(px[i - 3] * a); // R
          px[i - 2] = Math.round(px[i - 2] * a); // G
          px[i - 1] = Math.round(px[i - 1] * a); // B
          px[i] = 255; // A
        }
      }
      ctx.putImageData(data, 0, 0);

      imageData[size] = ctx.getImageData(0, 0, size, size);
    });

    actionApi.setIcon({ imageData });
    actionApi.setBadgeText({ text: "" });
  } catch (error) {
    console.error("Error creating icon:", error);
    actionApi.setIcon({
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    });
    if (count > 0) {
      actionApi.setBadgeText({ text: String(count) });
      actionApi.setBadgeBackgroundColor({ color: "#00ff00" });
    } else {
      actionApi.setBadgeText({ text: "🤓" });
    }
  }
}

// ===== Context Menu =====
let menuBuilding = false;

async function rebuildContextMenu() {
  if (menuBuilding) return;
  menuBuilding = true;

  try {
    await api.contextMenus.removeAll();
  } catch (e) {
    // Ignore removeAll errors
  }

  // Create parent menu
  api.contextMenus.create({
    id: "shareff-parent",
    title: "Shareff",
    contexts: ["page", "link"]
  });

  let hasItems = false;

  // Admin mode: Add users and groups
  if (state.users.length > 0 || state.groups.length > 0) {
    // Individual users
    state.users.forEach(user => {
      api.contextMenus.create({
        id: `send-user-${user.email}`,
        parentId: "shareff-parent",
        title: `Send to ${user.name}`,
        contexts: ["page", "link"]
      });
      hasItems = true;
    });

    // Separator if we have both users and groups
    if (state.users.length > 0 && state.groups.length > 0) {
      api.contextMenus.create({
        id: "separator-1",
        parentId: "shareff-parent",
        type: "separator",
        contexts: ["page", "link"]
      });
    }

    // Groups
    state.groups.forEach(group => {
      api.contextMenus.create({
        id: `send-group-${group.id}`,
        parentId: "shareff-parent",
        title: `Send to [${group.name}]`,
        contexts: ["page", "link"]
      });
      hasItems = true;
    });
  }

  // Recipient mode: Add admin
  if (state.adminEmail && state.adminName) {
    // Separator if we already have admin items
    if (hasItems) {
      api.contextMenus.create({
        id: "separator-2",
        parentId: "shareff-parent",
        type: "separator",
        contexts: ["page", "link"]
      });
    }

    api.contextMenus.create({
      id: `send-admin-${state.adminEmail}`,
      parentId: "shareff-parent",
      title: `Send to ${state.adminName}`,
      contexts: ["page", "link"]
    });
    hasItems = true;
  }

  // If no items, show setup message
  if (!hasItems) {
    api.contextMenus.create({
      id: "setup-required",
      parentId: "shareff-parent",
      title: "Open extension to set up",
      contexts: ["page", "link"],
      enabled: false
    });
  }

  menuBuilding = false;
}

// ===== Context Menu Click Handler =====
api.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;

  if (!state.myName || !state.myEmail) {
    showNotification("Setup Required", "Open the extension and configure settings first.");
    return;
  }

  const urlToSend = info.linkUrl || info.pageUrl || tab.url;
  const title = info.linkUrl ? urlToSend : (tab.title || urlToSend);

  let target = null;
  let adminEmail = state.myEmail; // Default: sending as admin
  let recipientName = "";

  if (menuId.startsWith("send-user-")) {
    // Sending to individual user
    const userEmail = menuId.replace("send-user-", "");
    const user = state.users.find(u => u.email === userEmail);
    target = userEmail;
    recipientName = user ? user.name : userEmail;
  } else if (menuId.startsWith("send-group-")) {
    // Sending to group
    const groupId = menuId.replace("send-group-", "");
    const group = state.groups.find(g => g.id === groupId);
    target = groupId;
    recipientName = group ? `[${group.name}]` : "group";
  } else if (menuId.startsWith("send-admin-")) {
    // Sending to admin (as recipient)
    adminEmail = menuId.replace("send-admin-", "");
    target = "inbox";
    recipientName = state.adminName;
  } else {
    return;
  }

  try {
    await apiCall("send", {
      adminEmail,
      from: state.myEmail,
      fromName: state.myName,
      url: urlToSend,
      title,
      target
    }, "POST");

    showToast(tab.id, `Sent to ${recipientName}`);
  } catch (err) {
    console.error("Error sending link:", err);
    showToast(tab.id, "Failed to send: " + err.message, true);
  }
});

// ===== Toast Bubble =====
function showToast(tabId, message, isError = false) {
  api.scripting.executeScript({
    target: { tabId },
    args: [message, isError],
    func: (msg, err) => {
      const existing = document.getElementById("shareff-toast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "shareff-toast";
      toast.textContent = msg;
      Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        background: err ? "#d32f2f" : "#4CAF50",
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "14px",
        fontWeight: "600",
        zIndex: "2147483647",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity: "0",
        transform: "translateY(-10px)",
        transition: "opacity 0.3s, transform 0.3s"
      });

      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });

      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }
  }).catch(() => {});
}

// ===== Notifications =====
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

// ===== Polling =====
async function checkForNewLinks() {
  await loadState();

  if (!state.myEmail) return;

  try {
    let allLinks = [];

    // Get admin links (inbox)
    if (state.users.length > 0 || state.groups.length > 0) {
      const adminData = await apiCall("getLinks", { adminEmail: state.myEmail });
      const inboxLinks = (adminData.links || []).filter(link =>
        link.target === "inbox" || link.target === state.myEmail
      );
      allLinks = allLinks.concat(inboxLinks);
    }

    // Get recipient links
    if (state.adminEmail) {
      const recipientData = await apiCall("getLinks", {
        adminEmail: state.adminEmail,
        userEmail: state.myEmail
      });
      const adminLinks = (recipientData.links || []).filter(link =>
        link.from !== state.myEmail
      );
      allLinks = allLinks.concat(adminLinks);
    }

    // Remove duplicates
    const seen = new Set();
    const links = allLinks.filter(link => {
      if (seen.has(link.id)) return false;
      seen.add(link.id);
      return true;
    });

    // Count unread
    const unreadLinks = links.filter(link => !state.readIds.includes(link.id));
    updateIconWithCount(unreadLinks.length);

    // Notify for truly new links
    for (const link of links) {
      if (!lastSeenIds.has(link.id) && !state.readIds.includes(link.id)) {
        showNotification(
          `New link from ${link.fromName}`,
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

// ===== Alarms =====
api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await checkForNewLinks();
  }
});

// ===== Message Handler =====
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateIcon") {
    updateIconWithCount(message.count);
    sendResponse({ success: true });
  } else if (message.action === "settingsChanged") {
    // Reload state and rebuild menus
    loadState().then(() => {
      rebuildContextMenu();
      checkForNewLinks();
    });
    sendResponse({ success: true });
  }
  return true;
});

// ===== Installation =====
api.runtime.onInstalled.addListener(async () => {
  await loadState();
  await rebuildContextMenu();

  api.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: POLL_INTERVAL_MINUTES
  });

  console.log("Shareff v2 installed");
});

// ===== Startup =====
api.runtime.onStartup.addListener(async () => {
  await loadState();
  await rebuildContextMenu();
  checkForNewLinks();
});

// ===== Initialize =====
// Note: Context menus are created in onInstalled per MV3 best practices
// This IIFE handles service worker wake-ups between installs
(async () => {
  try {
    await loadState();

    // Ensure alarm exists (may have been cleared if service worker was inactive)
    const existingAlarm = await api.alarms.get(ALARM_NAME);
    if (!existingAlarm) {
      api.alarms.create(ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: POLL_INTERVAL_MINUTES
      });
    }

    // Initialize lastSeenIds and update icon
    if (state.myEmail) {
      await checkForNewLinks();
    }
  } catch (e) {
    console.log("Initial load failed, will retry on next poll:", e);
  }
})();

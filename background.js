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
  const actionApi = api.browserAction || api.action;

  if (count === 0) {
    // Show black bookmark icon
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
    // Create canvas for each size
    const sizes = [16, 48, 128];
    const imageData = {};

    sizes.forEach(size => {
      // Use OffscreenCanvas if available, otherwise create a regular canvas
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : document.createElement('canvas');

      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }

      const ctx = canvas.getContext('2d');

      // Fill with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // Draw green number
      ctx.fillStyle = '#00ff00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Font size based on icon size (90% of icon size for large number)
      const fontSize = Math.floor(size * 0.9);
      ctx.font = `bold ${fontSize}px Arial`;

      ctx.fillText(String(count), size / 2, size / 2);

      // Get image data
      imageData[size] = ctx.getImageData(0, 0, size, size);
    });

    // Set the icon with generated images
    actionApi.setIcon({ imageData: imageData });
    actionApi.setBadgeText({ text: "" });
  } catch (error) {
    console.error('Error creating icon:', error);
    // Fallback to badge
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

// ===== Storage helpers =====
async function getMyName() {
  const data = await api.storage.sync.get(["myName"]);
  return data.myName || "";
}

async function getFriendName() {
  const data = await api.storage.sync.get(["friendName"]);
  return data.friendName || "Friend";
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

// ===== Context Menu Setup =====
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

// Listen for storage changes to update context menu title
api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.friendName) {
    const newName = changes.friendName.newValue || "Friend";
    api.contextMenus.update("sendToFriend", {
      title: `Send to ${newName}`
    });
  }
});

// ===== Context Menu Click Handler =====
api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "sendToFriend") return;

  const myName = await getMyName();
  const friendName = await getFriendName();

  if (!myName) {
    showNotification(
      "Setup Required",
      "Click the extension icon and set your name first!"
    );
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

// ===== Notification Helper =====
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

// ===== Notification Click Handler =====
api.notifications.onClicked.addListener(async (notificationId) => {
  const data = await api.storage.local.get(`notif_${notificationId}`);
  const url = data[`notif_${notificationId}`];

  if (url) {
    api.tabs.create({ url });
    api.storage.local.remove(`notif_${notificationId}`);
  }

  api.notifications.clear(notificationId);
});

// ===== Polling for New Links =====
let lastSeenIds = new Set();

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await checkForNewLinks();
});

async function checkForNewLinks() {
  const myName = await getMyName();
  if (!myName) return;

  // Ensure config is loaded
  if (!CONFIG.token) {
    await loadConfig();
  }
  if (!CONFIG.token) return;

  try {
    const data = await fetchGist();
    const links = data.links || [];

    // Count unread links (from others, not yet read by me)
    const unreadLinks = links.filter(link =>
      link.from.toLowerCase() !== myName.toLowerCase() &&
      !link.read?.[myName.toLowerCase()]
    );

    // Update icon based on unread count
    updateIconWithCount(unreadLinks.length);

    // Check for new links we haven't seen
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

// ===== Message handler for icon updates =====
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
    return true; // Keep message channel open for async response
  }
});

// ===== Initialize =====
api.runtime.onStartup.addListener(() => {
  checkForNewLinks();
});

// Load config and existing IDs on startup
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

// ===== Shareff v2 - Settings Page Script =====
// Full-page settings experience

const api = typeof browser !== "undefined" ? browser : chrome;

// Hardcoded API URL
const API_URL = "https://dbooth.net/server/api.php";

// Maximum read IDs (matches popup.js)
const MAX_READ_IDS = 500;

// Chrome Web Store unlisted extension URL (update this after publishing)
const EXTENSION_URL = "https://chrome.google.com/webstore/detail/shareff/YOUR_EXTENSION_ID";

// Welcome page URL
const WELCOME_PAGE_URL = "https://dbooth11.github.io/sherrif/welcome.html";

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

// ===== DOM Elements =====
const $ = id => document.getElementById(id);

const elements = {
  // Identity
  nameInput: $("nameInput"),
  emailInput: $("emailInput"),
  // Lists
  usersList: $("usersList"),
  groupsList: $("groupsList"),
  adminConnection: $("adminConnection"),
  // Buttons
  addUserBtn: $("addUserBtn"),
  createGroupBtn: $("createGroupBtn"),
  connectAdminBtn: $("connectAdminBtn"),
  saveSettingsBtn: $("saveSettingsBtn"),
  cancelSettingsBtn: $("cancelSettingsBtn"),
  // Status
  statusBar: $("statusBar"),
  // Add User Modal (Unified Add + Invite)
  addUserModal: $("addUserModal"),
  newUserName: $("newUserName"),
  newUserEmail: $("newUserEmail"),
  inviteStatus: $("inviteStatus"),
  confirmAddUser: $("confirmAddUser"),
  cancelAddUser: $("cancelAddUser"),
  // Create Group Modal
  createGroupModal: $("createGroupModal"),
  newGroupName: $("newGroupName"),
  groupMembersCheckboxes: $("groupMembersCheckboxes"),
  confirmCreateGroup: $("confirmCreateGroup"),
  cancelCreateGroup: $("cancelCreateGroup"),
  // Edit Group Modal
  editGroupModal: $("editGroupModal"),
  editGroupId: $("editGroupId"),
  editGroupName: $("editGroupName"),
  editGroupMembersCheckboxes: $("editGroupMembersCheckboxes"),
  confirmEditGroup: $("confirmEditGroup"),
  cancelEditGroup: $("cancelEditGroup"),
  deleteGroup: $("deleteGroup"),
  // Connect Admin Modal
  connectAdminModal: $("connectAdminModal"),
  adminEmailInput: $("adminEmailInput"),
  adminLookupStatus: $("adminLookupStatus"),
  confirmConnectAdmin: $("confirmConnectAdmin"),
  cancelConnectAdmin: $("cancelConnectAdmin"),
  // Resend Invite Modal
  resendInviteModal: $("resendInviteModal"),
  resendUserName: $("resendUserName"),
  resendUserEmail: $("resendUserEmail"),
  resendStatus: $("resendStatus"),
  cancelResend: $("cancelResend"),
  confirmResend: $("confirmResend")
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

  const options = { method };
  if (method === "POST") {
    options.headers = { "Content-Type": "application/json" };
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
  elements.statusBar.textContent = msg;
  elements.statusBar.classList.toggle("error", isError);
  elements.statusBar.classList.add("visible");
  setTimeout(() => {
    elements.statusBar.classList.remove("visible");
  }, 3000);
}

function showModal(modal) {
  modal.classList.add("visible");
}

function hideModal(modal) {
  modal.classList.remove("visible");
}

// ===== Populate Form =====
function populateForm() {
  elements.nameInput.value = state.myName;
  elements.emailInput.value = state.myEmail;
  renderUsersList();
  renderGroupsList();
  renderAdminConnection();
}

// ===== Users List =====
function renderUsersList() {
  if (state.users.length === 0) {
    elements.usersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div>No users invited yet</div>
        <div style="font-size:0.85rem;margin-top:8px;">Click "+ Invite User" to add friends</div>
      </div>
    `;
    return;
  }

  elements.usersList.innerHTML = state.users.map(user => {
    const status = user.status || 'connected';
    const isPending = status === 'pending';
    const statusBadge = isPending
      ? '<span class="status-badge pending">Pending</span>'
      : '<span class="status-badge connected">Connected</span>';

    return `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${escapeHtml(user.name)} ${statusBadge}</h4>
          <p>${escapeHtml(user.email)}</p>
        </div>
        <div class="list-item-actions">
          ${isPending ? `<button class="btn btn-outline btn-sm" data-resend-user="${user.email}" data-resend-name="${escapeHtml(user.name)}">Resend</button>` : ''}
          <button class="btn btn-danger btn-sm" data-remove-user="${user.email}">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  // Add remove handlers
  elements.usersList.querySelectorAll("[data-remove-user]").forEach(btn => {
    btn.addEventListener("click", () => removeUser(btn.dataset.removeUser));
  });

  // Add resend handlers
  elements.usersList.querySelectorAll("[data-resend-user]").forEach(btn => {
    btn.addEventListener("click", () => openResendModal(btn.dataset.resendUser, btn.dataset.resendName));
  });
}

// ===== Groups List =====
function renderGroupsList() {
  if (state.groups.length === 0) {
    elements.groupsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div>No groups created yet</div>
      </div>
    `;
    return;
  }

  elements.groupsList.innerHTML = state.groups.map(group => `
    <div class="list-item">
      <div class="list-item-info">
        <h4>${escapeHtml(group.name)}</h4>
        <p>${group.members.length} member${group.members.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-outline btn-sm" data-edit-group="${group.id}">Edit</button>
    </div>
  `).join("");

  // Add edit handlers
  elements.groupsList.querySelectorAll("[data-edit-group]").forEach(btn => {
    btn.addEventListener("click", () => openEditGroupModal(btn.dataset.editGroup));
  });
}

// ===== Admin Connection =====
function renderAdminConnection() {
  if (!state.adminEmail) {
    elements.adminConnection.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔗</div>
        <div>Not connected to any admin</div>
      </div>
    `;
    elements.connectAdminBtn.textContent = "+ Connect";
    return;
  }

  elements.adminConnection.innerHTML = `
    <div class="list-item">
      <div class="list-item-info">
        <h4>${escapeHtml(state.adminName || "Admin")}</h4>
        <p>${escapeHtml(state.adminEmail)}</p>
      </div>
      <button class="btn btn-danger btn-sm" id="disconnectAdmin">Disconnect</button>
    </div>
  `;

  $("disconnectAdmin").addEventListener("click", disconnectAdmin);
  elements.connectAdminBtn.textContent = "Change";
}

// ===== User Management =====
function openAddUserModal() {
  elements.newUserName.value = "";
  elements.newUserEmail.value = "";
  elements.inviteStatus.innerHTML = "";
  elements.confirmAddUser.disabled = false;
  showModal(elements.addUserModal);
  elements.newUserName.focus();
}

async function addUser() {
  const name = elements.newUserName.value.trim();
  const email = elements.newUserEmail.value.trim().toLowerCase();

  if (!name || !email) {
    alert("Please enter both name and email");
    return;
  }

  if (!state.myEmail || !state.myName) {
    alert("Please save your name and email first (in the Identity section above)");
    return;
  }

  if (state.users.some(u => u.email === email)) {
    alert("User already exists in your list");
    return;
  }

  // Show sending status
  elements.inviteStatus.innerHTML = '<span style="color:#6c757d;">Sending invite...</span>';
  elements.confirmAddUser.disabled = true;

  try {
    // Register admin first
    await apiCall("register", { email: state.myEmail, name: state.myName }, "POST");

    // Add user with pending status
    await apiCall("addUser", {
      adminEmail: state.myEmail,
      userEmail: email,
      userName: name,
      status: "pending"
    }, "POST");

    // Send invite email
    await apiCall("sendInvite", {
      adminEmail: state.myEmail,
      adminName: state.myName,
      userEmail: email,
      userName: name,
      extensionUrl: EXTENSION_URL
    }, "POST");

    // Add to local state
    state.users.push({ email, name, status: "pending" });
    await saveState();
    renderUsersList();

    elements.inviteStatus.innerHTML = '';
    hideModal(elements.addUserModal);
    showStatus("Invite sent to " + name + "!");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    elements.inviteStatus.innerHTML = `<span style="color:#dc3545;">Error: ${err.message}</span>`;
  } finally {
    elements.confirmAddUser.disabled = false;
  }
}

async function removeUser(email) {
  if (!confirm("Remove this user?")) return;

  try {
    if (state.myEmail) {
      await apiCall("removeUser", {
        adminEmail: state.myEmail,
        userEmail: email
      }, "POST");
    }

    state.users = state.users.filter(u => u.email !== email);
    state.groups.forEach(g => {
      g.members = g.members.filter(m => m !== email);
    });
    await saveState();
    renderUsersList();
    renderGroupsList();
    showStatus("User removed");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    alert("Error removing user: " + err.message);
  }
}

// ===== Group Management =====
function renderMemberCheckboxes(containerId, selectedMembers = []) {
  const container = $(containerId);
  if (state.users.length === 0) {
    container.innerHTML = '<div class="checkbox-item" style="color:#6c757d">Add users first</div>';
    return;
  }

  container.innerHTML = state.users.map(user => `
    <label class="checkbox-item">
      <input type="checkbox" value="${user.email}" ${selectedMembers.includes(user.email) ? 'checked' : ''}>
      ${escapeHtml(user.name)} (${escapeHtml(user.email)})
    </label>
  `).join("");
}

function getSelectedMembers(containerId) {
  const container = $(containerId);
  return Array.from(container.querySelectorAll("input:checked")).map(cb => cb.value);
}

function openCreateGroupModal() {
  elements.newGroupName.value = "";
  renderMemberCheckboxes("groupMembersCheckboxes");
  showModal(elements.createGroupModal);
  elements.newGroupName.focus();
}

async function createGroup() {
  const name = elements.newGroupName.value.trim();
  const members = getSelectedMembers("groupMembersCheckboxes");

  if (!name) {
    alert("Please enter a group name");
    return;
  }

  try {
    let groupId = generateId();

    if (state.myEmail) {
      const result = await apiCall("createGroup", {
        adminEmail: state.myEmail,
        groupName: name,
        members
      }, "POST");
      groupId = result.groupId || groupId;
    }

    state.groups.push({ id: groupId, name, members });
    await saveState();
    renderGroupsList();
    hideModal(elements.createGroupModal);
    showStatus("Group created!");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    alert("Error creating group: " + err.message);
  }
}

function openEditGroupModal(groupId) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;

  elements.editGroupId.value = groupId;
  elements.editGroupName.value = group.name;
  renderMemberCheckboxes("editGroupMembersCheckboxes", group.members);
  showModal(elements.editGroupModal);
}

async function updateGroup() {
  const groupId = elements.editGroupId.value;
  const name = elements.editGroupName.value.trim();
  const members = getSelectedMembers("editGroupMembersCheckboxes");

  if (!name) {
    alert("Please enter a group name");
    return;
  }

  try {
    if (state.myEmail) {
      await apiCall("updateGroup", {
        adminEmail: state.myEmail,
        groupId,
        groupName: name,
        members
      }, "POST");
    }

    const group = state.groups.find(g => g.id === groupId);
    if (group) {
      group.name = name;
      group.members = members;
    }
    await saveState();
    renderGroupsList();
    hideModal(elements.editGroupModal);
    showStatus("Group updated!");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    alert("Error updating group: " + err.message);
  }
}

async function deleteGroupHandler() {
  const groupId = elements.editGroupId.value;
  if (!confirm("Delete this group?")) return;

  try {
    if (state.myEmail) {
      await apiCall("deleteGroup", {
        adminEmail: state.myEmail,
        groupId
      }, "POST");
    }

    state.groups = state.groups.filter(g => g.id !== groupId);
    await saveState();
    renderGroupsList();
    hideModal(elements.editGroupModal);
    showStatus("Group deleted");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    alert("Error deleting group: " + err.message);
  }
}

// ===== Admin Connection (Recipient) =====
function openConnectAdminModal() {
  elements.adminEmailInput.value = state.adminEmail || "";
  elements.adminLookupStatus.textContent = "";
  elements.adminLookupStatus.className = "form-help";
  showModal(elements.connectAdminModal);
  elements.adminEmailInput.focus();
}

async function connectToAdmin() {
  const email = elements.adminEmailInput.value.trim().toLowerCase();

  if (!email) {
    elements.adminLookupStatus.textContent = "Please enter an email";
    elements.adminLookupStatus.style.color = "#dc3545";
    return;
  }

  try {
    elements.adminLookupStatus.textContent = "Looking up...";
    elements.adminLookupStatus.style.color = "#6c757d";

    const result = await apiCall("getAdmin", { adminEmail: email });

    if (!result.exists) {
      elements.adminLookupStatus.textContent = "Admin not found";
      elements.adminLookupStatus.style.color = "#dc3545";
      return;
    }

    // Register this recipient as a user under the admin
    try {
      await apiCall("addUser", {
        adminEmail: email,
        userEmail: state.myEmail,
        userName: state.myName
      }, "POST");
    } catch (e) {
      console.log("addUser:", e.message);
    }

    state.adminEmail = email;
    state.adminName = result.name;
    await saveState();
    renderAdminConnection();
    hideModal(elements.connectAdminModal);
    showStatus("Connected to " + result.name + "!");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    elements.adminLookupStatus.textContent = "Error: " + err.message;
    elements.adminLookupStatus.style.color = "#dc3545";
  }
}

async function disconnectAdmin() {
  if (!confirm("Disconnect from this admin?")) return;

  state.adminEmail = "";
  state.adminName = "";
  await saveState();
  renderAdminConnection();
  showStatus("Disconnected");

  api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
}

// ===== Settings Save =====
async function saveSettings() {
  const name = elements.nameInput.value.trim();
  const email = elements.emailInput.value.trim().toLowerCase();

  if (!name || !email) {
    alert("Please enter your name and email");
    return;
  }

  state.myName = name;
  state.myEmail = email;

  try {
    // Register as admin on the server
    await apiCall("register", { email, name }, "POST");

    // Fetch existing data from server and merge
    try {
      const serverData = await apiCall("getLinks", { adminEmail: email });
      console.log("Server data:", serverData);
      if (serverData.users && serverData.users.length > 0) {
        const serverEmails = new Set(serverData.users.map(u => u.email));
        const localOnly = state.users.filter(u => !serverEmails.has(u.email));
        state.users = [...serverData.users, ...localOnly];
      }
      if (serverData.groups && serverData.groups.length > 0) {
        const serverIds = new Set(serverData.groups.map(g => g.id));
        const localOnly = state.groups.filter(g => !serverIds.has(g.id));
        state.groups = [...serverData.groups, ...localOnly];
      }
    } catch (e) {
      console.log("No existing server data:", e);
    }

    // Sync users to server (preserve their status)
    for (const user of state.users) {
      try {
        await apiCall("addUser", {
          adminEmail: email,
          userEmail: user.email,
          userName: user.name,
          status: user.status || "connected"
        }, "POST");
      } catch (e) {
        // User might already exist
      }
    }

    // Sync groups to server
    for (const group of state.groups) {
      try {
        await apiCall("createGroup", {
          adminEmail: email,
          groupName: group.name,
          members: group.members
        }, "POST");
      } catch (e) {
        try {
          await apiCall("updateGroup", {
            adminEmail: email,
            groupId: group.id,
            groupName: group.name,
            members: group.members
          }, "POST");
        } catch (e2) {
          // Ignore
        }
      }
    }

    await saveState();

    // Re-render with merged data
    renderUsersList();
    renderGroupsList();

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
    showStatus("Settings saved!");

    // Close the tab after a brief delay
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (err) {
    alert("Error saving settings: " + err.message);
  }
}

function cancelSettings() {
  window.close();
}

// ===== Resend Invite System =====
function openResendModal(email, name) {
  elements.resendUserEmail.value = email;
  elements.resendUserName.textContent = name;
  elements.resendStatus.innerHTML = '';
  showModal(elements.resendInviteModal);
}

async function resendInvite() {
  const email = elements.resendUserEmail.value;
  const user = state.users.find(u => u.email === email);
  if (!user) return;

  elements.resendStatus.innerHTML = '<span style="color:#6c757d;">Sending...</span>';
  elements.confirmResend.disabled = true;

  try {
    await apiCall("sendInvite", {
      adminEmail: state.myEmail,
      adminName: state.myName,
      userEmail: email,
      userName: user.name,
      extensionUrl: EXTENSION_URL
    }, "POST");

    elements.resendStatus.innerHTML = '';
    hideModal(elements.resendInviteModal);
    showStatus("Invite resent to " + user.name + "!");
  } catch (err) {
    elements.resendStatus.innerHTML = `<span style="color:#dc3545;">Error: ${err.message}</span>`;
  } finally {
    elements.confirmResend.disabled = false;
  }
}

// ===== Utilities =====
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Save/Cancel
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.cancelSettingsBtn.addEventListener("click", cancelSettings);

  // Add User
  elements.addUserBtn.addEventListener("click", openAddUserModal);
  elements.confirmAddUser.addEventListener("click", addUser);
  elements.cancelAddUser.addEventListener("click", () => hideModal(elements.addUserModal));

  // Create Group
  elements.createGroupBtn.addEventListener("click", openCreateGroupModal);
  elements.confirmCreateGroup.addEventListener("click", createGroup);
  elements.cancelCreateGroup.addEventListener("click", () => hideModal(elements.createGroupModal));

  // Edit Group
  elements.confirmEditGroup.addEventListener("click", updateGroup);
  elements.cancelEditGroup.addEventListener("click", () => hideModal(elements.editGroupModal));
  elements.deleteGroup.addEventListener("click", deleteGroupHandler);

  // Connect Admin
  elements.connectAdminBtn.addEventListener("click", openConnectAdminModal);
  elements.confirmConnectAdmin.addEventListener("click", connectToAdmin);
  elements.cancelConnectAdmin.addEventListener("click", () => hideModal(elements.connectAdminModal));

  // Enter key handlers
  elements.newUserEmail.addEventListener("keypress", e => {
    if (e.key === "Enter") addUser();
  });
  elements.newGroupName.addEventListener("keypress", e => {
    if (e.key === "Enter") createGroup();
  });
  elements.adminEmailInput.addEventListener("keypress", e => {
    if (e.key === "Enter") connectToAdmin();
  });

  // Resend Invite
  elements.confirmResend.addEventListener("click", resendInvite);
  elements.cancelResend.addEventListener("click", () => hideModal(elements.resendInviteModal));

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        hideModal(overlay);
      }
    });
  });

  // Close modals on Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.visible").forEach(modal => {
        hideModal(modal);
      });
    }
  });
}

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  setupEventListeners();
  populateForm();
});

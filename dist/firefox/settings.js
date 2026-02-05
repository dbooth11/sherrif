// ===== Shareff v2 - Settings Page Script =====
// Full-page settings experience

const api = typeof browser !== "undefined" ? browser : chrome;

// Hardcoded API URL
const API_URL = "https://dbooth.net/server/api.php";

// Maximum read IDs (matches popup.js)
const MAX_READ_IDS = 500;

// Chrome Web Store unlisted extension URL (update this after publishing)
const EXTENSION_URL = "https://chrome.google.com/webstore/detail/shareff/YOUR_EXTENSION_ID";

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
  inviteBtn: $("inviteBtn"),
  saveSettingsBtn: $("saveSettingsBtn"),
  cancelSettingsBtn: $("cancelSettingsBtn"),
  // Status
  statusBar: $("statusBar"),
  // Add User Modal
  addUserModal: $("addUserModal"),
  newUserName: $("newUserName"),
  newUserEmail: $("newUserEmail"),
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
  // Invite Modal
  inviteModal: $("inviteModal"),
  inviteText: $("inviteText"),
  inviteCopyStatus: $("inviteCopyStatus"),
  cancelInvite: $("cancelInvite"),
  copyInvite: $("copyInvite")
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
        <div>No users added yet</div>
      </div>
    `;
    return;
  }

  elements.usersList.innerHTML = state.users.map(user => `
    <div class="list-item">
      <div class="list-item-info">
        <h4>${escapeHtml(user.name)}</h4>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <button class="btn btn-danger btn-sm" data-remove-user="${user.email}">Remove</button>
    </div>
  `).join("");

  // Add remove handlers
  elements.usersList.querySelectorAll("[data-remove-user]").forEach(btn => {
    btn.addEventListener("click", () => removeUser(btn.dataset.removeUser));
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

  if (state.users.some(u => u.email === email)) {
    alert("User already exists");
    return;
  }

  try {
    if (state.myEmail) {
      await apiCall("register", { email: state.myEmail, name: state.myName }, "POST");
      await apiCall("addUser", {
        adminEmail: state.myEmail,
        userEmail: email,
        userName: name
      }, "POST");
    }

    state.users.push({ email, name });
    await saveState();
    renderUsersList();
    hideModal(elements.addUserModal);
    showStatus("User added!");

    api.runtime.sendMessage({ action: "settingsChanged" }).catch(() => {});
  } catch (err) {
    alert("Error adding user: " + err.message);
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

    // Sync users to server
    for (const user of state.users) {
      try {
        await apiCall("addUser", {
          adminEmail: email,
          userEmail: user.email,
          userName: user.name
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

// ===== Invite System =====
function openInviteModal() {
  if (!state.myName || !state.myEmail) {
    alert("Please save your name and email first");
    return;
  }

  const inviteMessage = `Hey! I'm using Shareff to share links with friends.

Install the extension:
${EXTENSION_URL}

After installing:
1. Open the extension and enter your name and email
2. Go to Settings
3. Click "+ Connect" under "Receive Links"
4. Enter my email: ${state.myEmail}

That's it! I can then send you links directly.

- ${state.myName}`;

  elements.inviteText.value = inviteMessage;
  elements.inviteCopyStatus.textContent = "";
  showModal(elements.inviteModal);
}

async function copyInviteText() {
  try {
    await navigator.clipboard.writeText(elements.inviteText.value);
    elements.inviteCopyStatus.textContent = "Copied to clipboard!";
    setTimeout(() => {
      elements.inviteCopyStatus.textContent = "";
    }, 2000);
  } catch (err) {
    elements.inviteText.select();
    document.execCommand("copy");
    elements.inviteCopyStatus.textContent = "Copied!";
    setTimeout(() => {
      elements.inviteCopyStatus.textContent = "";
    }, 2000);
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

  // Invite
  elements.inviteBtn.addEventListener("click", openInviteModal);
  elements.copyInvite.addEventListener("click", copyInviteText);
  elements.cancelInvite.addEventListener("click", () => hideModal(elements.inviteModal));

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

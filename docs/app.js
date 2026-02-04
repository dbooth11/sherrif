let allLinks = [];
let currentUser = 'Don'; // Default viewer

// Get credentials from localStorage or fallback to CONFIG if it exists
function getCredentials() {
  const gistId = localStorage.getItem('gistId') || (typeof CONFIG !== 'undefined' ? CONFIG.GIST_ID : '');
  const gistToken = localStorage.getItem('gistToken') || (typeof CONFIG !== 'undefined' ? CONFIG.GIST_TOKEN : '');
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
      <h2>🔐 Login Required</h2>
      <p>Enter your GitHub credentials to view the archive</p>
      <form id="loginForm">
        <div class="form-group">
          <label for="gistIdInput">Gist ID</label>
          <input type="text" id="gistIdInput" placeholder="63dd9a97e8a2c0cd654de75253a16fbd" required>
        </div>
        <div class="form-group">
          <label for="gistTokenInput">GitHub Token</label>
          <input type="password" id="gistTokenInput" placeholder="ghp_..." required>
        </div>
        <button type="submit" class="refresh-btn">Login</button>
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
  container.innerHTML = '<div class="loading">Loading links...</div>';

  const { gistId, gistToken } = getCredentials();

  // Check if config is loaded
  if (!gistId || !gistToken) {
    showLoginForm();
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gistToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearCredentials();
        showLoginForm();
        return;
      }
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const gist = await response.json();
    const content = gist.files['links.json'].content;
    const data = JSON.parse(content);
    allLinks = data.links || [];

    // Populate sender filter
    const senders = [...new Set(allLinks.map(l => l.from))];
    const senderFilter = document.getElementById('senderFilter');
    const currentSender = senderFilter.value;
    senderFilter.innerHTML = '<option value="all">Everyone</option>' +
      senders.map(s => `<option value="${s}">${s}</option>`).join('');
    senderFilter.value = currentSender;

    updateStats();
    filterLinks();
  } catch (error) {
    console.error('Error loading links:', error);
    container.innerHTML = `<div class="error">Failed to load links: ${error.message}</div>`;
  }
}

function updateStats() {
  const unreadCount = allLinks.filter(l => !l.read || Object.keys(l.read).length === 0).length;
  const readCount = allLinks.length - unreadCount;

  document.getElementById('totalCount').textContent = allLinks.length;
  document.getElementById('unreadCount').textContent = unreadCount;
  document.getElementById('readCount').textContent = readCount;
}

function filterLinks() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const senderFilter = document.getElementById('senderFilter').value;

  let filtered = allLinks;

  // Apply sender filter
  if (senderFilter !== 'all') {
    filtered = filtered.filter(l => l.from === senderFilter);
  }

  // Apply status filter
  if (statusFilter === 'unread') {
    filtered = filtered.filter(l => !l.read || Object.keys(l.read).length === 0);
  } else if (statusFilter === 'read') {
    filtered = filtered.filter(l => l.read && Object.keys(l.read).length > 0);
  }

  // Apply search filter
  if (search) {
    filtered = filtered.filter(l =>
      l.title.toLowerCase().includes(search) ||
      l.url.toLowerCase().includes(search)
    );
  }

  renderLinks(filtered);
}

function renderLinks(links) {
  const container = document.getElementById('linksContainer');

  if (links.length === 0) {
    container.innerHTML = '<div class="empty">No links found</div>';
    return;
  }

  container.innerHTML = links.map(link => {
    const isUnread = !link.read || Object.keys(link.read).length === 0;
    const date = new Date(link.ts);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const readBy = link.read ? Object.keys(link.read).join(', ') : 'none';

    return `
      <div class="link-card ${isUnread ? 'unread' : ''}">
        <div class="link-header">
          <div class="link-title">
            <a href="${link.url}" target="_blank" rel="noopener">${link.title}</a>
          </div>
          <div class="link-badges">
            <span class="badge sender">${link.from}</span>
            <span class="badge ${isUnread ? 'unread' : 'read'}">
              ${isUnread ? 'Unread' : 'Read'}
            </span>
          </div>
        </div>
        <div class="link-meta">
          <span>📅 ${dateStr}</span>
          ${!isUnread ? `<span>👁️ Read by: ${readBy}</span>` : ''}
        </div>
        <div class="link-url">${link.url}</div>
      </div>
    `;
  }).join('');
}

// Event listeners - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchInput').addEventListener('input', filterLinks);
  document.getElementById('statusFilter').addEventListener('change', filterLinks);
  document.getElementById('senderFilter').addEventListener('change', filterLinks);
  document.getElementById('refreshBtn').addEventListener('click', loadLinks);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      clearCredentials();
      document.getElementById('logoutBtn').style.display = 'none';
      showLoginForm();
    }
  });

  // Show logout button if credentials exist
  const { gistId, gistToken } = getCredentials();
  if (gistId && gistToken) {
    document.getElementById('logoutBtn').style.display = 'inline-block';
  }

  // Load links on page load
  loadLinks();
});

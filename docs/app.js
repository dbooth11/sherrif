const GIST_ID = typeof CONFIG !== 'undefined' ? CONFIG.GIST_ID : '';
const GIST_TOKEN = typeof CONFIG !== 'undefined' ? CONFIG.GIST_TOKEN : '';

let allLinks = [];
let currentUser = 'Don'; // Default viewer

async function loadLinks() {
  const container = document.getElementById('linksContainer');
  container.innerHTML = '<div class="loading">Loading links...</div>';

  // Check if config is loaded
  if (!GIST_ID || !GIST_TOKEN) {
    container.innerHTML = '<div class="error">Configuration missing! Please create config.js from config.example.js</div>';
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GIST_TOKEN}`
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

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

  // Load links on page load
  loadLinks();
});

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

    renderLinks(allLinks);
  } catch (error) {
    console.error('Error loading links:', error);
    container.innerHTML = `<div class="error">Failed to load links: ${error.message}</div>`;
  }
}

let sortColumn = 'ts';
let sortDirection = -1; // -1 = descending, 1 = ascending

function renderLinks(links) {
  const container = document.getElementById('linksContainer');

  if (links.length === 0) {
    container.innerHTML = '<div class="empty">No links found</div>';
    return;
  }

  const rows = links.map(link => {
    const date = new Date(link.ts);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <tr>
        <td><a href="${link.url}" target="_blank" rel="noopener">${link.title || link.url}</a></td>
        <td>${link.from}</td>
        <td>${dateStr}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th onclick="sortLinks('title')">Title</th>
          <th onclick="sortLinks('from')">From</th>
          <th onclick="sortLinks('ts')">Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function sortLinks(column) {
  // Toggle direction if same column, otherwise reset to descending
  if (sortColumn === column) {
    sortDirection *= -1;
  } else {
    sortColumn = column;
    sortDirection = -1;
  }

  const sorted = [...allLinks].sort((a, b) => {
    let aVal, bVal;

    switch (column) {
      case 'title':
        aVal = (a.title || a.url).toLowerCase();
        bVal = (b.title || b.url).toLowerCase();
        break;
      case 'from':
        aVal = a.from.toLowerCase();
        bVal = b.from.toLowerCase();
        break;
      case 'ts':
        aVal = a.ts;
        bVal = b.ts;
        break;
    }

    if (aVal < bVal) return -1 * sortDirection;
    if (aVal > bVal) return 1 * sortDirection;
    return 0;
  });

  renderLinks(sorted);
}

// Make sortLinks globally accessible for onclick handlers
window.sortLinks = sortLinks;

// Event listeners - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Load links on page load
  loadLinks();
});

# SpitNet v2 Technical Specification

## Overview

SpitNet v2 is a browser extension for sharing links between friends/groups using GitHub Gist as a backend.

## Core Concepts

### Channels
A channel is a shared Gist where links are stored. Users can belong to multiple channels.

### Links
Links are the primary data unit - a URL shared by one user to a channel.

### Read State
Each user tracks their own read state locally. No server-side participation tracking.

---

## Data Models

### Shared Storage (GitHub Gist)

```json
{
  "links": [
    {
      "id": "abc123",
      "from": "Don",
      "url": "https://example.com",
      "title": "Example Page",
      "ts": 1234567890
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID (base36 timestamp + random) |
| from | string | Sender's display name |
| url | string | The shared URL |
| title | string | Page title or URL |
| ts | number | Unix timestamp (ms) |

### Local Storage (Browser)

```javascript
{
  // User identity
  myName: "Don",

  // Configured channels
  channels: [
    {
      id: "gist_id_here",
      name: "Don & Kev",
      token: "ghp_..."  // Per-channel token
    }
  ],

  // Read tracking (per channel)
  "readIds_gist_id_here": ["abc123", "xyz789"],

  // Last poll timestamp (for notifications)
  "lastPoll_gist_id_here": 1234567890
}
```

---

## Architecture

### Components

| Component | Purpose |
|-----------|---------|
| background.js | Service worker - polling, notifications, context menu |
| popup.js | UI - channel management, link list, send button |
| popup.html | Popup UI layout |
| docs/app.js | Archive website (optional) |

### Data Flow

**Sending a link:**
1. User right-clicks → "Send to [Channel]"
2. Fetch current Gist data
3. Add new link to array (unshift)
4. PATCH Gist with updated data
5. Show confirmation notification

**Receiving links:**
1. Background polls Gist every 30s
2. Compare link IDs against local `readIds`
3. Unread = ID not in local set
4. Update badge count
5. Show notification for new links

**Marking as read:**
1. User clicks link in popup
2. Add link ID to local `readIds` set
3. Update badge count
4. No server write needed

---

## API

### GitHub Gist API

**Fetch:**
```
GET https://api.github.com/gists/{gist_id}
Authorization: Bearer {token}
```

**Update:**
```
PATCH https://api.github.com/gists/{gist_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "files": {
    "links.json": {
      "content": "{...}"
    }
  }
}
```

---

## Key Behaviors

### Unread Calculation
```javascript
const unreadLinks = links.filter(link =>
  link.from !== myName &&
  !readIds.includes(link.id)
);
```

### Badge Updates
- 0 unread: Show default icon
- 1+ unread: Show green number on black background

### Notifications
- Only for links from others
- Only for links not previously seen (tracked by `lastSeenIds` in memory)
- Click notification → open link URL

### Link Limit
- Keep max 100 links in Gist (configurable)
- Oldest links dropped when limit exceeded

---

## Permissions (Manifest V3)

```json
{
  "permissions": [
    "storage",
    "contextMenus",
    "notifications",
    "alarms",
    "activeTab"
  ],
  "host_permissions": [
    "https://api.github.com/*"
  ]
}
```

---

## Migration from v1

### Breaking Changes
- Remove `read` object from link data
- Move read tracking to local storage
- Support multiple channels (new)

### Data Migration
1. On first run, check for v1 data structure
2. If `read` field exists on links, ignore it
3. Initialize local `readIds` as empty (all links appear unread once)

---

## Future Considerations

- Link deletion (soft delete with `deleted: true`?)
- Link previews (fetch metadata on send)
- Tags/categories
- Real-time sync (WebSocket/webhook)
- Export/backup functionality

# Shareff v2 Technical Specification

## Overview

Shareff v2 is a browser extension for sharing links with friends. An **admin** creates users and groups, then shares links via context menu. **Recipients** receive links and can send back to the admin.

**Backend:** PHP API with flat file storage
**API URL:** `https://dbooth.net/shareff/api.php` (hardcoded)
**Server directory:** `https://dbooth.net/shareff/` — all server-side files live here (API, email, welcome page, data)
**Platforms:** Chrome and Firefox (Manifest V3)
**Version:** 2.0

## Core Concepts

### Admin
A user who shares links with others. Becomes an admin by adding their first user. Each admin has their own namespace (keyed by email).

### Recipient
A user connected to an admin. Receives links from groups they're in. Can send links back to the admin. **Auto-registered** as a user when they connect to an admin.

### Groups
Admin-side organization only. Recipients don't see group names - they just see a merged feed of links from any group they belong to.

### Users
Admin's pool of known recipients. Each user has a **status**:
- `pending` - Invited but not yet connected
- `connected` - Has installed extension and connected

**Note:** A person can be both an admin (for their own recipients) AND a recipient (of another admin).

---

## Data Model

### Architecture Overview

**Server** (PHP flat files) ↔ **HTTPS API** ↔ **Browser Extension** (chrome.storage.sync)

| Layer | Storage | Data |
|-------|---------|------|
| Server | `/data/admins/{email}.json` | users, groups, links |
| Browser | `chrome.storage.sync` | identity, cached data, readIds |

### Server Storage (Flat Files)

```
/data/admins/
  don_at_email_com.json
  other_at_email_com.json
```

### Admin File Structure

```json
{
  "email": "don@email.com",
  "name": "Don",
  "users": [
    {
      "email": "kev@email.com",
      "name": "Kev",
      "status": "connected",
      "addedAt": 1234567890,
      "invitedAt": 1234567890,
      "connectedAt": 1234567891
    },
    {
      "email": "mike@email.com",
      "name": "Mike",
      "status": "pending",
      "addedAt": 1234567892,
      "invitedAt": 1234567892
    }
  ],
  "groups": [
    {
      "id": "sci123",
      "name": "Science",
      "members": ["kev@email.com"]
    },
    {
      "id": "spo456",
      "name": "Sports",
      "members": ["kev@email.com", "mike@email.com"]
    }
  ],
  "links": [
    {
      "id": "abc123",
      "from": "don@email.com",
      "fromName": "Don",
      "url": "https://example.com",
      "title": "Example",
      "ts": 1234567890,
      "target": "sci123"
    },
    {
      "id": "def456",
      "from": "kev@email.com",
      "fromName": "Kev",
      "url": "https://example2.com",
      "title": "Another Example",
      "ts": 1234567891,
      "target": "inbox"
    }
  ]
}
```

**Link target types:**
- Group ID (e.g., `"sci123"`) - sent to group members
- `"inbox"` - sent from recipient to admin
- User email (e.g., `"kev@email.com"`) - sent to individual

### Local Storage (Browser - chrome.storage.sync)

```javascript
{
  // User identity
  myName: "Don",
  myEmail: "don@email.com",

  // Admin mode (if user has added recipients)
  users: [
    { email: "kev@email.com", name: "Kev", status: "connected" },
    { email: "mike@email.com", name: "Mike", status: "pending" }
  ],
  groups: [
    { id: "sci123", name: "Science", members: ["kev@email.com"] }
  ],

  // Recipient mode (if connected to an admin)
  adminEmail: "other@email.com",  // empty string if not a recipient
  adminName: "Other Person",

  // Read tracking (local only, max 500 entries)
  readIds: ["abc123", "xyz789"]
}
```

**Storage Limits (chrome.storage.sync):**
- Total: 102KB
- Per item: 8KB
- `readIds` capped at 500 entries to prevent quota overflow

---

## User Flows

### Admin Setup
1. Install extension (load from `dist/chrome/` or `dist/firefox/`)
2. Enter name + email, click Save
3. Click "+ Invite User" → enter recipient's name and email
4. **Email sent automatically** with install instructions
5. User appears in list with "Pending" status
6. Optionally create groups and assign users
7. Context menu now shows: "Send to [User]", "Send to [Group]"

### Recipient Setup
1. Receive invite email from admin
2. Click extension install link
3. Enter name + email, click Save
4. Click "+ Connect" → enter admin's email (provided in invite)
5. **Auto-registered** under admin's user list, status changes to "Connected"
6. **Welcome link automatically sent** to recipient's feed
7. Context menu now shows: "Send to [Admin Name]"

### Invite Flow (Unified Add + Invite)
1. Admin clicks "+ Invite User" in Settings
2. Modal prompts for friend's name and email
3. On submit:
   - User added to admin's list with `status: "pending"`
   - Invite email sent via PHP `mail()` with:
     - Extension install link
     - Step-by-step setup instructions
     - Admin's email for connecting
4. Admin sees user in list with "Pending" badge
5. "Resend" button available for pending users
6. When recipient connects, status auto-updates to "Connected"

### Sending Links (Admin)
1. Right-click on page → "Shareff" → "Send to [Science]"
2. Link posted to API under that group
3. All members of Science group will see it

### Sending Links (Recipient)
1. Right-click on page → "Shareff" → "Send to Don"
2. Link posted to admin's inbox
3. Admin sees it in their feed

### Receiving Links
1. Extension polls API every 30s
2. New links trigger notification + badge update
3. Click link in popup → opens URL, marks as read

---

## API Specification

**Base URL:** `https://dbooth.net/shareff/api.php`

### Register/Update Admin

```
POST ?action=register
Content-Type: application/json

{
  "email": "don@email.com",
  "name": "Don"
}

→ { "success": true }
```

Creates admin file if doesn't exist, updates name if it does.

### Add User to Admin's Pool

```
POST ?action=addUser
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "userEmail": "kev@email.com",
  "userName": "Kev",
  "status": "pending"
}

→ { "success": true }
```

**Status field:** `"pending"` or `"connected"` (defaults to `"connected"` for backward compatibility)

**Auto-connection detection:** If a user with `status: "pending"` calls addUser (when connecting), their status automatically updates to `"connected"` and a welcome link is sent.

Also called automatically when a recipient connects to an admin.

### Remove User from Admin's Pool

```
POST ?action=removeUser
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "userEmail": "kev@email.com"
}

→ { "success": true }
```

### Create Group

```
POST ?action=createGroup
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "groupName": "Science",
  "members": ["kev@email.com"]
}

→ { "success": true, "groupId": "sci123" }
```

### Update Group

```
POST ?action=updateGroup
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "groupId": "sci123",
  "groupName": "Science Updated",
  "members": ["kev@email.com", "mike@email.com"]
}

→ { "success": true }
```

### Delete Group

```
POST ?action=deleteGroup
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "groupId": "sci123"
}

→ { "success": true }
```

### Send Link

```
POST ?action=send
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "from": "don@email.com",
  "fromName": "Don",
  "url": "https://example.com",
  "title": "Example Page",
  "target": "sci123"
}

→ { "success": true, "id": "abc123" }
```

**Target options:**
- Group ID: sends to group members
- User email: sends to individual
- `"inbox"`: recipient sending to admin

### Get Links (Admin)

```
GET ?action=getLinks&adminEmail=don@email.com

→ {
    "links": [...],
    "users": [...],
    "groups": [...]
  }
```

Returns all links, users, and groups for the admin.

### Get Links (Recipient)

```
GET ?action=getLinks&adminEmail=don@email.com&userEmail=kev@email.com

→ {
    "links": [...],
    "adminName": "Don"
  }
```

Returns only links where:
- Target is a group the user belongs to, OR
- Target is the user's email directly

### Get Admin Info (for recipient setup)

```
GET ?action=getAdmin&adminEmail=don@email.com

→ {
    "exists": true,
    "name": "Don"
  }
```

Used when recipient enters admin email to validate and get display name.

### Send Invite Email

```
POST ?action=sendInvite
Content-Type: application/json

{
  "adminEmail": "don@email.com",
  "adminName": "Don",
  "userEmail": "kev@email.com",
  "userName": "Kev",
  "extensionUrl": "https://chrome.google.com/webstore/..."
}

→ { "success": true, "message": "Invite sent" }
```

Sends HTML email via PHP `mail()` with:
- Install link for extension
- Step-by-step setup instructions
- Admin's email for connecting
- Link to welcome page (`https://www.dbooth.net/shareff/welcome.html`)

**Email headers:**
- From: `Shareff <shareff@dbooth.net>`
- Reply-To: Admin's email
- Content-Type: `text/html; charset=UTF-8`

### Get User Status

```
GET ?action=getUserStatus&adminEmail=don@email.com

→ {
    "users": [
      {
        "email": "kev@email.com",
        "name": "Kev",
        "status": "connected",
        "addedAt": 1234567890,
        "invitedAt": 1234567890,
        "connectedAt": 1234567891
      }
    ]
  }
```

Returns status of all users for an admin.

---

## Context Menus

### Admin Context Menu
```
Shareff →
  Send to Kev
  Send to Mike
  ────────────
  Send to [Science]
  Send to [Sports]
```

### Recipient Context Menu
```
Shareff →
  Send to Don
```

### Both Roles Context Menu
If user is both admin and recipient:
```
Shareff →
  Send to Kev          (admin's users)
  Send to [Science]    (admin's groups)
  ────────────
  Send to Other Person (recipient's admin)
```

---

## Extension UI

### Popup (Links View)

**Header:** Shareff | Archive | Settings

**Search:** Filter input

**Links List:**
- Each link shows: NEW badge (if unread), title, sender, time
- Clicking opens URL and marks as read
- Sorted: unread first, then by time

**Empty States:**
- Welcome message with "Open Settings" button (first run)
- "No links yet" with right-click hint

### Settings Page (Full Browser Tab)

Opens in a new browser tab when clicking Settings button.

**Header:** Shareff Settings | View Archive link

**How It Works Section:**
- SVG network diagram showing sharing flow
- Green region: "YOU SEND" (users/groups)
- Red region: "YOU RECEIVE" (admin connection)
- Info box explaining two-way sharing

**Identity Card:**
- Name input
- Email input

**Two-Column Grid:**

| Share Links (Admin) | Receive Links (Recipient) |
|---------------------|---------------------------|
| Users list + Invite | Connected admin display   |
| Status badges       | + Connect button          |
| Groups list + Create|                           |

**Sticky Save Bar:** Cancel | Save Changes

**Modals:**
- Invite User (name, email → sends invite email)
- Resend Invite (for pending users)
- Create Group (name, member checkboxes)
- Edit Group (name, members, delete)
- Connect to Admin (email lookup)

### User List Display

Each user shows:
- Name + status badge ("Pending" yellow / "Connected" green)
- Email address
- Actions: "Resend" button (pending only), "Remove" button

---

## Key Behaviors

### Unread Calculation
```javascript
// Admin sees: links from recipients (target = "inbox" or their email)
// Recipient sees: links from admin to groups they're in

const unreadLinks = links.filter(link =>
  !readIds.includes(link.id)
);
```

### Icon/Badge Updates
- 0 unread: Shows 🤓 emoji icon (OffscreenCanvas in service worker)
- 1+ unread: Shows green number on black background

### Notifications
- **Incoming links (polling):** System notifications via `chrome.notifications`
- **Sent links:** In-page toast bubble injected via `chrome.scripting.executeScript`
  - Green toast for success, red for errors
  - Slides in top-right, auto-dismisses after 2 seconds
- Click system notification → open link URL

### Storage Limits
- Max 100 links per admin (server-side)
- Max 500 readIds (client-side, auto-trimmed)
- chrome.storage.sync: 102KB total, 8KB per item

### Polling
- Every 20 minutes via `chrome.alarms` (POLL_INTERVAL_MINUTES = 20)
- Alarm recreated on service worker wake-up if missing

---

## Authentication

All API requests require an `X-Shareff-Key` header. Requests without a valid key receive HTTP 403.

```
X-Shareff-Key: sh2_2270d1d4054dde1695f2ccb4f5a84af0
```

This prevents unauthorized API access and spam from random endpoint discovery. The key is hardcoded in both the extension JS and server PHP.

---

## Permissions (Manifest V3)

```json
{
  "permissions": [
    "storage",
    "contextMenus",
    "notifications",
    "alarms",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://dbooth.net/*"
  ]
}
```

- `scripting` — Used to inject toast notifications into the active tab after sending a link

---

## File Structure

```
/sherrif
  manifest.json           - Chrome manifest (service_worker)
  manifest.firefox.json   - Firefox-specific manifest (scripts)
  background.js           - Service worker: polling, notifications, context menu
  popup.html              - Main popup (links view only)
  popup.js                - Popup logic (links, search)
  popup.css               - Popup styles
  settings.html           - Full-page settings (opens in new tab)
  settings.js             - Settings page logic
  settings.css            - Settings styles
  icons/                  - Extension icons (16, 48, 128px PNG)
  V2_SPEC.md             - This specification

  /dist
    /chrome               - Chrome build (symlinks to source files)
      manifest.json       - Symlink to ../manifest.json
    /firefox              - Firefox build (copies of source files)
      manifest.json       - Copy of manifest.firefox.json

  /shareff                - Server directory (https://dbooth.net/shareff/)
    api.php               - Main API file
    email.php             - Email API + shared email utilities
    welcome.html          - Welcome page sent to new users via invite email
    styles.css            - Styles for welcome page
    .htaccess             - Security rules (blocks /data/ access, .json files)
    /data/admins/         - Flat JSON files per admin
```

### Browser-Specific Builds

**Chrome:** Uses `service_worker` in manifest
```json
"background": {
  "service_worker": "background.js"
}
```

**Firefox:** Uses `scripts` in manifest
```json
"background": {
  "scripts": ["background.js"]
}
```

---

## Development

### Loading the Extension

**Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/chrome/` folder

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `dist/firefox/manifest.json`

### After Making Changes

Chrome's symlinks auto-update. For Firefox, copy updated files:
```bash
cp popup.js popup.html background.js dist/firefox/
```

### Testing the API

```bash
curl "https://dbooth.net/shareff/api.php?action=getLinks&adminEmail=don@test.com"
```

---

## Chrome Web Store Publishing

### Unlisted Extension
1. Go to Chrome Web Store Developer Dashboard
2. Upload `dist/chrome/` as a zip
3. Set visibility to "Unlisted"
4. After approval, update `EXTENSION_URL` in popup.js with the store URL

### Requirements Met
- [x] Manifest V3
- [x] Icons: 16, 48, 128px PNG
- [x] Description provided
- [x] Permissions documented

---

## Changelog

### v2.1 (Current)
- Unified Add + Invite flow (email sent automatically)
- User status tracking (pending/connected)
- Auto-detection when recipient connects
- Welcome link auto-sent to new users
- Resend invite for pending users
- Landing page and welcome page served from server (`shareff/`)
- API key authentication (`X-Shareff-Key` header)
- In-page toast bubbles for send confirmation (via `scripting` permission)
- External CSS files (popup.css, settings.css, shareff/styles.css)

### v2.0
- Complete rewrite from v1 (GitHub Gist backend)
- PHP flat-file backend
- Admin/Recipient model
- Groups support
- Invite system
- Storage quota protection (max 500 readIds)
- Cross-browser support (Chrome + Firefox)
- Dynamic icon with OffscreenCanvas

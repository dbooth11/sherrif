# Shareff v2

A browser extension for sharing links with friends. Share links via right-click context menu, receive notifications when friends send you links.

## Features

- Share links via right-click context menu
- Organize recipients into groups
- Desktop notifications for new links
- Dynamic icon shows unread count (or nerd emoji when all caught up)
- Works on Chrome and Firefox (Manifest V3)
- Archive site for viewing all links

## Quick Start

### Install (Chrome)

1. Download or clone this repository
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/chrome/` folder

### Install (Firefox)

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `dist/firefox/manifest.json`

### Setup

1. Click the extension icon
2. Enter your name and email
3. Click "Save"

### As an Admin (sharing with others)

1. Go to Settings
2. Click "+ Add User" to add friends
3. Optionally create groups to organize friends
4. Right-click any page/link and select "Shareff" > "Send to [name]"

### As a Recipient (receiving from someone)

1. Go to Settings
2. Click "+ Connect" under "Receive Links"
3. Enter the admin's email address
4. You'll now receive links they send you

## Usage

### Sending Links

Right-click on any page or link, then select:
- **Shareff > Send to [Name]** - send to individual
- **Shareff > Send to [Group]** - send to group members

### Viewing Links

- Click the extension icon to see your links
- Click a link to open it (marks as read)
- Use the search box to filter links
- Click "Archive" for the full history

## Development

See [V2_SPEC.md](V2_SPEC.md) for technical documentation.

### After Making Changes

Chrome uses symlinks (auto-updates). For Firefox:

```bash
cp popup.js popup.html background.js dist/firefox/
```

## Architecture

- **Extension**: Manifest V3 browser extension (Chrome/Firefox)
- **Backend**: PHP API with flat file storage
- **API URL**: `https://dbooth.net/server/api.php`

See [server/README.md](server/README.md) for server setup.

## License

MIT

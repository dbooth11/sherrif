# Friend Link Sender

A browser extension for sharing links between friends using GitHub Gist as a backend.

## Features

- 🔔 Share links via right-click context menu
- 📊 Dynamic green number icon showing unread count
- 🌐 GitHub Pages archive site to view all links
- ✅ Auto-mark links as read when clicked
- 🔄 Real-time sync between friends

## Setup

### 1. Create a GitHub Gist

1. Go to https://gist.github.com/
2. Create a new gist named `links.json`
3. Initial content:
```json
{
  "links": []
}
```
4. Copy the gist ID from the URL (e.g., `abc123def456...`)

### 2. Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it **gist** permissions
4. Copy the token (starts with `ghp_...`)

### 3. Install the Extension

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from this directory

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

### 4. Configure the Extension

1. Click the extension icon
2. Enter:
   - Your name (e.g., Don or Kev)
   - Friend's name
   - Gist ID (from step 1)
   - GitHub Token (from step 2)
3. Click "Let's Go!"

### 5. Setup GitHub Pages (Optional)

To view all links in a web interface:

1. Copy `config.example.js` to `config.js`:
```bash
cp config.example.js config.js
```

2. Edit `config.js` with your credentials:
```javascript
const CONFIG = {
  GIST_ID: 'your-gist-id-here',
  GIST_TOKEN: 'your-github-token-here'
};
```

3. Deploy to GitHub Pages:
```bash
git add .gitignore config.example.js
git commit -m "Add secure config setup"
git push origin master
```

4. Enable GitHub Pages in repo settings:
   - Settings → Pages
   - Source: Deploy from branch
   - Branch: `main` → `/` (root)

Your archive will be at: `https://yourusername.github.io/sherrif/`

## Usage

### Sending Links

- **Right-click** on any link or page → "Send to [Friend]"
- Or click the extension icon → "Send to Friend" button

### Viewing Links

- Click the extension icon to see unread links
- Clicking a link opens it and marks it as read
- View full archive on the GitHub Pages site

## Security Note

- Never commit `config.js` (it's gitignored)
- Tokens are stored securely in browser storage for the extension
- For the GitHub Pages site, config.js stays local

## Development

- `background.js` - Background polling & notifications
- `popup.js` - Extension popup interface
- `popup.html` - Popup UI
- `index.html` - GitHub Pages archive site
- `manifest.json` - Extension configuration

## License

MIT

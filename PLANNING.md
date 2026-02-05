# Shareff v2 Planning

## Current Status: POC Complete

The v2 rewrite is functionally complete and ready for testing with real users.

### Completed

- [x] PHP flat-file backend API
- [x] Chrome extension (Manifest V3)
- [x] Firefox extension (Manifest V3)
- [x] Admin/Recipient model
- [x] User management (add/remove)
- [x] Group management (create/edit/delete)
- [x] Context menu integration
- [x] Link sending (to users, groups, inbox)
- [x] Link receiving with polling (30s)
- [x] Desktop notifications
- [x] Dynamic icon (unread count / nerd emoji)
- [x] Invite system (copy-paste message)
- [x] Storage quota protection (max 500 readIds)
- [x] Code review against MV3 docs

### In Progress

- [ ] Chrome Web Store unlisted publishing
- [ ] Real user testing (Don + Kev)

---

## Next Steps

### Phase 1: Publishing (Current)

1. **Publish to Chrome Web Store (Unlisted)**
   - Create developer account ($5 one-time)
   - Zip dist/chrome folder
   - Submit for review
   - Update EXTENSION_URL in popup.js with store link

2. **Test with Real Users**
   - Don as admin, Kev as recipient
   - Send links back and forth
   - Verify notifications work
   - Test reconnection flow

### Phase 2: Polish

1. **UI Improvements**
   - Better loading states
   - Error handling feedback
   - Empty state illustrations

2. **Link Management**
   - Delete individual links
   - Mark all as read
   - Link previews (favicon, thumbnail)

3. **Reliability**
   - Offline queue for sending
   - Retry failed API calls
   - Better conflict resolution

### Phase 3: Features

1. **Multiple Admin Support**
   - Recipients can connect to multiple admins
   - Separate feeds per admin

2. **Archive Improvements**
   - GitHub Pages archive site update
   - Search and filter
   - Date grouping

3. **Privacy/Security**
   - Optional API key per admin
   - Rate limiting
   - Email verification

---

## Technical Debt

- [ ] Remove unused `apiUrl` from all storage operations (cleanup)
- [ ] Add error boundary for popup crashes
- [ ] Add logging for debugging production issues
- [ ] Consider moving readIds to storage.local (unlimited quota)

---

## Architecture Decisions

### Why Flat Files?

- Simple deployment (any PHP host)
- No database setup required
- Easy to backup/inspect
- Good enough for small scale (< 100 users)

### Why No Authentication?

- Simplicity for POC
- Security through obscurity (email as key)
- Can add API keys later without breaking changes

### Why Manifest V3?

- Required for Chrome Web Store (MV2 deprecated)
- Better performance (service workers)
- Firefox also supports MV3 now

---

## Future Ideas (Backlog)

- Mobile companion app
- Web dashboard for admins
- Slack/Discord integration
- Browser sync for readIds
- Link expiration
- Read receipts
- Link reactions/comments
- Scheduled sending
- Link categories/tags

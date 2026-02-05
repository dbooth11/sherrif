# SpitNet v2 Server

PHP API backend for the SpitNet browser extension.

## Requirements

- PHP 7.4+
- Apache with mod_rewrite (or nginx)
- Write permissions on `/data/admins/` directory

## Deployment

1. Upload the `server/` folder to your web host
2. Ensure the `data/admins/` directory is writable:
   ```bash
   chmod 755 data/admins
   ```
3. Test the API:
   ```bash
   curl https://yoursite.com/spitnet/api.php?action=getAdmin&adminEmail=test@example.com
   ```
   Should return: `{"exists":false}`

## API Endpoints

| Action | Method | Description |
|--------|--------|-------------|
| `register` | POST | Create/update admin |
| `addUser` | POST | Add user to admin's pool |
| `removeUser` | POST | Remove user from admin's pool |
| `createGroup` | POST | Create a new group |
| `updateGroup` | POST | Update group name/members |
| `deleteGroup` | POST | Delete a group |
| `send` | POST | Send a link |
| `getLinks` | GET | Get links (admin or recipient view) |
| `getAdmin` | GET | Check if admin exists |

See `V2_SPEC.md` for full API documentation.

## Security Notes

- The `.htaccess` file blocks direct access to JSON files
- No authentication - relies on obscurity of admin emails
- For production use, consider adding API keys or rate limiting

## File Structure

```
server/
  api.php           - Main API
  .htaccess         - Security rules
  data/
    admins/
      user_at_email_com.json   - One file per admin
```

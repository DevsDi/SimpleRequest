# SimpleRequest Permissions Justification

This document explains each permission requested by SimpleRequest Chrome extension and its purpose.

## Permissions List

### 1. storage

**Permission Type**: Required permission

**Justification**:
```
Used to store user's request history and UI preferences locally in the browser.
```

**Details**:
- Stores request history (max 100 entries)
- Saves user-adjusted window layout preferences
- Data stored entirely locally, not uploaded to any server
- User can delete all data via "Clear" button anytime

**Usage Scenario**:
- After user sends a request, config and response are auto-saved
- When user adjusts panel layout, settings restored on next open

---

### 2. tabs

**Permission Type**: Required permission

**Justification**:
```
Used to create a new tab when clicking the extension icon to open the request debugging interface.
```

**Details**:
- Uses `chrome.tabs.create()` when extension icon is clicked
- Only creates SimpleRequest's own UI page
- Does not read, modify, or close other tabs

**Usage Scenario**:
- User clicks H icon in toolbar, extension opens request interface in new tab

---

### 3. host_permissions: <all_urls>

**Permission Type**: Host permission

**Justification**:
```
Allows the extension to send HTTP requests to any URL for API debugging functionality.
```

**Details**:
- User needs to send requests to various API servers for debugging
- Extension needs to make cross-origin requests in background Service Worker
- Does not read, modify, or inject content into any website
- Only sends user-configured HTTP requests

**Usage Scenario**:
- User enters API URL (e.g., https://api.example.com/users)
- User clicks "Send", extension sends request to that URL
- Supports all HTTP methods (GET, POST, PUT, DELETE, etc.)

**Security Guarantees**:
- Only sends user-initiated requests
- No automatic requests
- No collection or upload of request/response data to external servers

---

## Permission Comparison

| Permission | Reason | Access User Data | Upload External |
|------------|--------|-----------------|----------------|
| storage | Save local data | Only own data | ❌ |
| tabs | Create UI tab | ❌ | ❌ |
| <all_urls> | Send HTTP requests | Only user-configured URLs | ❌ |

## Permissions NOT Requested

SimpleRequest does NOT request these common permissions:

- ❌ **webRequest** - Does not intercept or modify network requests
- ❌ **cookies** - Does not read or modify cookies
- ❌ **history** - Does not access browser history
- ❌ **bookmarks** - Does not access bookmarks
- ❌ **clipboardRead** - Does not read clipboard
- ❌ **geolocation** - Does not get location
- ❌ **notifications** - Does not send notifications

## Minimal Permission Principle

SimpleRequest follows Chrome extension minimal permission principle:

1. **Only necessary permissions** - Minimal set for core functionality
2. **No optional permissions** - No non-core feature permissions
3. **Transparent usage** - Each permission purpose fully transparent
4. **User control** - User can uninstall to revoke all permissions

## User Control

Users can control permissions via:

- **View permissions**: chrome://extensions/ → "Details"
- **Revoke permissions**: Uninstall extension
- **Clear data**: Click "Clear history" to delete local storage

## Update Log

| Version | Permission Change | Description |
|---------|------------------|-------------|
| 1.0.0 | Initial | storage, tabs, <all_urls> |

---

For permission-related questions:
- GitHub: https://github.com/DevsDi/SimpleRequest
- Email: Open an issue on GitHub
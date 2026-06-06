# Changelog

All notable changes to SimpleRequest are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-06-06

### Added

- HTTP request builder with 7 methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- Smart URL input with auto-protocol detection and bidirectional query param sync
- curl command import — auto-parses method, URL, headers, body, and auth
- Authorization tab supporting No Auth, API Key, Bearer Token, Basic Auth, and OAuth 2.0
- API Key auth with header or query parameter placement
- Request body editor with four types: form-data, x-www-form-urlencoded, raw, none
- File upload support in form-data (base64 encoding → Blob in Service Worker)
- Raw body subtype selector: JSON, Text, XML, HTML, JavaScript
- Per-type content storage — switching body types preserves each type's content
- Custom headers editor with enable/disable toggles and descriptions
- Response viewer with JSON syntax highlighting and collapsible nodes
- Collapse All / Expand All for JSON response
- Raw view toggle for response body
- Response headers viewer
- One-click copy for response body and headers
- Color-coded status codes (2xx green, 3xx blue, 4xx amber, 5xx red)
- Request history panel — up to 100 entries, persisted via chrome.storage.local
- Single history entry deletion
- Clear all history
- Variable system — `{{variableName}}` placeholders in URL, headers, body, and auth
- Variable enable/disable toggle
- Resizable layout — drag to adjust sidebar width and request/response split
- Layout preferences persist across sessions
- Dark theme optimized for developer workflows
- Extension opens in a full browser tab (not a popup)
- Bold H icon in toolbar
- Privacy policy and permissions justification documents
- GitHub Pages hosted privacy policy

### Changed

- Merged standalone JSON body type into raw (JSON is now a raw subtype)
- User-defined headers take priority over auth-generated headers
- GET and HEAD requests skip body (per HTTP spec)
- Content-Type auto-set based on raw subtype selection

### Security

- All data stored locally in chrome.storage.local — no external data transmission
- No analytics, tracking, or cookies
- Minimal Chrome permissions (storage, tabs, host_permissions)

# SimpleRequest

A lightweight HTTP request debugging tool — Postman-style Chrome Extension.

![SimpleRequest](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Chrome](https://img.shields.io/badge/chrome-Manifest_V3-orange)

## Features

### Request Builder

| Feature | Description |
|---------|-------------|
| HTTP Methods | GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS |
| Smart URL | Auto-adds protocol, bidirectional query param sync |
| curl Import | Paste a curl command — method, URL, headers, body, and auth auto-populate |
| Enter to Send | Press Enter in URL field to send immediately |

### Authorization

| Type | Details |
|------|---------|
| No Auth | Skip authentication |
| API Key | Custom key/value, sent as header or query parameter |
| Bearer Token | `Authorization: Bearer <token>` |
| Basic Auth | Username/password → `Authorization: Basic <encoded>` |
| OAuth 2.0 | Access token with configurable token type |

User-defined headers always take priority over auth-generated headers.

### Request Body

| Type | Description |
|------|-------------|
| form-data | Key-value pairs with file upload support (base64 → Blob) |
| x-www-form-urlencoded | URL-encoded form data (text only) |
| raw | JSON / Text / XML / HTML / JavaScript — with subtype selector |
| none | No request body |

Each body type retains its own content when switching between types.

### Headers & Params

- Key-value editor with enable/disable toggles and descriptions
- URL query params auto-synced with query string (bidirectional)
- Per-item checkboxes to quickly include/exclude entries

### Response Viewer

- Color-coded status codes (2xx green → 5xx red)
- Response time and size display
- JSON body with syntax highlighting, collapsible nodes, and Collapse All / Expand All
- Raw view toggle for plain text
- Response headers viewer
- One-click copy for body or headers

### History

- Automatic request history — method, URL, status code, and timestamp
- Click any entry to reload the full request
- Delete individual entries or clear all history
- Persists across sessions via `chrome.storage.local`
- Maximum 100 entries

### Variables

- Define `{{variableName}}` placeholders in URL, headers, body, and auth fields
- Enable/disable individual variables
- Persist across sessions

### UI

- Resizable panels — drag to adjust request/response split and sidebar width
- Sidebar tabs for History and Variables
- Dark theme optimized for developer workflows
- Opens in a full browser tab (not a popup) for comfortable editing

## Installation

### Load Unpacked Extension (Developer Mode)

1. Clone and build:
   ```bash
   git clone https://github.com/DevsDi/SimpleRequest.git
   cd SimpleRequest
   npm install
   npm run build
   ```

2. Open Chrome, go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right)

4. Click **Load unpacked**

5. Select the `dist` folder

6. Click the **H icon** in the toolbar to open SimpleRequest in a new tab

### Install from Chrome Web Store

*Coming soon*

## Usage

### Send a Request

1. Click the extension icon — opens in a new tab
2. Enter a URL or paste a curl command in the URL field
3. Select an HTTP method (GET, POST, etc.)
4. Configure headers, body, or auth in the tabs
5. Click **Send**

### Import from curl

Paste a full `curl` command into the URL bar. SimpleRequest automatically parses:

- HTTP method (`-X`, `--request`)
- URL
- Headers (`-H`, `--header`)
- Request body (`-d`, `--data`, `--data-raw`, `--data-binary`)
- Basic auth (`-u`, `--user`)
- Content type → raw subtype (JSON, XML, etc.)

### Use Variables

1. Open the **Variables** tab in the sidebar
2. Add variable names and values (e.g., `baseUrl` → `https://api.example.com`)
3. Reference them in URL, headers, body, or auth as `{{baseUrl}}`
4. Disabled variables are kept but not substituted

### View Response

- **Body tab**: Formatted JSON with collapsible nodes, or raw text
- **Headers tab**: All response headers with copy support
- Status code, response time, and size shown in the status bar

### Manage History

- Left sidebar shows up to 100 recent requests
- Click to reload a previous request
- Hover to reveal the delete button (×) for single entry removal
- **Clear** button deletes all history

### Adjust Layout

- Drag the **sidebar right edge** → adjust history/variables panel width
- Drag the **request section bottom edge** → adjust request/response height ratio
- Layout preferences persist across sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Zustand |
| Build | Vite 5 |
| Styles | SCSS + Dark theme |
| Extension | Chrome Extension Manifest V3 |
| Highlight | react-syntax-highlighter |

## Project Structure

```
SimpleRequest/
├── dist/                    # Build output (load into Chrome)
│   ├── manifest.json
│   ├── icons/
│   ├── background/
│   ├── src/popup/
│   ├── popup.js
│   └── assets/
├── docs/                    # GitHub Pages
│   └── PRIVACY.html
├── src/
│   ├── popup/               # UI components
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── RequestPanel/    # Method, URL, Headers, Body, Auth, Params
│   │       ├── ResponsePanel/   # Status, Body (JSON/Raw), Headers
│   │       ├── HistoryPanel/    # Request history list
│   │       ├── VariablesPanel/  # Variable management
│   │       └── DonateModal/     # Support dialog
│   ├── background/          # Service Worker (HTTP requests, CORS)
│   │   └── index.ts
│   ├── services/            # Business logic
│   │   ├── requestService.ts    # Request execution & history
│   │   ├── curlParser.ts        # curl command parser
│   │   ├── variableService.ts   # Variable substitution
│   │   └── storageService.ts    # Chrome storage wrapper
│   ├── store/               # Zustand state
│   │   └── index.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── utils/               # Constants & utilities
│       ├── constants.ts
│       └── timeUtils.ts
├── public/
│   ├── manifest.json
│   └── icons/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── PRIVACY.md
├── PERMISSIONS.md
└── LICENSE
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send request | `Enter` in URL field |
| Confirm header suggestion | `Enter` / `Tab` |
| Cancel suggestion | `Escape` |
| Navigate suggestions | `↑` / `↓` |

## Development

```bash
npm install     # Install dependencies
npm run dev     # Development mode with HMR
npm run build   # Production build to dist/
npm run lint    # ESLint check
```

## Permissions

See [PERMISSIONS.md](./PERMISSIONS.md) for detailed justification of each permission.

| Permission | Purpose |
|------------|---------|
| `storage` | Save history and settings locally |
| `tabs` | Create new tab for the UI |
| `<all_urls>` | Send HTTP requests to any URL |

## Privacy Policy

See [PRIVACY.md](./PRIVACY.md) or the hosted version at [devsdi.github.io/SimpleRequest/PRIVACY.html](https://devsdi.github.io/SimpleRequest/PRIVACY.html)

**Core commitments**:
- ✅ All data stored locally in browser
- ✅ No data uploaded to external servers
- ✅ No personal information collected
- ✅ Clear all data anytime

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE)

---

**Made with ⚡ by [DevsDi](https://github.com/DevsDi)**

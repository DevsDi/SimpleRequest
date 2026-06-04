# SimpleRequest

A lightweight HTTP request debugging tool - Postman-style Chrome Extension

## Features

| Feature | Description |
|---------|-------------|
| 🚀 HTTP Methods | GET/POST/PUT/DELETE/PATCH, etc. |
| 📝 Request Body | JSON/Form-Data/Raw |
| 📋 Headers | Custom headers with autocomplete |
| 📊 Response | JSON syntax highlighting |
| 📜 History | Auto-save, max 100 entries |
| 🔄 curl Import | Paste curl command, auto-convert |
| ⚙️ Smart Defaults | Content-Type/Accept auto-added |
| 🖱️ Resizable Layout | Drag to adjust panels |

## Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. Build the project:
   ```bash
   npm install
   npm run build
   ```

2. Open Chrome, go to `chrome://extensions/`

3. Enable **"Developer mode"** (toggle in top-right)

4. Click **"Load unpacked"**

5. Select the `dist` folder

6. Done! Click the **H icon** in toolbar to use

### Method 2: Packaged Extension

1. Go to `chrome://extensions/`, click **"Pack extension"**

2. Extension root directory: `dist`

3. Generate `.crx` file for installation

## Usage

### Send Request
1. Click extension icon - opens in new tab
2. Enter URL or paste curl command in URL field
3. Select HTTP method (GET/POST, etc.)
4. Configure headers/body in tabs
5. Click **Send**

### Header Autocomplete
- Type header name to see suggestions
- 30+ common headers (Authorization, Content-Type, etc.)
- Navigate with ↑↓ keys, Enter to confirm

### View Response
- Auto-formatted with JSON highlighting
- Shows status code, response time, size
- Switch to view response headers

### History
- Left panel shows last 100 requests
- Click to re-send quickly
- Clear button to delete all

### Adjust Layout
- Drag sidebar right edge → adjust history panel width
- Drag request section bottom edge → adjust request/response height ratio

## Tech Stack

- **Frontend**: React 18 + TypeScript + Zustand
- **Build**: Vite 5
- **Styles**: SCSS + Dark theme
- **Extension**: Chrome Extension Manifest V3
- **Highlight**: react-syntax-highlighter

## Project Structure

```
SimpleRequest/
├── dist/                    # Build output (load to Chrome)
│   ├── manifest.json
│   ├── icons/
│   ├── background/
│   ├── src/popup/
│   ├── popup.js
│   └── assets/
├── src/
│   ├── popup/               # UI components
│   │   ├── App.tsx
│   │   └── components/
│   ├── background/          # Service Worker
│   │   └── index.ts
│   ├── services/            # Business logic
│   │   ├── requestService.ts
│   │   ├── curlParser.ts
│   │   └── storageService.ts
│   ├── store/               # Zustand state
│   ├── types/               # TypeScript types
│   └── utils/               # Constants/utilities
├── public/
│   ├── manifest.json
│   └── icons/
├── package.json
├── vite.config.ts
├── README.md
├── PRIVACY.md
└── PERMISSIONS.md
```

## Shortcuts

| Action | Shortcut |
|--------|----------|
| Send request | Enter in URL field |
| Confirm suggestion | Enter / Tab |
| Cancel suggestion | Escape |
| Navigate suggestions | ↑ / ↓ |

## Development

```bash
npm run dev      # Development mode
npm run build    # Production build
npm run lint     # Code linting
```

## Privacy Policy

See [PRIVACY.md](./PRIVACY.md)

**Core commitments**:
- ✅ All data stored locally in browser
- ✅ No data uploaded to external servers
- ✅ No personal information collected
- ✅ Clear all data anytime

## Permissions

See [PERMISSIONS.md](./PERMISSIONS.md)

**Requested permissions**:
| Permission | Purpose |
|------------|---------|
| `storage` | Save history and settings |
| `tabs` | Create new tab for UI |
| `<all_urls>` | Send HTTP requests to any URL |

## License

MIT License

---

**Made with ⚡ by SimpleRequest**
# Mobile Vault Extension - Quick Build Guide

## Build the Extension

Simply run:

```bash
pnpm build:extension
```

That's it! This will:
1. Build the React app with Vite
2. Copy extension files (manifest, background script, icons)
3. Generate the popup.html with correct asset paths
4. Create everything in `dist/extension/`

## Load into Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select the `dist/extension` folder
5. Done! The extension should now appear in your Chrome toolbar

## What Gets Built

The `dist/extension/` folder contains:
```
dist/extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker
├── popup.html              # Extension interface
├── icons/                  # Extension icons
└── assets/                 # Built React app files
    ├── index-xxx.js       # JavaScript bundle
    └── index-xxx.css      # Styles
```

## That's All

No server code, no unnecessary files - just a clean Chrome extension bundle ready to use.

## Development

For development with hot reload, use the main dev server:

```bash
pnpm dev
```

Then test in your browser at `http://localhost:8080`

When ready to test as an extension, run `pnpm build:extension` and load it into Chrome.

# SecureVault Browser Extension Setup

This guide explains how to set up and run SecureVault as a Chrome browser extension.

## Files Overview

- **manifest.json** - Chrome extension manifest (required)
- **background.js** - Background service worker for Chrome storage
- **popup.html** - Extension popup interface
- **public/icons/** - Extension icons

## Installation Steps

### 1. Build the Extension

First, build the React application:

```bash
pnpm build
```

This creates the built files in `dist/spa/`.

### 2. Prepare Extension Directory

Create an extension directory with the required files:

```bash
mkdir securevault-extension
cp manifest.json securevault-extension/
cp background.js securevault-extension/
cp popup.html securevault-extension/
cp -r public/icons securevault-extension/
cp -r dist/spa/assets securevault-extension/assets
```

### 3. Update popup.html paths

In the copied `popup.html`, update the script and link paths to point to the correct locations:

```html
<link rel="stylesheet" href="assets/index-xxx.css" />
<script type="module" src="assets/index-xxx.js"></script>
```

(Replace `xxx` with the actual hash from your build output)

### 4. Load into Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `securevault-extension` directory
5. The extension should now appear in your extension list

### 5. Test the Extension

1. Click the SecureVault icon in your Chrome toolbar
2. The extension popup should open with your vault interface

## Features

- **Stage 1 (Disconnected)**: Shows logo and Connect button
- **Stage 2 (Connecting)**: Displays QR code for secure connection setup
- **Stage 3 (Connected)**: Full vault management with:
  - Search functionality for vault entries
  - Add new vault entries with attributes
  - Copy-to-clipboard for entry values
  - Secret value masking
  - Password generator with customizable options

## Data Storage

- All vault entries are stored locally in Chrome Storage
- Data persists across browser sessions
- No data is sent to external servers (unless configured later)

## Development

### Development Mode

For development with hot reload:

```bash
pnpm dev
```

Then in `popup.html`, use:
```html
<script type="module" src="http://localhost:8080/src/main.tsx"></script>
```

### Building for Production

```bash
pnpm build
```

Then follow the "Prepare Extension Directory" steps above.

## Future Enhancements

- [ ] Firefox extension support (Manifest V2 compatibility)
- [ ] Edge extension support
- [ ] Extension options page for settings
- [ ] Real QR code generation (currently simplified)
- [ ] Backend integration for sync across devices
- [ ] Encryption for stored vault data
- [ ] Auto-fill credentials on websites

## Troubleshooting

**Blank popup?**
- Make sure the asset paths in popup.html match your build output
- Check the extension's error logs: click Details → Errors

**Can't type in fields?**
- This is usually a popup size issue. The popup.html is set to 390x600px (Samsung S21 size)
- You can adjust the height in popup.html if needed

**Data not persisting?**
- Check Chrome DevTools for the extension (right-click extension icon → Inspect popup)
- Ensure chrome.storage permissions are granted

## API Reference

The extension uses Chrome Storage API for persistence:

```javascript
// Save data
chrome.storage.local.set({ key: value })

// Read data
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key)
})
```

## Icons

Extension icons should be provided in:
- `icons/icon-16.png` (16x16px)
- `icons/icon-48.png` (48x48px)  
- `icons/icon-128.png` (128x128px)

Current icons are SVG placeholders. Generate proper PNG icons for production use.

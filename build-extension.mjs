#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST_DIR = path.join(__dirname, 'dist', 'extension');
const SRC_DIR = __dirname;

console.log('🏗️  Building Mobile Vault Extension...\n');

try {
  // Step 1: Build React app with extension entry point
  console.log('📦 Building React app...');
  execSync('vite build --config vite.config.extension.ts', { stdio: 'inherit' });
  console.log('✓ React app built\n');

  // Step 2: Rename extension.html to popup.html
  console.log('📄 Setting up extension files...');
  const extensionHtml = path.join(DIST_DIR, 'extension.html');
  const popupHtml = path.join(DIST_DIR, 'popup.html');

  if (fs.existsSync(extensionHtml)) {
    fs.renameSync(extensionHtml, popupHtml);
    console.log('  ✓ popup.html');
  }

  // Step 3: Copy extension configuration files
  // Copy manifest.json
  fs.copySync(
    path.join(SRC_DIR, 'manifest.json'),
    path.join(DIST_DIR, 'manifest.json')
  );
  console.log('  ✓ manifest.json');

  // Copy background.js
  fs.copySync(
    path.join(SRC_DIR, 'background.js'),
    path.join(DIST_DIR, 'background.js')
  );
  console.log('  ✓ background.js');

  // Copy icons
  if (fs.existsSync(path.join(SRC_DIR, 'public', 'icons'))) {
    fs.copySync(
      path.join(SRC_DIR, 'public', 'icons'),
      path.join(DIST_DIR, 'icons')
    );
    console.log('  ✓ icons');
  }
  console.log('\n✅ Extension bundled successfully!\n');
  console.log('📁 Extension directory: dist/extension\n');
  console.log('🚀 Next steps:');
  console.log('  1. Open Chrome and go to chrome://extensions/');
  console.log('  2. Enable "Developer mode" (top right)');
  console.log('  3. Click "Load unpacked"');
  console.log('  4. Select the dist/extension folder\n');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

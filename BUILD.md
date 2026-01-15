# TruthSeek Build Instructions

## Why We Need a Build Step

Chrome extensions **do not support ES6 modules in content scripts**, even with Manifest V3. Content scripts run in the context of web pages and cannot use `import` statements.

To solve this, we use Rollup to bundle the content script and its dependencies into a single file.

## Setup

1. Install dependencies:
```bash
npm install
```

## Building

### One-time build:
```bash
npm run build
```

This creates `dist/content.js` which is loaded by the extension.

### Watch mode (auto-rebuild on changes):
```bash
npm run build:watch
```

Leave this running while developing. It will automatically rebuild when you save changes.

## Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `TruthSeekV2` folder

## Development Workflow

1. Start watch mode: `npm run build:watch`
2. Make changes to source files in `src/`
3. Rollup automatically rebuilds `dist/content.js`
4. Reload the extension in Chrome (`chrome://extensions/` → reload button)
5. Refresh the webpage to test

## What Gets Bundled

- `src/content/content.js` → `dist/content.js` (bundled with all dependencies)
- Background service worker uses native ES modules (no bundling needed)
- Popup scripts are loaded via HTML `<script type="module">` (no bundling needed)

## Files

- `rollup.config.js` - Rollup configuration
- `dist/` - Build output (gitignored)
- `src/` - Source code


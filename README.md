# TruthSeek

AI-powered fact verification for any webpage.

## Overview

TruthSeek is a browser extension that enables users to verify the factual accuracy of any HTML webpage using one or more AI models of their choosing. The extension extracts verifiable facts, performs live web searches to verify each fact, and displays results through real-time page highlighting and interactive modals.

## Features

- **Multi-AI Support**: Use OpenAI, Anthropic (Claude), or Google (Gemini) models
- **Live Web Search**: Verification based on current, real web sources
- **Real-Time Highlighting**: See fact-checking progress as it happens
- **Confidence Scoring**: Understand certainty levels with evidence-based scoring
- **Source Credibility**: Automatic tiering of sources by category and domain
- **Zero Developer Cost**: Users provide their own AI credentials

## Installation (Development)

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in top-right)
6. Click "Load unpacked"
7. Select the `TruthSeekV2` directory

## Setup

### Getting API Keys

You'll need an API key from at least one provider:

- **OpenAI**: Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: Get your API key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **Google (Gemini)**: Get your API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Adding an AI Agent

1. Click the TruthSeek extension icon
2. Click "Add AI Agent"
3. Choose a provider (OpenAI, Anthropic, or Google)
4. Enter your API key (stored encrypted locally)
5. Select a model
6. Click "Run Fact Check" on any webpage

## Development

### Building

```bash
# One-time build
npm run build

# Watch mode (auto-rebuild on changes)
npm run build:watch
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Security

- API keys are encrypted using Web Crypto API before storage
- No telemetry or data sent to TruthSeek servers
- Content Security Policy prevents XSS attacks
- Minimal permissions requested

## Architecture

TruthSeek operates as a three-tier browser extension:

1. **Popup UI**: User controls and agent management
2. **Background Service Worker**: Orchestration and AI coordination
3. **Content Scripts**: Page interaction and result display

## License

MIT License with Commons Clause and Attribution Requirements

- Free for personal and non-commercial use
- Attribution required in derivative works
- Commercial use requires separate license

Contact: runtimeforgellc@gmail.com

## Development Status

**Current Sprint**: Sprint 1 - Foundation & AI Integration

**Completed Stories**:
- ✅ Story 1.1: Extension Manifest & Structure

**In Progress**:
- Story 1.2: Inter-Component Messaging System

## Contributing

This is a greenfield project currently under active development. Contributions will be welcomed after MVP completion.

## Support

If you find TruthSeek valuable, consider supporting development:
- [Ko-fi](https://ko-fi.com/truthseek)

## Roadmap

- [x] Sprint 1: Foundation & AI Integration (Weeks 1-2)
- [ ] Sprint 2: Fact Extraction Pipeline (Weeks 3-4)
- [ ] Sprint 3: Verification Engine (Weeks 5-6)
- [ ] Sprint 4: UI Completion & Polish (Weeks 7-8)

---

**Runtime Forge LLC** © 2025


# Tech Stack Reference

> Auto-generated tech stack analysis for AI agent context.
> Last analyzed: 2026-01-12

## Quick Reference
**Stack:** Vanilla JavaScript ES Modules | Chrome Extension MV3 | Native Web APIs

## Frontend
| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | None (Vanilla JS) | - | Pure JavaScript with ES Modules |
| Language | JavaScript | ES2022+ | ES6+ modules, async/await |
| UI Library | None | - | DOM manipulation only |
| Styling | CSS | 3 | Multiple component-level CSS files |
| State Management | Chrome Storage API | MV3 | Local storage for agents/state |
| Build Tool | Rollup | 4.9.0 | Content script bundling only |

## Backend
| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Runtime | Chrome Extension | MV3 | Service worker architecture |
| Language | JavaScript | ES2022+ | Native ES modules in background |
| API Style | REST (external) | - | Calls OpenAI, Anthropic, Google APIs |
| Auth | Web Crypto API | - | API key encryption with AES-GCM |
| Messaging | Chrome Extension API | MV3 | chrome.runtime.sendMessage |

## Data Layer
| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Primary DB | Chrome Storage | Local | chrome.storage.local API |
| Encryption | Web Crypto API | - | AES-GCM 256-bit for API keys |
| Cache | None | - | Runtime state only |

## Infrastructure
| Category | Technology | Notes |
|----------|-----------|-------|
| Hosting | Browser Local | Chrome Web Store ready |
| CI/CD | None | Manual build/deploy workflow |
| Containerization | None | - |

## External Services
| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| OpenAI API | Fact extraction & verification | REST API (fetch) |
| Anthropic API | Fact extraction & verification | REST API (fetch) |
| Google Gemini API | Fact extraction & verification | REST API (fetch) |
| Web Search APIs | Live fact verification | Via AI model tool calling |

## Development Environment
| Tool | Config File | Key Settings |
|------|-------------|--------------|
| Node.js | - | v22.18.0 (ES modules support) |
| npm | package.json | Scripts: build, test, watch |
| Rollup | rollup.config.js | IIFE bundle for content scripts |
| Jest | jest.config.js | jsdom, ES modules experimental |

## Project Structure
```
TruthSeekV2/
├── src/
│   ├── ai/
│   │   ├── providers/        # OpenAI, Anthropic, Google adapters
│   │   ├── prompts/          # Extraction & verification prompts
│   │   ├── provider-interface.js
│   │   └── types.js
│   ├── background/
│   │   ├── service-worker.js # Entry point (ES module)
│   │   ├── orchestrator.js   # Main workflow coordinator
│   │   ├── extraction-orchestrator.js
│   │   ├── verification-orchestrator.js
│   │   ├── messaging.js      # Message routing
│   │   ├── confidence-scoring.js
│   │   ├── consensus.js      # Multi-agent consensus
│   │   ├── source-tiering.js # Source credibility
│   │   └── [other modules]
│   ├── content/
│   │   ├── content.js        # Entry (bundled to dist/)
│   │   ├── highlighter.js    # Page highlighting
│   │   ├── modal.js          # Results UI
│   │   └── progress-popup.js # Progress display
│   ├── popup/
│   │   ├── popup.html        # Extension popup UI
│   │   ├── popup.js          # ES module (not bundled)
│   │   └── agent-manager.js  # Agent CRUD operations
│   ├── config/               # Model metadata, source tiers
│   ├── shared/               # Message types/utils
│   └── utils/                # Crypto, URL resolver
├── dist/
│   └── content.js            # Rollup output (IIFE)
├── tests/
│   ├── extraction.test.js
│   └── setup.js
├── icons/                    # Extension icons (16/48/128)
├── manifest.json             # Chrome Extension MV3
├── package.json
├── rollup.config.js
├── jest.config.js
└── README.md
```

## Key Patterns & Conventions
- **ES Module Architecture**: Background and popup use native ES modules; content script bundled to IIFE via Rollup
- **Messaging Pattern**: Central message router in background/messaging.js with type-safe handlers
- **Provider Abstraction**: Unified AIProvider interface for multiple LLM providers
- **Multi-Agent Consensus**: Supports multiple AI agents for cross-verification and consensus scoring
- **Zero External Storage**: All data (API keys, agents, state) stored locally in browser
- **Web Crypto Security**: API keys encrypted with AES-GCM before storage
- **Source Tiering**: Automatic credibility scoring based on domain categories

## Agent Development Notes
- **Entry Points**:
  - Background: `src/background/service-worker.js`
  - Content: `src/content/content.js` → bundled to `dist/content.js`
  - Popup: `src/popup/popup.html` + `src/popup/popup.js`
- **Config Location**: `src/config/` (model-metadata, source-tiers, categories)
- **Environment Variables**: None (API keys provided by users via UI)
- **Build Commands**:
  - `npm run build` (one-time Rollup build)
  - `npm run build:watch` (auto-rebuild on changes)
  - `npm test` (Jest with experimental ES modules)
  - `npm run test:coverage` (coverage report)
- **Known Constraints**:
  - Node.js 20+ required for ES module support
  - Chrome Extension MV3 only (no Firefox/Safari yet)
  - Content scripts cannot use ES modules (hence Rollup bundling)
  - Must run `npm run build` before loading extension
  - Jest requires `--experimental-vm-modules` flag for ES module testing
- **Chrome Extension Specifics**:
  - Uses Manifest V3 (service_worker, not background page)
  - Permissions: activeTab, storage, scripting, host_permissions: <all_urls>
  - CSP: script-src 'self' only (no inline scripts)
- **AI Provider Integration**:
  - No official SDKs used (direct fetch API calls)
  - Rate limiting: 1 second delay between requests
  - Timeout: 60 seconds per API call
  - Token usage tracking per provider
- **Testing Stack**:
  - Jest 29.7.0 with jsdom environment
  - Coverage thresholds: 70% (branches, functions, lines, statements)
  - Test files: `tests/**/*.test.js`
  - Setup file: `tests/setup.js`

## Architecture Highlights
- **Service Worker Orchestration**: Background service worker coordinates all AI operations
- **Content Script Isolation**: Content scripts communicate via Chrome messaging API
- **Stateless Design**: All state persisted to chrome.storage.local (survives service worker restarts)
- **Provider Agnostic**: Supports OpenAI, Anthropic (Claude), Google (Gemini) with same interface
- **Real-Time UI Updates**: Progress updates streamed from background to content scripts
- **Multi-Stage Pipeline**:
  1. Extraction (AI extracts facts from page)
  2. Verification (AI verifies each fact via web search)
  3. Consensus (Multi-agent voting if multiple agents configured)
  4. Scoring (Confidence + source credibility)
  5. Display (Highlighting + modal UI)

## Development Workflow
1. Make changes in `src/`
2. Run `npm run build:watch` (or one-time `npm run build`)
3. Reload extension in `chrome://extensions/`
4. Refresh target webpage to test content scripts
5. Run `npm test` before committing

## Security Considerations
- API keys encrypted with Web Crypto API (AES-GCM-256)
- No telemetry or external data transmission (except to user-configured AI APIs)
- Content Security Policy prevents XSS
- Minimal permissions (no cookies, history, or tabs access beyond activeTab)
- Open source (MIT + Commons Clause license)

# TruthSeek V2 - AI Agent Context Summary

> **Purpose:** This document provides essential context for AI agents working on this codebase. It prioritizes accuracy, completeness, and identification of known issues to prevent bugs, regressions, and code bloat.
>
> **Last Updated:** 2026-01-16

---

## Project Identity

**TruthSeek V2** is a Chrome browser extension (Manifest V3) that performs AI-powered fact verification on web pages. Users configure one or more AI agents (OpenAI, Anthropic, Google Gemini) with their own API keys. The extension extracts verifiable factual claims from page content, performs live web searches for verification, and displays results through real-time sentence highlighting.

**Business Model:** Zero developer cost - users supply their own AI credentials.

**License:** MIT with Commons Clause (non-commercial free; commercial requires license).

**Owner:** Runtime Forge LLC

---

## Architecture Overview

### Three-Tier Design

```
+------------------+     +------------------------+     +------------------+
|    Popup UI      |<--->|   Background Worker    |<--->|  Content Script  |
| (src/popup/)     |     | (src/background/)      |     | (src/content/)   |
+------------------+     +------------------------+     +------------------+
       |                          |                            |
 Agent config          Orchestration, AI calls           DOM manipulation
 User controls         Multi-agent consensus           Page highlighting
 Status display        State management                Modal display
```

### Communication Pattern

All components communicate via `chrome.runtime.sendMessage()` using typed messages:

```javascript
{
  type: MessageType.CONSTANT_NAME,  // from src/shared/message-types.js
  payload: { ... }
}
```

**Message flow:** Popup/Content -> Background (requests), Background -> Content (updates)

---

## Directory Structure (Critical Files)

```
src/
  ai/
    provider-interface.js    # Abstract base class for AI providers (REQUIRED CONTRACT)
    providers/
      openai.js              # OpenAI GPT implementation
      anthropic.js           # Anthropic Claude implementation
      google.js              # Google Gemini implementation
    prompts/
      extraction.js          # Fact extraction prompts + adaptive prompt selection + JSON parsing
      verification.js        # Verification prompts with grounding rules

  background/
    service-worker.js        # Extension entry point, message routing
    orchestrator.js          # Main 8-step workflow (START HERE for flow understanding)
    extraction-orchestrator.js  # Parallel fact extraction coordinator
    verification-orchestrator.js # Parallel verification with batching
    deduplication.js         # Exact + semantic duplicate removal
    consensus.js             # Multi-agent voting algorithm
    fact-validator.js        # Fact structure and category validation
    categorization.js        # Category validation and correction
    messaging.js             # Message routing and handler registration

  content/
    content.js               # Content script entry (BUNDLED to dist/content.js)
    extractor.js             # Page content extraction with XPath tracking
    highlighter.js           # Real-time sentence highlighting
    modal.js                 # Fact detail popup (uses dom-utils for security)
    progress-popup.js        # Progress display during fact-check
    dom-utils.js             # Shared DOM utilities (escapeHtml, sanitizeUrl, clampPercent)

  popup/
    popup.js                 # Popup UI logic
    agent-manager.js         # Agent add/remove/configure

  config/
    categories.js            # 9 fact categories (VALID_CATEGORIES array)
    model-metadata.js        # Model knowledge cutoffs, quality ranks
    source-tiers.js          # Domain credibility classifications

  shared/
    message-types.js         # MessageType enum (ALL message types)
```

**Build Output:** `dist/content.js` - Rollup bundles content script (Chrome limitation: no ES modules in content scripts)

---

## Core Workflow (8 Steps)

The `orchestrator.js:start(tabId)` function executes this pipeline:

1. **Extract Page Content** - Content script extracts sentences with XPath and deterministic page metadata
2. **Extract Facts (Parallel)** - All agents extract facts simultaneously (60s timeout)
3. **Deduplicate** - Remove exact/semantic duplicates using agent quality ranking
4. **Validate Categories** - Ensure categories match taxonomy, correct if needed
5. **Validate Facts** - Filter invalid, too short, XSS attempts, non-verifiable claims
6. **Highlight Sentences** - Mark extracted sentences yellow (processing)
7. **Verify Facts (Parallel)** - All agents verify each fact via web search (90s timeout, batched 5 at a time) using page metadata as context
8. **Aggregate & Display** - Majority voting, update highlight colors, show summary

**Cancellation:** Supported at any step via `cancellationRequested` flag.

---

## AI Provider Contract

All providers must extend `AIProvider` and implement:

```javascript
class CustomProvider extends AIProvider {
  async extractFacts(htmlContent, categories)       // Returns ExtractionResult
  async verifyFactWithWebSearch(fact, category)     // Returns VerificationResult
  async isAuthenticated()                           // Returns boolean
  getProviderInfo()                                 // Returns ProviderInfo
  getModelQualityRank()                             // Returns number (higher = better)
}
```

**Error Handling:** Use `AIProviderException` with codes from `AIProviderError` enum.

**API Key Storage:** Encrypted with AES-GCM via `src/utils/crypto.js`.

---

## Data Types Reference

### Sentence (from extractor)
```javascript
{
  id: 's-0001',           // Sequential ID
  text: 'sentence text',  // Sanitized content
  xpath: '//div[1]/p[2]', // DOM location
  elementTag: 'p'         // Parent element type
}
```

### PageMetadata (from extractor)
```javascript
{
  title: 'Article headline',
  description: 'Meta description',
  canonicalUrl: 'https://example.com/article',
  siteName: 'Publisher name',
  publishedTime: '2025-10-30T22:03:51',
  modifiedTime: '2025-10-30T22:42:00',
  author: 'Author name',
  section: 'Section name',
  keywords: 'comma,separated,keywords',
  language: 'en'
}
```

### Fact (after extraction)
```javascript
{
  id: 'f-0001',
  originalText: 'exact quote from page',
  searchableText: 'rephrased for search',
  category: 'HISTORICAL_EVENT',  // One of 9 VALID_CATEGORIES
  sentenceId: 's-0001',
  agentId: 'openai-gpt4-timestamp',
  provenance: ['agent1', 'agent2'],  // Which agents found this
  agentRank: 95,
  pageMetadata: { /* optional PageMetadata for verification context */ }
}
```

### VerificationResult (per agent)
```javascript
{
  factId: 'f-0001',
  agentId: 'agent-id',
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIED',
  confidence: 0-100,
  confidenceCategory: 'very-low' | 'low' | 'medium' | 'high' | 'very-high',
  reasoning: 'explanation',
  sources: [{ url, title, snippet, tier, isSupporting }],
  knowledgeCutoffMessage: null | 'warning text'
}
```

### AggregatedResult (after consensus)
```javascript
{
  factId: 'f-0001',
  sentenceId: 's-0001',
  aggregateVerdict: 'TRUE' | 'FALSE' | 'UNVERIFIED',
  aggregateConfidence: 0-100,
  aggregateConfidenceCategory: 'low' | 'medium' | 'high',
  agentResults: [...],
  hasDisagreement: boolean,
  disagreementNote: null | 'explanation',
  reasoning: 'combined reasoning',
  sources: [...]
}
```

---

## Fact Categories (9 Total)

From `src/config/categories.js`:

1. `HISTORICAL_EVENT` - Past events with dates
2. `STATISTICAL_QUANTITATIVE` - Numbers, percentages, measurements
3. `DEFINITIONAL_ATTRIBUTE` - Properties, characteristics
4. `SCIENTIFIC_TECHNICAL` - Scientific claims, technical specs
5. `MEDICAL_BIOLOGICAL` - Health, medicine, biology
6. `LEGAL_REGULATORY` - Laws, regulations, legal matters
7. `GEOPOLITICAL_SOCIAL` - Politics, geography, society
8. `ATTRIBUTION_QUOTE` - Who said what
9. `CAUSAL_RELATIONAL` - Cause-effect relationships

---

## Known Issues and Technical Debt

### Critical Issues

1. **Web Search is Simulated (OpenAI Provider)**
   - Location: `src/ai/providers/openai.js`
   - The `performWebSearches()` method uses OpenAI function calling which does NOT actually search the web
   - **Impact:** Verification results may be hallucinated, not grounded in real sources
   - **Fix Required:** Integrate actual search API (Bing, Google Custom Search, etc.)

2. **Sentence Limit Hardcoded to 20**
   - Location: `src/content/extractor.js:109-112`
   - Content extraction limits to first 20 sentences regardless of page length
   - No user configuration option
   - **Impact:** Long articles only get partial fact-checking

3. **2-Second Hardcoded Delay**
   - Location: `src/content/extractor.js:22`
   - Waits 2 seconds after page load for dynamic content
   - May be insufficient for SPAs, excessive for static pages

### Moderate Issues

4. **No Rate Limit Handling Across Providers**
   - Only OpenAI has basic rate limiting (1s delay between requests)
   - Anthropic and Google providers may hit rate limits without recovery

5. **Highlight Click Handler Global**
   - Location: `src/content/highlighter.js:28`
   - Uses `true` capture phase for click events on entire document
   - May interfere with page's own click handlers

### Minor Issues

6. **Test Coverage Incomplete**
   - Only `extraction.test.js` exists
   - No tests for: verification, consensus, AI providers, messaging

7. **Console Logging in Production**
   - Extensive `console.log()` throughout codebase
   - No log level configuration or production stripping

### Recently Fixed Issues

- **Deduplication null handling** - Now handles missing `searchableText`/`originalText` gracefully with fallback keys
- **Modal XSS via URLs** - Now uses `sanitizeUrl()` from `dom-utils.js` to block `javascript:` URLs
- **Popup state sync** - Now fetches fresh state from background on open via `GET_STATE` message
- **Extraction prompt efficiency** - Adaptive prompts reduce token usage for large pages (>24 sentences or >6000 chars)

---

## Coding Conventions (Strict Adherence Required)

### File Headers
```javascript
/**
 * TruthSeek [Module Name]
 * [Brief description]
 */
```

### Imports
- Always include `.js` extension
- Order: local (`./`) -> parent (`../`) with blank lines between groups
- Use named exports: `import { foo } from './bar.js'`

### Naming
- Files: `kebab-case.js`
- Variables/Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE` (module-level) or `PascalCase` (frozen objects)

### Style
- Single quotes for strings
- Semicolons required
- No trailing commas
- 2-space indentation
- Async/await only (no `.then()` chains)

### Console Logging
```javascript
console.log('[MODULE_NAME] Description:', data);
console.error('[MODULE_NAME] Error description:', error);
```

### Error Handling
```javascript
try {
  const result = await operation();
  return result;
} catch (error) {
  console.error('[MODULE] Operation failed:', error);
  throw new Error('Failed to complete operation');
}
```

---

## Build Requirements

### Content Script Changes
```bash
npm run build  # REQUIRED after any change to src/content/
```

### Background/Popup Changes
- No build needed
- Reload extension in Chrome

### Testing
```bash
npm test           # Run tests
npm run test:watch # Watch mode
```

---

## Anti-Patterns to Avoid

1. **No external npm dependencies in src/** - Zero runtime dependencies by design
2. **No TypeScript** - Pure JavaScript with JSDoc documentation
3. **No default exports** except for class definitions
4. **No var keyword** - Use `const`/`let` only
5. **No abbreviations** - Use full words (`message` not `msg`)
6. **No ternary for control flow** - Use `if/else`
7. **No destructuring in function parameters**
8. **No new files without file header comment**
9. **No undocumented exported functions** - JSDoc required

---

## Critical Integration Points

### When Modifying Messaging
- Update `src/shared/message-types.js` with new message types
- Register handlers in BOTH background (`service-worker.js`) and content (`content.js`)
- Content script handlers are registered in `src/content/messaging.js`

### When Modifying AI Providers
- Follow `AIProvider` interface exactly
- Add model metadata to `src/config/model-metadata.js`
- Handle all error cases with `AIProviderException`

### When Modifying Fact Structure
- Update extraction prompt in `src/ai/prompts/extraction.js`
- Update validation in `src/background/fact-validator.js`
- Update deduplication in `src/background/deduplication.js`

### When Modifying Highlighting
- CSS in `src/content/styles.css`
- Logic in `src/content/highlighter.js`
- Must handle XPath failures gracefully with text-based fallback

### When Rendering Dynamic Content in Modal/UI
- ALWAYS use `escapeHtml()` for text content
- ALWAYS use `sanitizeUrl()` for href attributes
- ALWAYS use `clampPercent()` for percentage values in styles
- Import from `src/content/dom-utils.js`

---

## State Management

### Extension State (Background)
```javascript
// src/background/orchestrator.js
let state = {
  status: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'CANCELLED',
  currentStep: string | null,
  totalFacts: number | null,
  processedFacts: number | null,
  results: array | null,
  startedAt: timestamp | null,
  completedAt: timestamp | null,
  currentTabId: number | null
};
```
Persisted to `chrome.storage.local` under key `extensionState`.

### Agent Configuration
Stored in `chrome.storage.local` under key `agents`:
```javascript
[
  {
    id: 'unique-id',
    providerId: 'openai' | 'anthropic' | 'google',
    model: 'gpt-4',
    displayName: 'OpenAI GPT-4',
    modelDisplayName: 'GPT-4 Turbo',
    knowledgeCutoff: 'April 2024',
    encryptedCredential: '...',  // Encrypted API key
    enabled: true | false
  }
]
```

### Verification Results (for Modal)
Stored in `chrome.storage.local` under key `verificationResults`:
```javascript
{
  'f-0001': { /* AggregatedResult */ },
  'f-0002': { /* AggregatedResult */ }
}
```

---

## Performance Considerations

- **Extraction timeout:** 60 seconds per agent
- **Verification timeout:** 90 seconds per fact
- **Batch size:** 5 facts verified simultaneously
- **Content limit:** 100KB max page content
- **Sentence limit:** 20 sentences max (hardcoded)
- **Rate limiting:** 1 second between OpenAI requests

---

## Security Model

1. **API Keys:** Encrypted with AES-GCM before storage
2. **CSP:** `script-src 'self'; object-src 'none'`
3. **XSS Prevention:** Input sanitization via `dom-utils.js` utilities
4. **URL Sanitization:** `sanitizeUrl()` blocks non-http(s) protocols including `javascript:`
5. **Permissions:** `activeTab`, `storage`, `scripting`, `<all_urls>`
6. **No Telemetry:** No data sent to TruthSeek servers

---

## Key Utility Functions

### DOM Utilities (`src/content/dom-utils.js`)

**IMPORTANT:** Always use these utilities when rendering user-controlled or AI-generated content in the modal or any HTML context.

```javascript
import { escapeHtml, sanitizeUrl, clampPercent } from './dom-utils.js';

// Escape HTML entities to prevent XSS
escapeHtml(text)              // Returns safe string, handles null/undefined

// Sanitize URLs for href attributes - blocks javascript: and other dangerous protocols
sanitizeUrl(url)              // Returns safe URL or '#' if invalid

// Clamp numeric values to 0-100 for percentage display
clampPercent(value)           // Returns rounded integer 0-100, handles NaN/Infinity
```

### Extraction Prompt Utilities (`src/ai/prompts/extraction.js`)

```javascript
import {
  buildExtractionPrompt,           // Full prompt with examples
  buildAdaptiveExtractionPrompt,   // Auto-selects full or simplified based on content size
  buildSimplifiedExtractionPrompt, // Minimal prompt for large pages
  parseExtractionResponse,         // Parses AI response with error recovery
  cleanJsonResponse                // Strips markdown code blocks from response
} from '../ai/prompts/extraction.js';

// Adaptive prompt selection thresholds:
// - MAX_FULL_PROMPT_SENTENCES: 24
// - MAX_FULL_PROMPT_CHARACTERS: 6000
// Pages exceeding these use simplified prompts to reduce token costs
```

### Deduplication (`src/background/deduplication.js`)

```javascript
import { deduplicate, getDeduplicationStats } from './deduplication.js';

// Facts with missing text fields are handled gracefully:
// - Falls back to originalText if searchableText is missing
// - Uses unique key `missing-text-{index}` if both are missing
// - Never crashes on null/undefined text values
```

---

## Quick Reference: Adding a New Feature

1. Identify which tier(s) the feature affects (popup/background/content)
2. Define message types if cross-component communication needed
3. Follow existing patterns in similar modules
4. Add JSDoc to all exported functions
5. Run `npm run build` if content script modified
6. Test manually in Chrome (no comprehensive test suite yet)
7. Update this document if architectural patterns change

---

## Quick Reference: Debugging

1. **Background errors:** Check Service Worker console in `chrome://extensions/`
2. **Content script errors:** Check page console (F12)
3. **Popup errors:** Right-click popup -> Inspect
4. **Message passing:** Log in both sender and receiver
5. **State issues:** Check `chrome.storage.local` in DevTools Application tab

---

*This document should be updated when significant architectural changes occur.*

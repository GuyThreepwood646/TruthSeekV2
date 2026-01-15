# Coding Standards Reference

> Auto-generated coding standards for AI agent context.
> Last analyzed: 2026-01-12
> Source: Extracted from project configuration and codebase patterns.

**Note:** No explicit linting/formatting configuration files found. All standards are inferred from existing codebase patterns.

---

## Global Standards

### Editor Configuration
| Setting | Value |
|---------|-------|
| Indent Style | spaces (inferred) |
| Indent Size | 2 |
| Line Endings | lf (likely) |
| Final Newline | yes |
| Trim Trailing Whitespace | yes |
| Max Line Length | ~100 (not enforced) |

### General Principles
- **Consistency over convention:** Match existing patterns exactly—this codebase has strong internal consistency
- **Explicit over implicit:** Clear, verbose naming preferred over abbreviations
- **Documentation-first:** JSDoc comments on all exported functions, classes, and complex logic
- **Zero external dependencies:** Pure JavaScript with browser/Chrome Extension APIs only
- **Error context:** Always include context in error messages and console logs

---

## JavaScript (ES2022+): Standards

### Tooling
| Tool | Config File | Extends/Preset |
|------|-------------|----------------|
| Formatter | None | (inferred from codebase) |
| Linter | None | (inferred from codebase) |
| Type Checker | None | JSDoc for documentation only |
| Test Framework | Jest | jest.config.js (jsdom, ES modules) |

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case.js | `service-worker.js`, `message-types.js` |
| Variables | camelCase | `extensionState`, `agentList`, `tabId` |
| Functions | camelCase | `extractPageContent`, `handleAddAgent` |
| Classes | PascalCase | `AIProvider`, `OpenAIProvider`, `AIProviderException` |
| Constants (module-level) | SCREAMING_SNAKE_CASE | `ENCRYPTION_ALGORITHM`, `API_BASE`, `DEFAULT_TIMEOUT` |
| Constants (frozen objects) | PascalCase | `MessageType`, `AIProviderError` |
| Private helpers | camelCase (not prefixed) | `arrayBufferToBase64`, `getOrGenerateKey` |
| Async functions | No special prefix | `async function loadState()` |

### Code Style

**Example demonstrating project style:**
```javascript
/**
 * TruthSeek Main Orchestrator
 * Coordinates the complete fact-checking workflow
 */

import { sendToTab, broadcast } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { extractFromAllAgents } from './extraction-orchestrator.js';

// Module-level state
let state = {
  status: 'IDLE',
  currentStep: null,
  totalFacts: null,
  processedFacts: null
};

/**
 * Start fact-checking workflow
 * @param {number} tabId - Tab ID to fact-check
 * @returns {Promise<void>}
 */
export async function start(tabId) {
  try {
    console.log('[TruthSeek] Starting fact-check workflow for tab:', tabId);

    // Reset state
    state = {
      status: 'RUNNING',
      currentStep: 'Starting...',
      startedAt: Date.now()
    };

    await persistState();
    broadcastState();

    // Continue workflow...
  } catch (error) {
    console.error('Error starting fact-check:', error);
    throw new Error('Failed to start fact-checking workflow');
  }
}

/**
 * Common error codes for AI provider operations
 */
export const AIProviderError = {
  AUTH_FAILED: 'AUTH_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

Object.freeze(AIProviderError);
```

### Formatting Rules

**Quotes:** Single quotes for strings
```javascript
import { foo } from './module.js';  // ✓
const message = 'Hello world';      // ✓
```

**Semicolons:** Required at statement ends
```javascript
const x = 5;                         // ✓
import { foo } from './bar.js';     // ✓
```

**Trailing Commas:** Not used (omitted in multiline objects/arrays)
```javascript
const obj = {
  foo: 1,
  bar: 2    // ✓ No trailing comma
};
```

**Spacing:**
- Space after keywords: `if (condition)`, `function foo()`
- No space before function parens: `function foo()` not `function foo ()`
- Space around operators: `x = y + 5`
- No space inside brackets/parens: `foo(bar)` not `foo( bar )`

**Bracket Style:** Opening brace on same line
```javascript
function foo() {        // ✓
  return bar;
}

if (condition) {        // ✓
  doSomething();
}
```

### Import Organization

**Order:** Grouped with blank lines between groups
1. External modules (if any—none in this project currently)
2. Internal absolute imports from parent directories (`../shared`, `../config`)
3. Relative imports from current directory (`./`)

**Style:**
```javascript
// Group 1: Sibling/local utilities
import { initialize, registerHandler } from './messaging.js';

// Group 2: Shared/parent modules
import { MessageType } from '../shared/message-types.js';

// Group 3: Further parent modules
import { extractFromAllAgents } from './extraction-orchestrator.js';
import { deduplicate } from './deduplication.js';
import { validateFacts } from './fact-validator.js';
```

**Import patterns:**
- Always use `.js` extension in imports (ES modules requirement)
- Named imports preferred: `import { foo } from './bar.js'`
- Default exports rare (only for classes)
- No default + named export mixing

### Type Annotations

**Coverage:** JSDoc comments on exported functions only (not enforced on internals)

**Style:** Lightweight JSDoc without full type definitions
```javascript
/**
 * Extract facts from HTML content
 * @param {string} htmlContent - Page content with sentences
 * @param {string[]} categories - Array of valid fact categories
 * @returns {Promise<ExtractionResult>} Extracted facts with metadata
 */
async function extractFacts(htmlContent, categories) {
  // implementation
}
```

**Type patterns:**
- Use `@param` for parameters with basic types
- Use `@returns` for return values
- Use `@abstract` for interface methods
- Use custom type names without full definitions: `Promise<ExtractionResult>`
- Primitives: `string`, `number`, `boolean`, `object`, `Array`
- No `@typedef` or complex type definitions

### Error Handling

**Pattern:** Try-catch with context, explicit error messages

```javascript
// ✓ Standard error handling pattern
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error('Error performing operation:', error);
  throw new Error('Failed to complete operation');
}

// ✓ Validation errors
if (!apiKey || typeof apiKey !== 'string') {
  throw new AIProviderException(
    AIProviderError.INVALID_CREDENTIALS,
    'API key must be a non-empty string'
  );
}
```

**Custom errors:**
```javascript
export class AIProviderException extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AIProviderException';
    this.code = code;
    this.details = details;
  }
}
```

### Console Logging

**Consistent prefix pattern:**
```javascript
console.log('[TruthSeek] Starting workflow');
console.log('[GET_FACT_DETAILS] Looking up facts for sentence:', sentenceId);
console.error('[HIGHLIGHT] Invalid payload:', payload);
```

**Log levels:**
- `console.log()` for info/progress
- `console.warn()` for warnings/unexpected conditions
- `console.error()` for errors

### Async/Await Patterns

**Preferred:** Always use async/await (no raw Promises or callbacks)
```javascript
// ✓ Async/await
async function loadState() {
  const result = await chrome.storage.local.get(['agents']);
  return result.agents || [];
}

// ✓ Wrapped callbacks (Chrome API compatibility)
async function saveAgents() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ agents }, resolve);
  });
}
```

### Documentation Standards

**File headers:** Required on all files
```javascript
/**
 * TruthSeek [Module Name]
 * [Brief description of module purpose]
 */
```

**Function documentation:** Required on all exported functions
```javascript
/**
 * Brief description of what function does
 * @param {type} paramName - Parameter description
 * @returns {type} Return value description
 */
```

**Inline comments:** Use for complex logic or non-obvious behavior
```javascript
// Initialize default storage
chrome.storage.local.get(['agents', 'state'], (result) => {
  if (!result.agents) {
    chrome.storage.local.set({ agents: [] });
  }
});
```

### Testing Conventions

**Framework:** Jest 29.7.0 with jsdom environment

**File Pattern:** `tests/*.test.js` (separate `tests/` directory)

**Naming:** `describe` blocks for modules, `test` (not `it`) for cases
```javascript
describe('HTML Content Extraction', () => {

  test('should extract visible text from HTML', () => {
    document.body.innerHTML = `<p>Test content</p>`;

    const result = extractPageContent();

    expect(result.sentences).toBeDefined();
    expect(result.sentences.length).toBeGreaterThan(0);
  });

  test('should segment text into sentences', () => {
    // Arrange
    document.body.innerHTML = `<p>First. Second. Third.</p>`;

    // Act
    const result = extractPageContent();

    // Assert
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);
  });
});
```

**Test structure:** AAA pattern (Arrange-Act-Assert) implied, comments optional

**Mocks:** Global mocks at top of file
```javascript
// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};
```

### Anti-Patterns to Avoid

- ❌ No TypeScript (this is a pure JavaScript project)
- ❌ No external dependencies (no npm packages imported in src/)
- ❌ No default exports except for class definitions
- ❌ No var keyword (use const/let only)
- ❌ No abbreviations in names (e.g., `msg` → use `message`)
- ❌ No inline function definitions in complex expressions
- ❌ No ternary operator for control flow (use if/else)
- ❌ No object destructuring in function parameters (use explicit params)

---

## CSS: Standards

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Classes | kebab-case | `.truthseek-highlight`, `.agent-item` |
| IDs | kebab-case | `#add-agent-btn`, `#status-message` |
| Custom Properties | kebab-case | (none in use) |

### Code Style

**Formatting:**
```css
/* Rule structure */
.selector {
  property: value;
  another-property: value;
}

/* Multi-selector (one per line) */
.selector-one,
.selector-two {
  property: value;
}
```

**Spacing:**
- 2 space indent
- Space after colon: `color: red;` not `color:red;`
- No space before opening brace on same line
- Closing brace on new line

**Property order:** Logical grouping (not alphabetical)
1. Positioning: `position`, `top`, `left`, `z-index`
2. Display & Box Model: `display`, `width`, `height`, `padding`, `margin`
3. Visual: `background`, `border`, `box-shadow`
4. Typography: `font-*`, `color`, `text-*`, `line-height`
5. Misc: `cursor`, `transition`, `animation`

**Example:**
```css
.truthseek-highlight {
  position: relative;
  display: inline;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 2px 4px;
  margin: 0 -2px;
  border-radius: 3px;

  /* Inherit text properties */
  line-height: inherit;
  font-size: inherit;
  font-family: inherit;
}
```

**Colors:** RGBA for transparency, hex for opaque
```css
.example {
  background-color: rgba(40, 167, 69, 0.18);  /* ✓ */
  color: #333;                                 /* ✓ */
}
```

**Units:** Pixels for precise sizing, percentages for relative
- Spacing: `px`
- Font size: `px`
- Widths: `px` or `%`
- Borders: `px`

**Comments:**
```css
/* Section comment */
.selector { }

/* Inline explanatory comment */
line-height: inherit;  /* Avoid breaking layout */
```

---

## HTML: Standards

### Structure Patterns

**Standard document structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TruthSeek</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <!-- Content -->
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
```

**Module scripts:** Always use `type="module"` for ES module support
```html
<script type="module" src="popup.js"></script>  <!-- ✓ -->
```

**Semantic HTML:** Use semantic elements where applicable
```html
<header class="popup-header">
  <h1>TruthSeek</h1>
</header>

<section class="agents-section">
  <h2>AI Agents</h2>
</section>

<footer class="donation-section">
  <a href="#">Support this project</a>
</footer>
```

**Class naming:** BEM-lite (no strict BEM, but component-prefixed)
```html
<div class="agent-item">
  <div class="agent-checkbox-container">
    <input type="checkbox" class="agent-checkbox">
  </div>
  <div class="agent-info">
    <div class="agent-name">OpenAI GPT-4</div>
    <div class="agent-model">gpt-4-turbo</div>
  </div>
</div>
```

---

## File Organization

### Directory Structure
```
src/
├── ai/               # AI provider adapters and prompts
│   ├── providers/    # OpenAI, Anthropic, Google implementations
│   ├── prompts/      # Extraction and verification prompts
│   └── [interfaces]  # provider-interface.js, types.js
├── background/       # Service worker orchestration
│   ├── service-worker.js      # Entry point
│   ├── orchestrator.js        # Main workflow
│   ├── *-orchestrator.js      # Phase-specific orchestrators
│   ├── messaging.js           # Message routing
│   └── [utilities]            # scoring, consensus, validation
├── content/          # Content scripts (bundled)
│   ├── content.js    # Entry point (bundled to dist/)
│   ├── [modules].js  # extractor, highlighter, modal, etc.
│   └── *.css         # Component styles
├── popup/            # Extension popup UI
│   ├── popup.html    # UI structure
│   ├── popup.js      # Main logic
│   ├── popup.css     # Styles
│   └── [modules].js  # agent-manager, messaging
├── config/           # Configuration data
│   └── *.js          # categories, model-metadata, source-tiers
├── shared/           # Cross-context utilities
│   └── message-*.js  # Message types and utilities
└── utils/            # Generic utilities
    └── *.js          # crypto, url-resolver
```

### Module Organization Pattern

**Standard file structure:**
```javascript
/**
 * File header with description
 */

// Imports (grouped and ordered)
import { external } from '../external.js';
import { local } from './local.js';

// Module constants
const MODULE_CONSTANT = 'value';

// Module state (if needed)
let moduleState = {};

// Exported functions
export async function publicFunction() {
  // implementation
}

// Internal helpers (not exported)
function privateHelper() {
  // implementation
}

// If initialization needed
console.log('Module initialized');
```

---

## Agent Instructions

### When Generating Code

1. **Match file headers exactly**
   ```javascript
   /**
    * TruthSeek [Module Name]
    * [Brief description]
    */
   ```

2. **Use single quotes and semicolons consistently**
   - Every import must end with `.js` extension
   - Every statement must end with semicolon

3. **Follow import grouping**
   - Local (./), then parent (../), with blank line between groups
   - Destructure imports: `import { foo, bar } from './module.js'`

4. **Document all exports**
   - JSDoc on every exported function
   - Include @param, @returns
   - Keep it concise (one line description + params)

5. **Use async/await exclusively**
   - Wrap Chrome callbacks in Promises
   - No `.then()` chains
   - Always handle errors with try-catch

6. **Follow error patterns**
   - Console prefix: `console.log('[MODULE_NAME] message')`
   - Throw with context: `throw new Error('Failed to X')`
   - Custom errors for specific cases

7. **Respect the zero-dependency rule**
   - Only browser APIs and Chrome Extension APIs
   - No npm packages in src/ code
   - DevDependencies (Rollup, Jest) are fine

8. **Test file conventions**
   - Use `describe` and `test` (not `it`)
   - Mock Chrome APIs at file top
   - AAA pattern in tests

9. **CSS conventions**
   - Kebab-case classes
   - 2-space indent
   - Logical property grouping (not alphabetical)
   - RGBA for transparency

10. **HTML conventions**
    - `type="module"` on script tags
    - Semantic elements where appropriate
    - Component-prefixed class names

### Known Exceptions

**None currently** - The codebase is highly consistent. If you encounter conflicting patterns, prefer the pattern used in the most recently modified files.

### Ambiguities & Inconsistencies

**Inferred Standards:**
- All naming and formatting conventions are inferred from codebase (no ESLint/Prettier config exists)
- Some older files may have minor inconsistencies in comment density—prefer more documentation for complex logic

**Potential Future Changes:**
- Project may benefit from adding ESLint + Prettier in future for enforcement
- TypeScript migration possible (JSDoc provides partial typing foundation)
- Current test coverage is minimal (only extraction tests exist)

---

## Chrome Extension Specifics

### Manifest V3 Patterns

**Service Worker:**
- Must be at `src/background/service-worker.js` (manifest reference)
- Uses native ES modules (`type: "module"` in manifest)
- No bundling required

**Content Scripts:**
- Entry: `src/content/content.js` (bundled to `dist/content.js`)
- **Must** be bundled via Rollup (Chrome limitation: no ES modules in content)
- CSS loaded directly (not bundled)

**Popup:**
- HTML/CSS/JS loaded directly (no bundling)
- Script tag uses `type="module"`

### Messaging Pattern

**Message structure:**
```javascript
{
  type: MessageType.CONSTANT_NAME,
  payload: { data }
}
```

**Handler registration:**
```javascript
registerHandler(MessageType.ACTION, async (payload, sender) => {
  // Handle message
  return { result };
});
```

**Sending messages:**
```javascript
const response = await sendToBackground(MessageType.ACTION, { data });
```

---

## Build & Development Workflow

### Before Committing

1. Run `npm run build` to ensure content script bundles successfully
2. Run `npm test` to verify tests pass (if applicable)
3. Verify Chrome extension loads without errors
4. Check console for any errors or warnings

### File Modifications

- **Content scripts:** Must rebuild after changes (`npm run build`)
- **Background/popup:** Reload extension in Chrome (no rebuild needed)
- **CSS:** Refresh page after Chrome extension reload

### Adding New Files

**New module checklist:**
1. Add file header comment with description
2. Use appropriate naming: kebab-case.js
3. Export functions with JSDoc
4. Import with `.js` extension
5. Follow import grouping rules
6. Add to appropriate directory (see structure above)

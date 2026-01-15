## A. Executive Summary

### High-Level Interpretation of User Requirements

The user requires a **browser extension** that enables end-users to verify the factual accuracy of any HTML webpage using one or more AI models of their choosing. The extension must:

1. Allow users to configure multiple AI agents (Gemini, OpenAI, Anthropic) using their own credentials (OAuth where available, secure API key entry otherwise)
2. Extract all verifiable facts from a webpage, categorize them, and track their DOM location
3. Deduplicate facts across multiple AI extractions, using model quality/recency to tiebreak semantic overlaps
4. Verify each fact using **live web search** (actual search engine queries returning real URLs) with tiered source credibility
5. Calculate confidence scores based on source quality and corroboration, with strict caps when evidence is insufficient
6. Modify the webpage in real-time to highlight fact-containing sentences with interactive modals showing verification results
7. Display real-time progress with the ability to close/hide results when complete
8. Operate at zero cost to the extension developer (users provide their own AI credentials)
9. Maintain security best practices throughout

### What the System Currently Does
**N/A — Greenfield project.** No existing codebase.

### What Must Be Built
The entire extension must be built from scratch, including:
- Browser extension infrastructure (manifest, content scripts, background scripts, popup UI)
- AI provider abstraction layer with OAuth (Google) and secure API key storage (OpenAI, Anthropic)
- Fact extraction pipeline with categorization and deduplication (model-quality tiebreaking)
- Live web search verification engine with source tiering
- Confidence scoring algorithm with evidence-based caps
- Real-time DOM manipulation for highlighting and modal injection
- Progress tracking with close/hide functionality

---

## B. Findings From Code Analysis

| Finding Type | Description |
|--------------|-------------|
| **Greenfield** | No existing codebase. All components are net-new. |
| **No Regressions** | N/A — nothing to regress. |
| **No Legacy Constraints** | Architecture can be designed optimally for requirements. |
| **No Technical Debt** | Clean slate allows for best-practice patterns from inception. |

---

## C. Epics

### Epic 1: Extension Core Infrastructure
**Description:** Establish the foundational browser extension architecture including manifest configuration, popup UI shell, and core messaging infrastructure between extension components.

**Why It Matters:** Without a properly structured extension foundation, no other features can be built. This epic creates the skeleton upon which all functionality depends.

---

### Epic 2: AI Provider Integration Layer
**Description:** Build an abstraction layer that allows users to authenticate with multiple AI providers (OpenAI, Anthropic, Google) via OAuth (Google) or secure API key entry (OpenAI, Anthropic), and provides a unified interface for making AI requests including live web search.

**Why It Matters:** The extension's core value depends on AI capabilities. Users must be able to use their own AI accounts securely, and the system must support multiple providers seamlessly.

---

### Epic 3: Fact Extraction Engine
**Description:** Implement the pipeline that parses HTML content, sends it to configured AI agents for fact extraction, categorizes facts into predefined categories, deduplicates across agents using model quality/recency ranking, and tracks DOM locations for each fact.

**Why It Matters:** Accurate fact extraction is the foundation of the entire verification process. Poor extraction quality destroys downstream accuracy.

---

### Epic 4: Live Web Search Verification Engine
**Description:** Build the verification system that performs **live web searches** (actual search engine queries) for each fact, validates that returned URLs are real and accessible, evaluates source credibility via tiered rankings, calculates confidence scores, and determines truth/false/unverified status.

**Why It Matters:** This is the core accuracy engine. The user explicitly stated that accuracy is the most critical feature—without reliable verification using real, current web sources, the extension has no value.

---

### Epic 5: Source Tier Management System
**Description:** Create a static system for categorizing sources into credibility tiers based on fact category, with sensible defaults. Not user-configurable.

**Why It Matters:** Source credibility directly impacts confidence scoring and verification accuracy. Different fact categories require different authoritative sources.

---

### Epic 6: Real-Time Page Modification & Modal System
**Description:** Implement real-time DOM manipulation to highlight fact-containing sentences as they are processed, inject interactive modals showing verification results, and handle user interactions including closing/hiding results.

**Why It Matters:** This is the primary user interface for consuming verification results. Real-time updates provide feedback during long operations.

---

### Epic 7: Progress & Results UI
**Description:** Build the progress tracking popup, real-time status updates, final results summary display, and close/hide functionality.

**Why It Matters:** Users need visibility into long-running operations and clear presentation of final results, with the ability to dismiss when done.

---

### Epic 8: Accuracy Assurance & Hallucination Prevention
**Description:** Implement safeguards against AI hallucinations in both fact extraction and verification, including mandatory URL validation, content verification, cross-referencing, grounding requirements, and knowledge cutoff handling with user-friendly messaging.

**Why It Matters:** The user identified accuracy as paramount. Hallucinated facts or URLs would be catastrophic to credibility.

---

## D. User Stories (Per Epic)

---

### Epic 1: Extension Core Infrastructure

#### Story 1.1: Extension Manifest & Structure
```
As a developer,
I want a properly configured browser extension manifest and file structure,
So that the extension can be loaded and run in Chrome/Firefox.
```

**Description:** Create the manifest.json with appropriate permissions, content scripts, background scripts, and popup configuration following security best practices.

**Acceptance Criteria:**
- AC1.1.1: manifest.json declares `manifest_version: 3`
- AC1.1.2: Extension requests only necessary permissions: `activeTab`, `storage`, `identity` (for OAuth)
- AC1.1.3: Content script injects into all HTTP/HTTPS pages
- AC1.1.4: Background service worker handles cross-component messaging
- AC1.1.5: Popup HTML loads when extension icon clicked
- AC1.1.6: Extension loads without errors in Chrome Developer Mode
- AC1.1.7: Content Security Policy (CSP) configured to prevent XSS
- AC1.1.8: No use of `eval()`, `new Function()`, or other dynamic code execution

**Dependencies:** None

**Impacted Components:** `manifest.json`, `/src/background/`, `/src/content/`, `/src/popup/`

---

#### Story 1.2: Inter-Component Messaging System
```
As the extension system,
I want a reliable messaging system between popup, background, and content scripts,
So that components can coordinate during fact-checking operations.
```

**Description:** Implement message passing infrastructure using Chrome runtime messaging APIs.

**Acceptance Criteria:**
- AC1.2.1: Popup can send commands to background script (start, cancel, add agent)
- AC1.2.2: Background script can send status updates to popup
- AC1.2.3: Background script can send DOM modification commands to content script
- AC1.2.4: Content script can send user interactions to background script
- AC1.2.5: Messages include type discriminators for routing
- AC1.2.6: Error handling for disconnected ports
- AC1.2.7: All message payloads sanitized before processing

**Dependencies:** Story 1.1

**Impacted Components:** `/src/background/messaging.js`, `/src/content/messaging.js`, `/src/popup/messaging.js`

---

#### Story 1.3: Extension Popup Shell
```
As a user,
I want a popup interface when I click the extension icon,
So that I can control the fact-checking process.
```

**Description:** Create the popup HTML/CSS/JS shell with placeholders for AI agent management, run controls, and donation link.

**Acceptance Criteria:**
- AC1.3.1: Popup displays when extension icon clicked
- AC1.3.2: Popup contains section for AI agent list (empty state initially)
- AC1.3.3: Popup contains "Add AI Agent" button
- AC1.3.4: Popup contains "Run" button (disabled when no agents configured)
- AC1.3.5: Popup contains "Cancel" button (hidden when not running)
- AC1.3.6: Popup contains donation link styled similarly to Beyond20 (using Ko-fi, PayPal, or GitHub Sponsors)
- AC1.3.7: Popup persists state across open/close cycles via chrome.storage

**Dependencies:** Story 1.1

**Impacted Components:** `/src/popup/popup.html`, `/src/popup/popup.css`, `/src/popup/popup.js`

---

### Epic 2: AI Provider Integration Layer

#### Story 2.1: AI Provider Abstraction Interface
```
As a developer,
I want a unified interface for interacting with different AI providers,
So that the fact extraction and verification logic doesn't depend on specific provider implementations.
```

**Description:** Define a common interface/contract that all AI provider adapters must implement, including live web search capability.

**Acceptance Criteria:**
- AC2.1.1: Interface defines `extractFacts(htmlContent, categories)` method
- AC2.1.2: Interface defines `verifyFactWithWebSearch(fact, category)` method that performs live web search
- AC2.1.3: Interface defines `isAuthenticated()` method
- AC2.1.4: Interface defines `getProviderInfo()` returning display name, model, and knowledge cutoff date
- AC2.1.5: Interface defines `getModelQualityRank()` returning numeric quality/recency score for tiebreaking
- AC2.1.6: All methods return Promises with standardized response shapes
- AC2.1.7: Error responses include provider-specific error codes mapped to common codes

**Dependencies:** None

**Impacted Components:** `/src/ai/provider-interface.js`

---

#### Story 2.2: OpenAI Provider Adapter
```
As a user with an OpenAI account,
I want to securely enter my API key and use OpenAI models for fact-checking,
So that I can leverage GPT models I already have access to.
```

**Description:** Implement the AI provider interface for OpenAI with secure API key storage.

**Acceptance Criteria:**
- AC2.2.1: Adapter implements full provider interface including live web search via function calling
- AC2.2.2: User enters API key via secure input field (masked, never logged)
- AC2.2.3: API key encrypted using Web Crypto API before storage in chrome.storage.local
- AC2.2.4: Clear security warning displayed explaining API key sensitivity
- AC2.2.5: User can select from available models (GPT-4o, GPT-4o-mini, etc.)
- AC2.2.6: Model knowledge cutoff date stored and accessible
- AC2.2.7: Requests include appropriate rate limiting
- AC2.2.8: Token usage is tracked and displayed to user
- AC2.2.9: Authentication persists across browser sessions (encrypted)
- AC2.2.10: User can disconnect/remove API key (secure deletion)
- AC2.2.11: API key displayed masked in UI (only last 4 characters visible)

**Dependencies:** Story 2.1

**Impacted Components:** `/src/ai/providers/openai.js`, `/src/utils/crypto.js`

---

#### Story 2.3: Anthropic Provider Adapter
```
As a user with an Anthropic account,
I want to securely enter my API key and use Claude models for fact-checking,
So that I can leverage Claude models I already have access to.
```

**Description:** Implement the AI provider interface for Anthropic with secure API key storage.

**Acceptance Criteria:**
- AC2.3.1: Adapter implements full provider interface including live web search via tool use
- AC2.3.2: User enters API key via secure input field (masked, never logged)
- AC2.3.3: API key encrypted using Web Crypto API before storage
- AC2.3.4: Clear security warning displayed explaining API key sensitivity
- AC2.3.5: User can select from available models (Claude Sonnet, Claude Opus, etc.)
- AC2.3.6: Model knowledge cutoff date stored and accessible
- AC2.3.7: Requests include appropriate rate limiting
- AC2.3.8: Token usage is tracked and displayed to user
- AC2.3.9: Authentication persists across browser sessions (encrypted)
- AC2.3.10: User can disconnect/remove API key (secure deletion)
- AC2.3.11: API key displayed masked in UI (only last 4 characters visible)

**Dependencies:** Story 2.1

**Impacted Components:** `/src/ai/providers/anthropic.js`, `/src/utils/crypto.js`

---

#### Story 2.4: Google (Gemini) Provider Adapter
```
As a user with a Google account,
I want to authenticate with Google OAuth and use Gemini models for fact-checking,
So that I can leverage Gemini models without exposing API keys.
```

**Description:** Implement the AI provider interface for Google Gemini using OAuth authentication.

**Acceptance Criteria:**
- AC2.4.1: Adapter implements full provider interface including live web search via Google Search integration
- AC2.4.2: User authenticates via Google OAuth flow (chrome.identity API)
- AC2.4.3: OAuth tokens managed securely by Chrome
- AC2.4.4: User can select from available models (Gemini 2.5 Flash, Gemini 2.5 Pro, etc.)
- AC2.4.5: Model knowledge cutoff date stored and accessible
- AC2.4.6: Requests include appropriate rate limiting
- AC2.4.7: Token usage is tracked and displayed to user
- AC2.4.8: Authentication persists across browser sessions
- AC2.4.9: User can disconnect/revoke OAuth access

**Dependencies:** Story 2.1

**Impacted Components:** `/src/ai/providers/google.js`

---

#### Story 2.5: AI Agent Management UI
```
As a user,
I want to add, configure, and remove AI agents from the extension popup,
So that I can choose which AI models perform fact-checking.
```

**Description:** Build the popup UI for managing AI agent configurations.

**Acceptance Criteria:**
- AC2.5.1: "Add AI Agent" button opens provider selection (OpenAI, Anthropic, Google)
- AC2.5.2: Selecting a provider initiates appropriate authentication flow (OAuth for Google, API key entry for others)
- AC2.5.3: After authentication, user can select specific model
- AC2.5.4: Configured agents display in list with provider icon, model name, knowledge cutoff date
- AC2.5.5: Each agent has a "Remove" button
- AC2.5.6: At least one agent must be configured before "Run" is enabled
- AC2.5.7: Agent configurations persist in chrome.storage.local (encrypted where sensitive)

**Dependencies:** Stories 2.2, 2.3, 2.4, 1.3

**Impacted Components:** `/src/popup/agent-manager.js`, `/src/popup/popup.html`

---

### Epic 3: Fact Extraction Engine

#### Story 3.1: HTML Content Extraction
```
As the extension,
I want to extract the meaningful text content from the current page's HTML,
So that I can send it to AI agents for fact extraction.
```

**Description:** Implement content script logic to extract page content while preserving structure needed for DOM location tracking.

**Acceptance Criteria:**
- AC3.1.1: Extract visible text content, excluding scripts, styles, navigation, footers
- AC3.1.2: Preserve paragraph/sentence boundaries
- AC3.1.3: Generate unique identifiers for each sentence/text node for later DOM targeting
- AC3.1.4: Handle dynamic content (wait for page load completion)
- AC3.1.5: Limit extraction to reasonable size (truncate with warning if > 100KB text)
- AC3.1.6: Return structured data: `{ sentences: [{ id, text, xpath }] }`
- AC3.1.7: Sanitize extracted content to prevent injection attacks

**Dependencies:** Story 1.2

**Impacted Components:** `/src/content/extractor.js`

---

#### Story 3.2: Fact Extraction Prompt Engineering
```
As a developer,
I want optimized prompts for fact extraction across different AI providers,
So that extraction is accurate, consistent, and token-efficient.
```

**Description:** Design and test prompts that instruct AI models to extract facts according to the specified requirements.

**Acceptance Criteria:**
- AC3.2.1: Prompt instructs model to identify explicit and implicit verifiable facts
- AC3.2.2: Prompt requires facts to be objectively verifiable or measurable
- AC3.2.3: Prompt instructs model to output original text AND rephrased searchable version
- AC3.2.4: Prompt requires category assignment from the 9 defined categories
- AC3.2.5: Prompt requires reference to source sentence ID for DOM location
- AC3.2.6: Output format is structured JSON for reliable parsing
- AC3.2.7: Prompt includes few-shot examples for consistency
- AC3.2.8: Single prompt per agent extracts all facts (not per-paragraph) for token efficiency

**Dependencies:** None

**Impacted Components:** `/src/ai/prompts/extraction.js`

---

#### Story 3.3: Multi-Agent Fact Extraction Orchestration
```
As the extension,
I want to send page content to all configured AI agents for fact extraction,
So that multiple perspectives improve extraction coverage.
```

**Description:** Implement parallel or sequential calls to all configured agents for fact extraction.

**Acceptance Criteria:**
- AC3.3.1: Page content sent to each configured agent in single request per agent
- AC3.3.2: Requests run in parallel where provider rate limits allow
- AC3.3.3: Individual agent failures don't block other agents
- AC3.3.4: Results collected with agent attribution including model quality rank
- AC3.3.5: Progress updates sent as each agent completes
- AC3.3.6: Timeout handling for slow responses (60s default)

**Dependencies:** Stories 3.1, 3.2, 2.1

**Impacted Components:** `/src/background/extraction-orchestrator.js`

---

#### Story 3.4: Fact Deduplication Engine
```
As the extension,
I want to deduplicate facts extracted by multiple agents,
So that the user sees a clean list without redundant entries.
```

**Description:** Implement deduplication logic that identifies semantically equivalent facts and selects the best version using model quality/recency ranking.

**Acceptance Criteria:**
- AC3.4.1: Exact text matches are deduplicated (keep version from highest-ranked model)
- AC3.4.2: Semantically equivalent facts are identified (embedding similarity or lightweight AI call)
- AC3.4.3: **When deduplicating semantic matches, use model quality/recency ranking to tiebreak; higher-ranked model's version is preferred; if tied, select version most likely to succeed in search (more specific, more complete)**
- AC3.4.4: Maintain provenance: track which agents extracted each fact
- AC3.4.5: Deduplication runs after all agents complete extraction
- AC3.4.6: Output is unified fact list with agent attribution preserved
- AC3.4.7: Model quality rankings defined: newer models and larger models rank higher (e.g., GPT-4o > GPT-4o-mini, Claude Opus > Claude Sonnet)

**Dependencies:** Story 3.3

**Impacted Components:** `/src/background/deduplication.js`, `/src/config/model-rankings.js`

---

#### Story 3.5: Fact Categorization Validation
```
As the extension,
I want to validate and potentially correct fact categorizations,
So that category-specific verification strategies are applied correctly.
```

**Description:** Implement validation layer that ensures facts are correctly categorized per the 9-category taxonomy.

**Acceptance Criteria:**
- AC3.5.1: Each fact has exactly one primary category from the defined 9
- AC3.5.2: Categories are validated against allowed values
- AC3.5.3: Uncategorized or invalid categories trigger re-categorization attempt
- AC3.5.4: Category assignment is deterministic for same fact text
- AC3.5.5: Category metadata stored with each fact for downstream use

**Dependencies:** Story 3.4

**Impacted Components:** `/src/background/categorization.js`

---

### Epic 4: Live Web Search Verification Engine

#### Story 4.1: Live Web Search Integration
```
As the extension,
I want to perform actual web searches for each fact using real search engines,
So that verification is based on current, real web sources—not AI training data or cached/guessed URLs.
```

**Description:** Integrate with AI providers' web search capabilities to perform real-time searches that return actual, current URLs from the live internet.

**Acceptance Criteria:**
- AC4.1.1: For each fact, perform live web search using rephrased searchable statement
- AC4.1.2: Search query optimized based on fact category
- AC4.1.3: **Retrieve 1-3 sources per fact (not configurable)**
- AC4.1.4: Sources include URL, title, snippet, and domain—all from actual search results
- AC4.1.5: Search uses AI provider's native web search tool (Claude web search, Gemini Google Search, GPT web browsing)
- AC4.1.6: URLs returned must be from actual search engine results, not generated from AI memory or training data
- AC4.1.7: All URLs must be validated as live and accessible before use (see Story 4.3)
- AC4.1.8: Search timestamp recorded to establish currency of results

**Dependencies:** Stories 2.1, 3.4

**Impacted Components:** `/src/background/search.js`

---

#### Story 4.2: Search Query Optimization by Category
```
As the extension,
I want search queries tailored to each fact category,
So that verification searches return relevant, authoritative sources.
```

**Description:** Implement static, category-specific search query modification strategies.

**Acceptance Criteria:**
- AC4.2.1: Medical/Biological facts: append site filters for medical sources (NIH, CDC, PubMed)
- AC4.2.2: Legal/Regulatory facts: append site filters for legal sources (.gov, court records)
- AC4.2.3: Statistical facts: prioritize primary sources, data portals
- AC4.2.4: Scientific facts: append terms like "peer-reviewed" or "journal"
- AC4.2.5: **Historical/current event facts: include date qualifiers; for facts referencing current positions, roles, or recent events, search must include current year and explicitly seek recent sources to account for model knowledge cutoff limitations**
- AC4.2.6: **Strategies are static and hardcoded; users cannot modify search strategies**

**Dependencies:** Story 4.1

**Impacted Components:** `/src/background/search-strategies.js`

---

#### Story 4.3: URL Validation & Anti-Hallucination
```
As the extension,
I want to validate that all source URLs are real, accessible, and contain relevant content,
So that users are never presented with hallucinated, broken, or irrelevant links.
```

**Description:** Implement mandatory URL validation that verifies each source URL actually exists and contains relevant content.

**Acceptance Criteria:**
- AC4.3.1: Each URL is validated via GET request
- AC4.3.2: URLs returning 4xx/5xx are excluded
- AC4.3.3: URLs that redirect excessively (>3 hops) are flagged
- AC4.3.4: URL domain is verified against expected domain from search results
- AC4.3.5: **MANDATORY: Page content is fetched and checked for soft 404 indicators (e.g., "Page not Found", "404", "This page doesn't exist", "No results found", "Content unavailable"); pages containing these patterns are excluded**
- AC4.3.6: **MANDATORY: Page content is verified to contain terms relevant to the fact being verified; irrelevant pages are excluded**
- AC4.3.7: Invalid or irrelevant URLs are excluded from evidence, not shown to user
- AC4.3.8: If all URLs for a fact fail validation, fact is marked as lacking verified evidence

**Dependencies:** Story 4.1

**Impacted Components:** `/src/background/url-validator.js`

---

#### Story 4.4: Source Credibility Assessment
```
As the extension,
I want to assess the credibility tier of each source based on domain and fact category,
So that confidence scoring weights sources appropriately.
```

**Description:** Implement static source tier lookup and scoring based on predefined tier mappings.

**Acceptance Criteria:**
- AC4.4.1: Each source assigned a tier (1-4, where 1 is highest credibility)
- AC4.4.2: Tier assignment considers: domain, fact category, source type
- AC4.4.3: Tier 1 defaults: .gov, .edu, peer-reviewed journals, NIH/CDC/FDA, court records, official statistics bureaus
- AC4.4.4: Tier 2 defaults: major news outlets (AP, Reuters, established newspapers), official company sources, established encyclopedias
- AC4.4.5: Tier 3 defaults: general news, Wikipedia, reputable blogs
- AC4.4.6: Tier 4 defaults: forums, social media, unknown sources
- AC4.4.7: Category-specific overrides applied (e.g., medical journals Tier 1 for Medical category)
- AC4.4.8: Tier mappings are static and not user-configurable

**Dependencies:** Story 5.1 (Source Tier Configuration)

**Impacted Components:** `/src/background/source-tiering.js`

---

#### Story 4.5: Fact Verification via AI with Live Web Grounding
```
As the extension,
I want AI agents to assess fact truth/falsity based solely on content retrieved from live web search,
So that verification is grounded in current evidence rather than training data.
```

**Description:** Implement verification prompt that forces AI to base assessment solely on live search results, with explicit knowledge cutoff awareness.

**Acceptance Criteria:**
- AC4.5.1: Verification prompt explicitly instructs: "Base your assessment ONLY on the provided sources from web search. Do not use your training data."
- AC4.5.2: AI must cite which specific sources support or refute the fact
- AC4.5.3: AI must provide brief reasoning in layman's terms
- AC4.5.4: AI outputs: verdict (true/false/unverified), reasoning, source citations with URLs
- AC4.5.5: If sources are insufficient/conflicting, verdict must be "unverified"
- AC4.5.6: AI is explicitly provided current date and its own knowledge cutoff date
- AC4.5.7: For facts about events/positions after the model's knowledge cutoff, AI must rely entirely on search results

**Dependencies:** Stories 4.1, 4.3

**Impacted Components:** `/src/ai/prompts/verification.js`

---

#### Story 4.6: Dual-Direction Verification (Truth AND Falsity)
```
As the extension,
I want to search for evidence that both supports AND refutes each fact,
So that assessment isn't biased toward confirmation.
```

**Description:** Implement verification strategy that explicitly seeks disconfirming evidence, with refuting evidence subject to same tier/category logic.

**Acceptance Criteria:**
- AC4.6.1: For each fact, perform search for supporting evidence
- AC4.6.2: Additionally, perform search for refuting evidence (e.g., "[fact] false", "[fact] debunked", "[fact] incorrect")
- AC4.6.3: Both result sets provided to AI for balanced assessment
- AC4.6.4: **Refuting evidence sources are subject to the same tier/category credibility logic as supporting evidence; low-tier refutation sources carry less weight than high-tier ones**
- AC4.6.5: If strong refuting evidence exists from high-tier sources, requires higher bar for "true" verdict

**Dependencies:** Story 4.1, Story 4.4

**Impacted Components:** `/src/background/verification-orchestrator.js`

---

#### Story 4.7: Confidence Score Calculation
```
As the extension,
I want to calculate a confidence score (0-100%) for each fact verification,
So that users understand the certainty level of each assessment.
```

**Description:** Implement confidence scoring algorithm based on source tiers, corroboration, contradiction, and evidence availability.

**Acceptance Criteria:**
- AC4.7.1: Confidence score is 0-100 integer percentage
- AC4.7.2: Score increases with higher-tier source corroboration
- AC4.7.3: Score decreases with source contradictions (weighted by source tier)
- AC4.7.4: Score factors: number of sources, tier distribution, agreement level
- AC4.7.5: "Unverified" facts receive confidence score representing certainty of "unverified" status
- AC4.7.6: Algorithm is documented and deterministic
- AC4.7.7: **Thresholds defined: Low (<60%), Medium (60-85%), High (>85%)**
- AC4.7.8: **HARD CAP: If no verified evidence URLs are found, confidence score CANNOT exceed 85% (Medium maximum)**

**Dependencies:** Stories 4.4, 4.5

**Impacted Components:** `/src/background/confidence-scoring.js`

---

#### Story 4.8: Multi-Agent Verification Aggregation
```
As the extension,
I want to aggregate verification results from multiple AI agents,
So that multi-agent consensus improves accuracy.
```

**Description:** Implement aggregation logic when multiple agents verify the same fact.

**Acceptance Criteria:**
- AC4.8.1: Each agent's verification stored with agent attribution
- AC4.8.2: Aggregate verdict determined by majority or weighted consensus
- AC4.8.3: Aggregate confidence is average of individual confidences (weighted by agreement)
- AC4.8.4: Disagreements are surfaced to user (not hidden)
- AC4.8.5: Individual agent assessments remain accessible in UI
- AC4.8.6: If agents strongly disagree, aggregate verdict is "unverified" with explanation

**Dependencies:** Stories 4.5, 4.7

**Impacted Components:** `/src/background/aggregation.js`

---

### Epic 5: Source Tier Management System

#### Story 5.1: Default Source Tier Configuration
```
As a developer,
I want a static source tier configuration for each fact category,
So that the extension works with sensible, fixed credibility rankings.
```

**Description:** Define static tier mappings for domains and source types per category. Not user-configurable.

**Acceptance Criteria:**
- AC5.1.1: Tier configuration is JSON-based and bundled with extension
- AC5.1.2: Global defaults defined (e.g., .gov always Tier 1)
- AC5.1.3: Category-specific overrides defined for all 9 categories
- AC5.1.4: Medical: NIH, CDC, FDA, PubMed, peer-reviewed medical journals, Mayo Clinic = Tier 1
- AC5.1.5: Legal: .gov, court records (PACER, state court sites), official legal databases = Tier 1
- AC5.1.6: Scientific: peer-reviewed journals (Nature, Science, PLOS), .edu, research institutions = Tier 1
- AC5.1.7: Statistical: official statistics bureaus (Census, BLS), World Bank, UN data = Tier 1
- AC5.1.8: Configuration is static and not user-modifiable
- AC5.1.9: Configuration versioned for extension updates

**Dependencies:** None

**Impacted Components:** `/src/config/source-tiers.json`

---

### Epic 6: Real-Time Page Modification & Modal System

#### Story 6.1: Real-Time Sentence Highlighting Injection
```
As a user,
I want sentences containing facts to be highlighted on the page in real-time as they are processed,
So that I can see progress and visually identify which parts of the page were fact-checked.
```

**Description:** Implement content script logic to wrap fact-containing sentences with highlighting styles as facts are identified and verified.

**Acceptance Criteria:**
- AC6.1.1: Sentences containing facts are highlighted as soon as facts are extracted (before verification)
- AC6.1.2: Initial highlight color is neutral (e.g., light blue) indicating "processing"
- AC6.1.3: Highlight color updates to reflect verification status: green (true), red (false), yellow (unverified)
- AC6.1.4: **Highlighting updates in real-time as each fact completes verification**
- AC6.1.5: Highlighting doesn't break page layout or functionality
- AC6.1.6: Multiple facts in one sentence show worst-case color (red > yellow > green)
- AC6.1.7: Highlights are removable (user can hide/close results)

**Dependencies:** Stories 3.1, 4.8

**Impacted Components:** `/src/content/highlighter.js`, `/src/content/styles.css`

---

#### Story 6.2: Fact Modal Component
```
As a user,
I want to click a highlighted sentence and see a modal with fact details,
So that I can review verification results for each fact.
```

**Description:** Implement modal component that displays fact verification details, built progressively as facts are verified.

**Acceptance Criteria:**
- AC6.2.1: Clicking highlighted sentence opens modal
- AC6.2.2: Modal header shows the source sentence text
- AC6.2.3: Modal lists all facts associated with that sentence
- AC6.2.4: Each fact shows: statement, verdict, confidence bar, reasoning, evidence links
- AC6.2.5: Verdict background color: green (true), red (false), yellow (unverified)
- AC6.2.6: **Confidence bar colored per thresholds: red (<60%), yellow (60-85%), green (>85%)**
- AC6.2.7: Evidence links are direct URLs (not redirects), open in new tab
- AC6.2.8: Modal is scrollable if content exceeds viewport
- AC6.2.9: Modal closes on outside click or X button
- AC6.2.10: **Modal content updates in real-time as verification results arrive**

**Dependencies:** Story 6.1

**Impacted Components:** `/src/content/modal.js`, `/src/content/modal.css`

---

#### Story 6.3: Multi-Agent Assessment Display
```
As a user,
I want to see each AI agent's individual assessment for a fact,
So that I can understand where agents agree or disagree.
```

**Description:** Extend modal to show per-agent assessments when multiple agents are used.

**Acceptance Criteria:**
- AC6.3.1: When multiple agents used, modal shows aggregate assessment first
- AC6.3.2: Below aggregate, expandable sections for each agent
- AC6.3.3: Agent sections labeled with friendly name (e.g., "Gemini - 2.5 Flash")
- AC6.3.4: Each agent section shows: verdict, confidence, reasoning, evidence links
- AC6.3.5: Disagreements are visually highlighted
- AC6.3.6: Single-agent mode shows only that agent's assessment (no aggregate)

**Dependencies:** Story 6.2

**Impacted Components:** `/src/content/modal.js`

---

### Epic 7: Progress & Results UI

#### Story 7.1: Progress Popup Component
```
As a user,
I want to see a progress indicator while fact-checking runs,
So that I know the extension is working and how long it might take.
```

**Description:** Implement floating progress popup in page corner showing real-time status.

**Acceptance Criteria:**
- AC7.1.1: Progress popup appears in top-right corner when checking starts
- AC7.1.2: Shows current step (Extracting facts, Verifying facts, etc.)
- AC7.1.3: Shows total facts count once extraction complete
- AC7.1.4: Shows current fact # being verified
- AC7.1.5: Shows overall progress bar (0-100%)
- AC7.1.6: **Popup is draggable but NOT minimizable**
- AC7.1.7: Updates in real-time as facts are processed

**Dependencies:** Stories 3.3, 4.8

**Impacted Components:** `/src/content/progress-popup.js`, `/src/content/progress-popup.css`

---

#### Story 7.2: Results Summary Display
```
As a user,
I want to see a summary of results when fact-checking completes,
So that I can quickly understand the page's overall factual accuracy.
```

**Description:** Transform progress popup into results summary upon completion with close functionality.

**Acceptance Criteria:**
- AC7.2.1: Progress popup transitions to results view on completion
- AC7.2.2: Shows total facts checked
- AC7.2.3: Shows breakdown: # true, # false, # unverified
- AC7.2.4: Shows overall page confidence score (aggregate of all fact confidences)
- AC7.2.5: Color-coded summary (red if many false, green if mostly true)
- AC7.2.6: **"Close" button hides the results popup AND removes all page highlighting/modifications**
- AC7.2.7: Option to keep visible (don't auto-dismiss)
- AC7.2.8: Re-accessible from extension popup after closing

**Dependencies:** Story 7.1

**Impacted Components:** `/src/content/progress-popup.js`

---

#### Story 7.3: Run/Cancel Controls
```
As a user,
I want to start and cancel fact-checking from the extension popup,
So that I have control over when the extension runs.
```

**Description:** Implement run and cancel functionality in extension popup.

**Acceptance Criteria:**
- AC7.3.1: "Run" button initiates fact-checking on current page
- AC7.3.2: "Run" disabled if no AI agents configured
- AC7.3.3: "Run" disabled if already running
- AC7.3.4: "Cancel" button appears while running
- AC7.3.5: Cancel gracefully stops processing, preserves partial results
- AC7.3.6: UI reflects current state (idle, running, complete, cancelled)

**Dependencies:** Stories 1.3, 2.5

**Impacted Components:** `/src/popup/popup.js`, `/src/background/orchestrator.js`

---

#### Story 7.4: Donation Link Integration
```
As a user,
I want to see a donation link in the extension,
So that I can support the developer if I find value in the extension.
```

**Description:** Add donation link styled similarly to Beyond20's approach using a secure payment platform.

**Acceptance Criteria:**
- AC7.4.1: Donation link visible in extension popup (non-intrusive)
- AC7.4.2: Link opens donation page in new tab
- AC7.4.3: Donation method uses secure platform (Ko-fi, PayPal, or GitHub Sponsors recommended over Venmo)
- AC7.4.4: Link text is friendly, not pushy (e.g., "Support this project")

**Dependencies:** Story 1.3

**Impacted Components:** `/src/popup/popup.html`

---

### Epic 8: Accuracy Assurance & Hallucination Prevention

#### Story 8.1: Fact Extraction Validation
```
As the extension,
I want to validate extracted facts meet verifiability criteria,
So that non-verifiable statements aren't processed as facts.
```

**Description:** Implement validation layer that filters out opinions, predictions, and non-verifiable claims.

**Acceptance Criteria:**
- AC8.1.1: Filter removes subjective opinions ("X is the best")
- AC8.1.2: Filter removes predictions/speculation ("X will happen")
- AC8.1.3: Filter removes tautologies and definitions-only statements
- AC8.1.4: Each fact must be objectively verifiable in principle
- AC8.1.5: Borderline cases flagged for lenient inclusion with low confidence
- AC8.1.6: Validation can use lightweight AI call if rule-based insufficient

**Dependencies:** Story 3.4

**Impacted Components:** `/src/background/fact-validator.js`

---

#### Story 8.2: Verification Grounding Enforcement
```
As the extension,
I want to ensure AI verification is strictly grounded in live web search results,
So that AI doesn't use training data to make unsupported claims.
```

**Description:** Implement prompt engineering and response validation to enforce grounding in live search results.

**Acceptance Criteria:**
- AC8.2.1: Verification prompt explicitly prohibits using knowledge not from live search results
- AC8.2.2: AI must quote or reference specific sources (with URLs) for each claim
- AC8.2.3: Response validation checks that cited URLs were actually returned by search
- AC8.2.4: Claims without source citation are flagged or rejected
- AC8.2.5: If AI appears to use outside knowledge, re-prompt with stricter instructions

**Dependencies:** Story 4.5

**Impacted Components:** `/src/ai/prompts/verification.js`, `/src/background/grounding-validator.js`

---

#### Story 8.3: Knowledge Cutoff Handling
```
As the extension,
I want to handle facts about recent events correctly with user-friendly messaging,
So that AI knowledge cutoffs don't cause incorrect assessments.
```

**Description:** Implement strategies to handle recency-sensitive facts with clear user communication.

**Acceptance Criteria:**
- AC8.3.1: Verification prompt includes current date
- AC8.3.2: Each AI provider's knowledge cutoff date is stored and accessible
- AC8.3.3: Facts containing recent date references are flagged for extra scrutiny
- AC8.3.4: If sources are dated before fact's timeframe, flag as potentially outdated
- AC8.3.5: For very recent events, require multiple high-tier sources for confident verdict
- AC8.3.6: AI instructed to say "unverified" if sources may be outdated
- AC8.3.7: **If a fact about events after the model's knowledge cutoff cannot be verified, display user-friendly message: "This fact relates to events after [Model Name]'s knowledge cutoff ([Date]). We could not find sufficient current sources to verify it."**
- AC8.3.8: Knowledge cutoff date displayed in message formatted in readable format (e.g., "January 2025")

**Dependencies:** Stories 4.1, 4.5, 2.1

**Impacted Components:** `/src/background/recency-handler.js`, `/src/content/modal.js`

---

#### Story 8.4: Cross-Agent Consistency Check
```
As the extension,
I want to use multi-agent disagreement as a signal for uncertainty,
So that contested facts are surfaced rather than hidden.
```

**Description:** Implement logic that uses agent disagreement to improve accuracy signals.

**Acceptance Criteria:**
- AC8.4.1: Strong disagreement (opposite verdicts) triggers "unverified" aggregate
- AC8.4.2: Disagreement lowers aggregate confidence score
- AC8.4.3: Specific disagreements surfaced in modal UI
- AC8.4.4: Option to re-run verification with additional search terms when disagreement detected
- AC8.4.5: Multi-agent mode provides measurably better accuracy than single-agent (testable hypothesis)

**Dependencies:** Story 4.8

**Impacted Components:** `/src/background/aggregation.js`

---

## E. Sprint Breakdown

### Sprint 1: Foundation & AI Integration (2 weeks)
**Goals:**
- Establish extension infrastructure with security best practices
- Enable users to add and authenticate AI agents (OAuth for Google, secure API key for others)
- Validate end-to-end communication

**Stories Included:**
- 1.1: Extension Manifest & Structure
- 1.2: Inter-Component Messaging System
- 1.3: Extension Popup Shell
- 2.1: AI Provider Abstraction Interface
- 2.2: OpenAI Provider Adapter
- 2.3: Anthropic Provider Adapter
- 2.4: Google (Gemini) Provider Adapter
- 2.5: AI Agent Management UI

**Rationale:** The extension cannot function without its core structure and at least one working AI integration. This sprint delivers a testable shell where users can securely configure AI agents.

---

### Sprint 2: Fact Extraction Pipeline (2 weeks)
**Goals:**
- Extract facts from page content
- Categorize and deduplicate facts with model-quality tiebreaking
- Begin real-time UI updates

**Stories Included:**
- 3.1: HTML Content Extraction
- 3.2: Fact Extraction Prompt Engineering
- 3.3: Multi-Agent Fact Extraction Orchestration
- 3.4: Fact Deduplication Engine
- 3.5: Fact Categorization Validation
- 8.1: Fact Extraction Validation
- 7.1: Progress Popup Component (partial—extraction progress)
- 6.1: Real-Time Sentence Highlighting Injection (initial highlighting)

**Rationale:** Fact extraction is the first half of the core pipeline. By end of Sprint 2, users can see facts extracted from a page with real-time highlighting and progress indication.

---

### Sprint 3: Verification Engine (2 weeks)
**Goals:**
- Verify facts via live web search
- Validate all URLs and content
- Calculate confidence scores with evidence-based caps
- Aggregate multi-agent results

**Stories Included:**
- 4.1: Live Web Search Integration
- 4.2: Search Query Optimization by Category
- 4.3: URL Validation & Anti-Hallucination
- 4.4: Source Credibility Assessment
- 4.5: Fact Verification via AI with Live Web Grounding
- 4.6: Dual-Direction Verification
- 4.7: Confidence Score Calculation
- 4.8: Multi-Agent Verification Aggregation
- 5.1: Default Source Tier Configuration
- 8.2: Verification Grounding Enforcement
- 8.3: Knowledge Cutoff Handling

**Rationale:** This sprint delivers the core accuracy engine—the primary value proposition of the extension.

---

### Sprint 4: UI Completion & Polish (2 weeks)
**Goals:**
- Complete all UI components with real-time updates
- Finalize modal system
- Implement close/hide functionality
- Final polish and testing

**Stories Included:**
- 6.1: Real-Time Sentence Highlighting Injection (complete with status colors)
- 6.2: Fact Modal Component
- 6.3: Multi-Agent Assessment Display
- 7.1: Progress Popup Component (complete)
- 7.2: Results Summary Display (with close functionality)
- 7.3: Run/Cancel Controls
- 7.4: Donation Link Integration
- 8.4: Cross-Agent Consistency Check

**Rationale:** With core functionality complete, Sprint 4 delivers the polished user-facing experience with real-time updates and full control.

---

## F. High-Level Tasks (NOT Implementation)

### Infrastructure
- Define manifest.json with minimal required permissions and CSP
- Establish content script / background script / popup architecture
- Implement Chrome messaging abstraction with sanitization
- Set up encrypted local storage schema for credentials
- Implement Web Crypto API encryption utilities

### AI Integration
- Implement Google OAuth flow via chrome.identity
- Build secure API key entry and encrypted storage for OpenAI/Anthropic
- Define provider interface contract with web search capability
- Store and expose model knowledge cutoff dates
- Implement model quality/recency rankings for tiebreaking
- Implement token usage tracking

### Fact Extraction
- Design HTML parsing strategy preserving sentence boundaries
- Engineer extraction prompts with few-shot examples (single prompt per agent)
- Build deduplication algorithm with model-quality tiebreaking
- Define category taxonomy and validation rules

### Verification
- Integrate live web search via provider-native tools
- Define static source tier mappings per category
- Engineer verification prompts enforcing grounding and knowledge cutoff awareness
- Design confidence scoring formula with evidence-based caps
- Build mandatory URL validation with soft-404 detection
- Build content relevance verification
- Implement dual-direction search (supporting + refuting)

### UI/UX
- Design real-time highlighting injection strategy
- Build modal component with progressive updates
- Design progress popup (draggable, not minimizable)
- Implement close/hide functionality to remove all page modifications
- Create responsive, accessible CSS
- Design knowledge cutoff user messaging

### Accuracy
- Implement hallucination detection heuristics
- Build response validation for grounding enforcement
- Design recency handling logic with user-friendly messaging
- Implement cross-agent consistency checks

---

## G. Unified Acceptance Criteria Document

# ACCEPTANCE CRITERIA

## 1. User Requirements

The user requires a browser extension that:
- Allows adding multiple AI agents (OpenAI, Anthropic, Google) using user's own credentials
- Uses OAuth for Google; secure encrypted API key storage for OpenAI/Anthropic
- Extracts all verifiable facts from any HTML page
- Categorizes facts into 9 defined categories
- Deduplicates facts across AI agents using model quality/recency ranking for tiebreaking
- Verifies facts using **live web search** (actual search engine queries returning real, validated URLs)
- Assigns source credibility tiers by category (static configuration)
- Calculates confidence scores with evidence-based caps (max Medium if no verified URLs)
- Highlights fact-containing sentences in real-time as processing occurs
- Shows verification details in clickable modals with real-time updates
- Displays real-time progress with close option to hide all UI changes
- Provides user-friendly messaging for knowledge cutoff limitations
- Operates at zero cost to developer (user-funded AI usage)
- Follows security best practices throughout
- Prioritizes accuracy above all other features

## 2. Findings from Code Analysis

- **Greenfield project**: No existing codebase; all components are net-new
- **No regressions**: N/A
- **No technical debt**: Clean-slate architecture opportunity
- **No legacy constraints**: Can implement modern best practices throughout

## 3. Functional Acceptance Criteria

### AI Agent Management
- Users can add AI agents from supported providers (OpenAI, Anthropic, Google)
- Google: OAuth authentication via chrome.identity
- OpenAI/Anthropic: Secure API key entry with encryption (Web Crypto API), masking, and security warnings
- Users can select specific models per provider
- Model knowledge cutoff dates are stored and displayed
- Users can remove configured agents (secure credential deletion)
- At least one agent required to run fact-checking
- Configurations persist across sessions (encrypted where sensitive)

### Fact Extraction
- Extension extracts visible text content from current page
- AI agents identify explicit and implicit verifiable facts
- Each fact is assigned to exactly one of 9 categories
- Facts track DOM location for sentence highlighting
- Facts are rephrased for optimal searchability
- Duplicate and semantically equivalent facts are merged using model quality/recency ranking for tiebreaking
- Non-verifiable statements (opinions, predictions) are filtered out
- Single extraction prompt per agent for token efficiency

### Fact Verification
- Each fact is verified using **live web search** (actual search engine queries, not AI memory)
- Search queries are optimized per fact category (static strategies)
- Both supporting and refuting evidence is sought
- Refuting evidence subject to same tier/category credibility logic as supporting evidence
- All source URLs are validated as accessible AND containing relevant content (mandatory)
- Soft 404s detected and excluded (pages containing "Page not Found" etc.)
- Sources are assigned credibility tiers (1-4) per static configuration
- Verification prompt enforces grounding (no training-data reasoning)
- Verdict is TRUE, FALSE, or UNVERIFIED
- Confidence score (0-100%) reflects source quality and agreement
- **Confidence thresholds: Low (<60%), Medium (60-85%), High (>85%)**
- **Hard cap: Confidence cannot exceed Medium (85%) if no verified evidence URLs exist**
- Knowledge cutoff handled: current date provided, recent events require current sources
- User-friendly message displayed when knowledge cutoff prevents verification

### Multi-Agent Behavior
- All configured agents perform extraction
- All configured agents perform verification
- Results are aggregated with individual assessments preserved
- Strong disagreement triggers UNVERIFIED aggregate verdict
- Average confidence is calculated across agents

### Real-Time Page Modification
- Fact-containing sentences are highlighted in real-time as facts are identified
- Initial highlight indicates "processing"; color updates as verification completes
- Highlight color reflects aggregate verdict (green/red/yellow)
- Clicking highlighted sentence opens modal
- Modal shows sentence, facts, verdicts, confidence, reasoning, evidence links
- Modal content updates in real-time as verification results arrive
- Evidence links are direct URLs (validated, not redirects) opening in new tab
- Multi-agent assessments are individually displayed
- "Close" option removes all page modifications

### Progress & Results
- Progress popup appears in corner during processing (draggable, not minimizable)
- Shows current step, fact counts, progress bar
- Updates in real-time
- Transitions to results summary on completion
- Shows total facts, breakdown by verdict, overall confidence
- "Close" button hides results AND removes all page highlighting
- Results re-accessible from extension popup
- Run/Cancel controls in extension popup
- Donation link present (Ko-fi, PayPal, or GitHub Sponsors)

## 4. Nonfunctional/Performance Criteria

### Performance
- Total processing time scales linearly with page size; target <2 minutes for average article
- Single extraction prompt per agent for token efficiency
- Verification batches where possible without sacrificing accuracy
- Search results cached within session to avoid redundant queries
- 1-3 evidence URLs per fact (balance thoroughness vs. cost)

### Security
- Content Security Policy (CSP) configured to prevent XSS
- No `eval()`, `new Function()`, or dynamic code execution
- API keys encrypted with Web Crypto API before storage
- API keys never logged or transmitted except to provider
- API keys masked in UI (only last 4 characters visible)
- No external telemetry or analytics to developer servers
- Minimal permissions in manifest (only what's needed)
- Input sanitization for all user-provided data
- HTTPS-only for all external requests
- Message payloads sanitized before processing

### Reliability
- Individual agent failures don't block other agents; graceful degradation
- Timeout handling for slow responses (60s default)
- Partial results preserved on cancellation

### Privacy
- Page content only sent to user-configured AI providers
- No telemetry to extension developer

### Accuracy
- Mandatory URL validation prevents hallucinated links
- Mandatory content verification prevents soft-404 and irrelevant links
- Grounding enforcement prevents training-data contamination
- Dual-direction verification prevents confirmation bias
- Evidence-based confidence caps prevent false confidence
- Knowledge cutoff handling prevents outdated assessments
- Multi-agent consistency checks surface uncertainty

## 5. Affected Components

| Component | Description |
|-----------|-------------|
| `/manifest.json` | Extension configuration with CSP |
| `/src/popup/*` | Extension popup UI |
| `/src/background/*` | Background service worker, orchestration |
| `/src/content/*` | Content scripts, DOM manipulation |
| `/src/ai/*` | AI provider adapters and prompts |
| `/src/config/*` | Source tier configurations, model rankings |
| `/src/utils/crypto.js` | Web Crypto API encryption utilities |

## 6. Dependencies/Constraints

### External Dependencies
- Chrome Extension APIs (Manifest V3)
- AI Provider APIs (OpenAI, Anthropic, Google)
- Google OAuth (for Gemini authentication)
- Provider-native web search capabilities (Claude web search, Gemini Google Search, GPT web browsing)

### Constraints
- Extension must be free to operate (user pays AI costs)
- Cannot make external API calls to developer-controlled servers
- Must work across arbitrary HTML pages
- Must not break page functionality
- Must handle pages up to 100KB text content
- Must support Chrome initially (Firefox portability considered)
- Search strategies are static (not user-configurable)
- Source tier mappings are static (not user-configurable)

### Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Source tiers by category | Story 5.1 defines static defaults; documented in config |
| Live update vs. batch | Real-time update as facts complete (better UX) |
| OAuth vs. API key | OAuth for Google; encrypted API key storage for OpenAI/Anthropic with security warnings |
| Evidence URL count | **1-3 URLs per fact** (balance thoroughness vs. cost) |
| Hallucination prevention | Mandatory URL validation + content verification + grounding enforcement + multi-agent consistency |
| Multi-agent value | Testable hypothesis in Story 8.4; recommend A/B testing post-MVP |
| Confidence calculation | Defined in Story 4.7; formula documented; **Hard cap at Medium without verified evidence** |
| Confidence thresholds | **Low (<60%), Medium (60-85%), High (>85%)** |
| Donation platform | Ko-fi, PayPal, or GitHub Sponsors (more established than Venmo for public donations) |
| Knowledge cutoff | User-friendly message with model name and cutoff date when verification limited |
| Model tiebreaking | Model quality/recency rankings used; higher-ranked model's version preferred |

---
# PSEUDOCODE SPECIFICATION

## 1. Epic-Level Module Overview

### Epic 1: Extension Core Infrastructure
- `/manifest.json`: Extension configuration with permissions, CSP, service worker registration
- `/src/background/service-worker.js`: Background script entry point
- `/src/background/messaging.js`: Inter-component message routing and sanitization
- `/src/content/content.js`: Content script entry point
- `/src/content/messaging.js`: Content script message handler
- `/src/popup/popup.html`: Extension popup UI shell
- `/src/popup/popup.js`: Popup logic and state management
- `/src/popup/popup.css`: Popup styling
- `/src/popup/messaging.js`: Popup message handler
- `/src/shared/message-types.js`: Message type enum definitions
- `/src/shared/message-utils.js`: Message sanitization utilities

### Epic 2: AI Provider Integration Layer
- `/src/ai/provider-interface.js`: Abstract AI provider contract
- `/src/ai/types.js`: Standardized response type definitions
- `/src/ai/providers/openai.js`: OpenAI adapter implementation
- `/src/ai/providers/anthropic.js`: Anthropic adapter implementation
- `/src/ai/providers/google.js`: Google Gemini adapter implementation
- `/src/utils/crypto.js`: Web Crypto API encryption utilities
- `/src/config/model-metadata.js`: Model knowledge cutoffs and quality rankings
- `/src/popup/agent-manager.js`: Agent configuration UI logic

### Epic 3: Fact Extraction Engine
- `/src/content/extractor.js`: DOM parsing and sentence extraction
- `/src/ai/prompts/extraction.js`: Fact extraction prompt templates
- `/src/background/extraction-orchestrator.js`: Multi-agent extraction coordination
- `/src/background/deduplication.js`: Fact deduplication with model-quality tiebreaking
- `/src/background/categorization.js`: Category validation and correction
- `/src/config/model-rankings.js`: Model quality ranking configuration
- `/src/config/categories.js`: 9-category taxonomy definitions

### Epic 4: Live Web Search Verification Engine
- `/src/background/search.js`: Live web search orchestration
- `/src/background/search-strategies.js`: Category-specific query optimization
- `/src/background/url-validator.js`: URL validation with soft-404 and relevance checking
- `/src/background/source-tiering.js`: Source credibility tier assignment
- `/src/background/confidence-scoring.js`: Confidence score calculation
- `/src/background/verification-orchestrator.js`: Dual-direction verification coordination
- `/src/background/aggregation.js`: Multi-agent result aggregation
- `/src/ai/prompts/verification.js`: Verification prompt templates

### Epic 5: Source Tier Management System
- `/src/config/source-tiers.json`: Static tier mappings by domain and category

### Epic 6: Real-Time Page Modification & Modal System
- `/src/content/highlighter.js`: Sentence highlighting and color management
- `/src/content/styles.css`: Highlighting CSS styles
- `/src/content/modal.js`: Fact detail modal component
- `/src/content/modal.css`: Modal styling

### Epic 7: Progress & Results UI
- `/src/content/progress-popup.js`: Floating progress and results display
- `/src/content/progress-popup.css`: Progress popup styling
- `/src/background/orchestrator.js`: Main workflow state machine

### Epic 8: Accuracy Assurance & Hallucination Prevention
- `/src/background/fact-validator.js`: Extraction validation filters
- `/src/background/grounding-validator.js`: Response grounding enforcement
- `/src/background/recency-handler.js`: Knowledge cutoff handling

---

## 2. Data Structures

```
DATASTRUCT Sentence:
  id: string                    // Format: "s-{index}"
  text: string                  // Original sentence text
  xpath: string                 // XPath to locate in DOM

DATASTRUCT ExtractedContent:
  sentences: Sentence[]
  truncated: boolean
  totalCharacters: number

DATASTRUCT Fact:
  id: string                    // Format: "f-{index}"
  originalText: string          // Text as appears in page
  searchableText: string        // Rephrased for search
  category: FactCategory
  sentenceId: string            // Reference to source sentence
  provenance: string[]          // Agent IDs that extracted this
  isValid: boolean
  validationNote: string | null

DATASTRUCT FactCategory:
  ENUM: HISTORICAL_EVENT | STATISTICAL_QUANTITATIVE | 
        DEFINITIONAL_ATTRIBUTE | SCIENTIFIC_TECHNICAL |
        MEDICAL_BIOLOGICAL | LEGAL_REGULATORY |
        GEOPOLITICAL_SOCIAL | ATTRIBUTION_QUOTE |
        CAUSAL_RELATIONAL

DATASTRUCT ValidationResult:
  valid: boolean
  url: string
  reason: string | null
  relevanceScore: number | null
  redirectCount: number | null

DATASTRUCT Source:
  url: string
  title: string
  snippet: string
  domain: string
  tier: number                  // 1-4
  isSupporting: boolean
  validatedAt: timestamp

DATASTRUCT VerificationResult:
  factId: string
  agentId: string
  verdict: Verdict
  confidence: number            // 0-100
  confidenceCategory: string    // 'low' | 'medium' | 'high'
  reasoning: string
  sources: Source[]
  knowledgeCutoffMessage: string | null

DATASTRUCT Verdict:
  ENUM: TRUE | FALSE | UNVERIFIED

DATASTRUCT AggregatedResult:
  factId: string
  aggregateVerdict: Verdict
  aggregateConfidence: number
  aggregateConfidenceCategory: string
  agentResults: VerificationResult[]
  hasDisagreement: boolean
  disagreementNote: string | null

DATASTRUCT ProviderInfo:
  id: string
  displayName: string
  model: string
  modelDisplayName: string
  knowledgeCutoff: string
  knowledgeCutoffDate: Date

DATASTRUCT AgentConfig:
  id: string                    // UUID
  providerId: string            // "openai" | "anthropic" | "google"
  model: string
  encryptedCredential: string | null
  oauthToken: string | null
  qualityRank: number

DATASTRUCT ExtensionState:
  status: Status
  currentStep: string | null
  totalFacts: number | null
  processedFacts: number | null
  results: AggregatedResult[] | null
  startedAt: timestamp | null
  completedAt: timestamp | null

DATASTRUCT Status:
  ENUM: IDLE | RUNNING | COMPLETE | CANCELLED

DATASTRUCT ProgressUpdate:
  step: string
  totalFacts: number | null
  currentFact: number | null
  percentComplete: number

DATASTRUCT ResultsSummary:
  totalFacts: number
  trueCount: number
  falseCount: number
  unverifiedCount: number
  overallConfidence: number
  overallConfidenceCategory: string

DATASTRUCT Message:
  type: MessageType
  payload: any
  tabId: number | null
  timestamp: number

DATASTRUCT MessageType:
  ENUM: START_FACT_CHECK | CANCEL_FACT_CHECK |
        EXTRACTION_PROGRESS | EXTRACTION_COMPLETE |
        VERIFICATION_PROGRESS | VERIFICATION_COMPLETE |
        HIGHLIGHT_SENTENCE | UPDATE_HIGHLIGHT_COLOR |
        OPEN_MODAL | UPDATE_MODAL | CLOSE_MODAL |
        SHOW_PROGRESS | UPDATE_PROGRESS | SHOW_RESULTS |
        CLOSE_RESULTS | GET_STATE | STATE_UPDATE | ERROR |
        GET_PAGE_CONTENT | PAGE_CONTENT_RESULT |
        SAVE_AGENT_CONFIG | REMOVE_AGENT | GET_AGENTS |
        INITIATE_OAUTH

DATASTRUCT SourceTierConfig:
  globalDefaults: TierMapping[]
  categoryOverrides: Map<FactCategory, TierMapping[]>

DATASTRUCT TierMapping:
  pattern: string               // Domain or TLD pattern
  tier: number                  // 1-4

DATASTRUCT ModelRanking:
  providerId: string
  model: string
  qualityRank: number
  knowledgeCutoff: string
  knowledgeCutoffDate: Date

DATASTRUCT ExtractionPromptContext:
  content: string
  categories: FactCategory[]
  sentenceMap: Map<string, Sentence>

DATASTRUCT VerificationPromptContext:
  fact: Fact
  category: FactCategory
  currentDate: string
  modelCutoffDate: string
  supportingSources: Source[]
  refutingSources: Source[]
```

---

## 3. Pseudocode By Epic and Story

### Epic 1: Extension Core Infrastructure

#### Story 1.1: Extension Manifest & Structure

MODULE ManifestConfig:
DESCRIPTION: Static JSON configuration for browser extension

```
FILE: /manifest.json
STRUCTURE:
{
  "manifest_version": 3,
  "name": "TruthSeek",
  "version": "1.0.0",
  "description": "AI-powered fact verification for any webpage",
  "permissions": ["activeTab", "storage", "identity"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["http://*/*", "https://*/*"],
    "js": [
      "src/content/content.js"
    ],
    "css": [
      "src/content/styles.css",
      "src/content/modal.css",
      "src/content/progress-popup.css"
    ]
  }],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

#### Story 1.2: Inter-Component Messaging System

MODULE MessageTypes:
DESCRIPTION: Enum definitions for all message types

FILE: /src/shared/message-types.js

```
CONST MessageType = {
  START_FACT_CHECK: "START_FACT_CHECK",
  CANCEL_FACT_CHECK: "CANCEL_FACT_CHECK",
  EXTRACTION_PROGRESS: "EXTRACTION_PROGRESS",
  EXTRACTION_COMPLETE: "EXTRACTION_COMPLETE",
  VERIFICATION_PROGRESS: "VERIFICATION_PROGRESS",
  VERIFICATION_COMPLETE: "VERIFICATION_COMPLETE",
  HIGHLIGHT_SENTENCE: "HIGHLIGHT_SENTENCE",
  UPDATE_HIGHLIGHT_COLOR: "UPDATE_HIGHLIGHT_COLOR",
  OPEN_MODAL: "OPEN_MODAL",
  UPDATE_MODAL: "UPDATE_MODAL",
  CLOSE_MODAL: "CLOSE_MODAL",
  SHOW_PROGRESS: "SHOW_PROGRESS",
  UPDATE_PROGRESS: "UPDATE_PROGRESS",
  SHOW_RESULTS: "SHOW_RESULTS",
  CLOSE_RESULTS: "CLOSE_RESULTS",
  GET_STATE: "GET_STATE",
  STATE_UPDATE: "STATE_UPDATE",
  ERROR: "ERROR",
  GET_PAGE_CONTENT: "GET_PAGE_CONTENT",
  PAGE_CONTENT_RESULT: "PAGE_CONTENT_RESULT",
  SAVE_AGENT_CONFIG: "SAVE_AGENT_CONFIG",
  REMOVE_AGENT: "REMOVE_AGENT",
  GET_AGENTS: "GET_AGENTS",
  INITIATE_OAUTH: "INITIATE_OAUTH"
}

EXPORT MessageType
```

MODULE MessageUtils:
DESCRIPTION: Message creation and sanitization utilities

FILE: /src/shared/message-utils.js

```
FUNCTION createMessage(type: MessageType, payload: any, tabId?: number) -> Message:
  INPUT:
    - type: MessageType
    - payload: any
    - tabId: number (optional)
  OUTPUT:
    - Message object
  STEPS:
    1. RETURN {
         type: type,
         payload: sanitizePayload(payload),
         tabId: tabId OR null,
         timestamp: Date.now()
       }

FUNCTION sanitizePayload(payload: any) -> any:
  INPUT:
    - payload: any untrusted input
  OUTPUT:
    - sanitized payload
  STEPS:
    1. IF payload IS null OR undefined:
         RETURN null
    2. IF payload IS string:
         a. REPLACE any script tags: payload.replace(/<script[^>]*>.*?<\/script>/gi, '')
         b. REPLACE event handlers: payload.replace(/on\w+\s*=/gi, '')
         c. RETURN sanitized string
    3. IF payload IS array:
         RETURN payload.map(item => sanitizePayload(item))
    4. IF payload IS object:
         a. CREATE sanitized = {}
         b. FOR each key IN Object.keys(payload):
              sanitized[key] = sanitizePayload(payload[key])
         c. RETURN sanitized
    5. IF payload IS number OR boolean:
         RETURN payload
    6. RETURN null
```

MODULE BackgroundMessaging:
DESCRIPTION: Central message router for background service worker

FILE: /src/background/messaging.js

```
PRIVATE handlers: Map<MessageType, Function> = new Map()

FUNCTION initialize():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. ADD listener to chrome.runtime.onMessage:
         (message, sender, sendResponse) => {
           handleMessage(message, sender, sendResponse)
           RETURN true  // Keep channel open for async response
         }
    2. LOG "Background messaging initialized"

FUNCTION registerHandler(type: MessageType, handler: Function):
  INPUT:
    - type: MessageType
    - handler: Function(payload, sender) -> Promise<any>
  OUTPUT: none
  STEPS:
    1. handlers.set(type, handler)

FUNCTION handleMessage(message: Message, sender: chrome.runtime.MessageSender, sendResponse: Function):
  INPUT:
    - message: Message object
    - sender: Chrome message sender info
    - sendResponse: callback function
  OUTPUT: none (async response via sendResponse)
  STEPS:
    1. VALIDATE message has type field:
         IF NOT message.type:
           sendResponse({ error: "Invalid message: missing type" })
           RETURN
    2. SANITIZE payload:
         message.payload = sanitizePayload(message.payload)
    3. GET handler for message type:
         handler = handlers.get(message.type)
    4. IF handler NOT found:
         sendResponse({ error: "Unknown message type: " + message.type })
         RETURN
    5. TRY:
         result = AWAIT handler(message.payload, sender)
         sendResponse({ success: true, data: result })
       CATCH error:
         LOG error
         sendResponse({ error: error.message })

FUNCTION sendToTab(tabId: number, message: Message) -> Promise<any>:
  INPUT:
    - tabId: number
    - message: Message
  OUTPUT:
    - Promise resolving to response
  STEPS:
    1. TRY:
         response = AWAIT chrome.tabs.sendMessage(tabId, message)
         RETURN response
       CATCH error:
         LOG "Failed to send to tab " + tabId + ": " + error.message
         THROW error

FUNCTION broadcast(message: Message) -> Promise<void>:
  INPUT:
    - message: Message
  OUTPUT:
    - Promise<void>
  STEPS:
    1. GET all tabs: tabs = AWAIT chrome.tabs.query({})
    2. FOR each tab IN tabs:
         IF tab.id:
           TRY:
             AWAIT sendToTab(tab.id, message)
           CATCH:
             CONTINUE  // Tab may not have content script
```

MODULE ContentMessaging:
DESCRIPTION: Message handler for content scripts

FILE: /src/content/messaging.js

```
PRIVATE handlers: Map<MessageType, Function> = new Map()

FUNCTION initialize():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. ADD listener to chrome.runtime.onMessage:
         (message, sender, sendResponse) => {
           handleMessage(message, sender, sendResponse)
           RETURN true
         }

FUNCTION registerHandler(type: MessageType, handler: Function):
  INPUT:
    - type: MessageType
    - handler: Function
  OUTPUT: none
  STEPS:
    1. handlers.set(type, handler)

FUNCTION handleMessage(message: Message, sender: any, sendResponse: Function):
  INPUT:
    - message: Message
    - sender: any
    - sendResponse: Function
  OUTPUT: none
  STEPS:
    1. handler = handlers.get(message.type)
    2. IF handler:
         TRY:
           result = AWAIT handler(message.payload)
           sendResponse({ success: true, data: result })
         CATCH error:
           sendResponse({ error: error.message })
       ELSE:
         // Unknown message type - ignore silently

FUNCTION sendToBackground(message: Message) -> Promise<any>:
  INPUT:
    - message: Message
  OUTPUT:
    - Promise<any>
  STEPS:
    1. RETURN chrome.runtime.sendMessage(message)
```

MODULE PopupMessaging:
DESCRIPTION: Message handler for popup UI

FILE: /src/popup/messaging.js

```
FUNCTION sendToBackground(type: MessageType, payload: any) -> Promise<any>:
  INPUT:
    - type: MessageType
    - payload: any
  OUTPUT:
    - Promise<any>
  STEPS:
    1. message = createMessage(type, payload)
    2. response = AWAIT chrome.runtime.sendMessage(message)
    3. IF response.error:
         THROW new Error(response.error)
    4. RETURN response.data
```

---

#### Story 1.3: Extension Popup Shell

MODULE PopupUI:
DESCRIPTION: Extension popup HTML structure and initialization

FILE: /src/popup/popup.html

```
HTML STRUCTURE:
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="popup.css">
  <title>TruthSeek</title>
</head>
<body>
  <div class="popup-container">
    <header class="popup-header">
      <h1>TruthSeek</h1>
      <span class="status-indicator" id="statusIndicator"></span>
    </header>
    
    <section class="agents-section">
      <h2>AI Agents</h2>
      <div id="agentList" class="agent-list">
        <!-- Empty state shown when no agents -->
        <p class="empty-state" id="emptyState">No AI agents configured</p>
      </div>
      <button id="addAgentBtn" class="btn btn-secondary">+ Add AI Agent</button>
    </section>
    
    <section class="controls-section">
      <button id="runBtn" class="btn btn-primary" disabled>Run Fact Check</button>
      <button id="cancelBtn" class="btn btn-danger hidden">Cancel</button>
    </section>
    
    <section class="results-section hidden" id="resultsSection">
      <h2>Last Results</h2>
      <div id="lastResults"></div>
      <button id="viewResultsBtn" class="btn btn-secondary">View on Page</button>
    </section>
    
    <footer class="popup-footer">
      <a href="https://ko-fi.com/truthseek" target="_blank" class="donation-link">
        ❤️ Support this project
      </a>
    </footer>
  </div>
  
  <!-- Agent Configuration Modal -->
  <div id="agentModal" class="modal hidden">
    <div class="modal-content">
      <h2>Add AI Agent</h2>
      <div id="providerSelection">
        <button class="provider-btn" data-provider="openai">OpenAI</button>
        <button class="provider-btn" data-provider="anthropic">Anthropic</button>
        <button class="provider-btn" data-provider="google">Google (Gemini)</button>
      </div>
      <div id="apiKeyInput" class="hidden">
        <div class="security-warning">
          ⚠️ Your API key will be encrypted and stored locally. Never share your API key.
        </div>
        <input type="password" id="apiKey" placeholder="Enter API Key">
        <select id="modelSelect"></select>
        <div class="api-key-display hidden" id="apiKeyDisplay">
          Key: ****<span id="keyLast4"></span>
        </div>
      </div>
      <div id="oauthSection" class="hidden">
        <button id="googleOAuthBtn" class="btn btn-primary">Sign in with Google</button>
        <select id="googleModelSelect" class="hidden"></select>
      </div>
      <div class="modal-actions">
        <button id="saveAgentBtn" class="btn btn-primary" disabled>Save</button>
        <button id="cancelAgentBtn" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
  
  <script type="module" src="popup.js"></script>
</body>
</html>
```

FILE: /src/popup/popup.js

```
IMPORT { sendToBackground } from './messaging.js'
IMPORT { MessageType } from '../shared/message-types.js'
IMPORT { AgentManager } from './agent-manager.js'

PRIVATE state: ExtensionState = null
PRIVATE agentManager: AgentManager = null

FUNCTION initialize():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. AWAIT loadState()
    2. agentManager = new AgentManager()
    3. AWAIT agentManager.initialize()
    4. setupEventListeners()
    5. updateUI()

FUNCTION loadState() -> Promise<void>:
  INPUT: none
  OUTPUT: none
  STEPS:
    1. TRY:
         response = AWAIT sendToBackground(MessageType.GET_STATE, {})
         state = response
       CATCH:
         state = { status: 'IDLE', results: null }

FUNCTION setupEventListeners():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. GET runBtn = document.getElementById('runBtn')
    2. GET cancelBtn = document.getElementById('cancelBtn')
    3. GET addAgentBtn = document.getElementById('addAgentBtn')
    4. GET viewResultsBtn = document.getElementById('viewResultsBtn')
    
    5. runBtn.addEventListener('click', handleRun)
    6. cancelBtn.addEventListener('click', handleCancel)
    7. addAgentBtn.addEventListener('click', () => agentManager.showModal())
    8. viewResultsBtn.addEventListener('click', handleViewResults)
    
    9. LISTEN for STATE_UPDATE messages:
         chrome.runtime.onMessage.addListener((msg) => {
           IF msg.type === MessageType.STATE_UPDATE:
             state = msg.payload
             updateUI()
         })

FUNCTION handleRun():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. GET current tab: [tab] = AWAIT chrome.tabs.query({ active: true, currentWindow: true })
    2. IF NOT tab:
         SHOW error "No active tab"
         RETURN
    3. AWAIT sendToBackground(MessageType.START_FACT_CHECK, { tabId: tab.id })
    4. updateUI()

FUNCTION handleCancel():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. AWAIT sendToBackground(MessageType.CANCEL_FACT_CHECK, {})
    2. updateUI()

FUNCTION handleViewResults():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. GET current tab: [tab] = AWAIT chrome.tabs.query({ active: true, currentWindow: true })
    2. IF tab AND state.results:
         AWAIT sendToBackground(MessageType.SHOW_RESULTS, { tabId: tab.id })

FUNCTION updateUI():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. GET runBtn = document.getElementById('runBtn')
    2. GET cancelBtn = document.getElementById('cancelBtn')
    3. GET statusIndicator = document.getElementById('statusIndicator')
    4. GET resultsSection = document.getElementById('resultsSection')
    
    5. agents = AWAIT agentManager.getAgents()
    6. hasAgents = agents.length > 0
    
    7. SWITCH state.status:
         CASE 'IDLE':
           runBtn.disabled = NOT hasAgents
           runBtn.classList.remove('hidden')
           cancelBtn.classList.add('hidden')
           statusIndicator.textContent = hasAgents ? 'Ready' : 'Configure agents'
           statusIndicator.className = 'status-indicator idle'
         
         CASE 'RUNNING':
           runBtn.classList.add('hidden')
           cancelBtn.classList.remove('hidden')
           statusIndicator.textContent = 'Running...'
           statusIndicator.className = 'status-indicator running'
         
         CASE 'COMPLETE':
           runBtn.disabled = NOT hasAgents
           runBtn.classList.remove('hidden')
           cancelBtn.classList.add('hidden')
           statusIndicator.textContent = 'Complete'
           statusIndicator.className = 'status-indicator complete'
           resultsSection.classList.remove('hidden')
           renderLastResults()
         
         CASE 'CANCELLED':
           runBtn.disabled = NOT hasAgents
           runBtn.classList.remove('hidden')
           cancelBtn.classList.add('hidden')
           statusIndicator.textContent = 'Cancelled'
           statusIndicator.className = 'status-indicator cancelled'

FUNCTION renderLastResults():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. IF NOT state.results:
         RETURN
    2. GET container = document.getElementById('lastResults')
    3. summary = calculateSummary(state.results)
    4. container.innerHTML = `
         <div class="results-summary">
           <p>Facts checked: ${summary.totalFacts}</p>
           <p class="true-count">✓ True: ${summary.trueCount}</p>
           <p class="false-count">✗ False: ${summary.falseCount}</p>
           <p class="unverified-count">? Unverified: ${summary.unverifiedCount}</p>
         </div>
       `

FUNCTION calculateSummary(results: AggregatedResult[]) -> ResultsSummary:
  INPUT:
    - results: AggregatedResult[]
  OUTPUT:
    - ResultsSummary
  STEPS:
    1. RETURN {
         totalFacts: results.length,
         trueCount: results.filter(r => r.aggregateVerdict === 'TRUE').length,
         falseCount: results.filter(r => r.aggregateVerdict === 'FALSE').length,
         unverifiedCount: results.filter(r => r.aggregateVerdict === 'UNVERIFIED').length,
         overallConfidence: average(results.map(r => r.aggregateConfidence)),
         overallConfidenceCategory: categorizeConfidence(average)
       }

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initialize)
```

---

### Epic 2: AI Provider Integration Layer

#### Story 2.1: AI Provider Abstraction Interface

MODULE AIProviderInterface:
DESCRIPTION: Abstract base class defining contract for all AI providers

FILE: /src/ai/provider-interface.js

```
CLASS AIProvider:
  ABSTRACT

  CONSTRUCTOR(config: AgentConfig):
    this.config = config

  ABSTRACT ASYNC extractFacts(content: ExtractedContent, categories: FactCategory[]) -> ExtractionResult:
    // Must be implemented by subclasses

  ABSTRACT ASYNC verifyFactWithWebSearch(fact: Fact, category: FactCategory) -> VerificationResult:
    // Must be implemented by subclasses

  ABSTRACT ASYNC isAuthenticated() -> boolean:
    // Must be implemented by subclasses

  ABSTRACT getProviderInfo() -> ProviderInfo:
    // Must be implemented by subclasses

  ABSTRACT getModelQualityRank() -> number:
    // Must be implemented by subclasses

EXPORT AIProvider
```

FILE: /src/ai/types.js

```
DATASTRUCT ExtractionResult:
  success: boolean
  facts: Fact[]
  error: string | null
  tokenUsage: { prompt: number, completion: number }

DATASTRUCT CommonErrorCode:
  ENUM: AUTH_FAILED | RATE_LIMITED | TIMEOUT | INVALID_RESPONSE |
        NETWORK_ERROR | QUOTA_EXCEEDED | UNKNOWN

FUNCTION mapProviderError(providerCode: string, provider: string) -> CommonErrorCode:
  INPUT:
    - providerCode: provider-specific error code
    - provider: "openai" | "anthropic" | "google"
  OUTPUT:
    - CommonErrorCode
  STEPS:
    1. DEFINE errorMappings = {
         openai: {
           "invalid_api_key": AUTH_FAILED,
           "rate_limit_exceeded": RATE_LIMITED,
           "context_length_exceeded": INVALID_RESPONSE
         },
         anthropic: {
           "authentication_error": AUTH_FAILED,
           "rate_limit_error": RATE_LIMITED,
           "overloaded_error": RATE_LIMITED
         },
         google: {
           "UNAUTHENTICATED": AUTH_FAILED,
           "RESOURCE_EXHAUSTED": RATE_LIMITED
         }
       }
    2. RETURN errorMappings[provider][providerCode] OR UNKNOWN

EXPORT ExtractionResult, CommonErrorCode, mapProviderError
```

---

#### Story 2.2: OpenAI Provider Adapter

MODULE OpenAIProvider:
DESCRIPTION: AI provider implementation for OpenAI GPT models

FILE: /src/ai/providers/openai.js

```
IMPORT { AIProvider } from '../provider-interface.js'
IMPORT { encrypt, decrypt } from '../../utils/crypto.js'
IMPORT { MODEL_METADATA } from '../../config/model-metadata.js'
IMPORT { buildExtractionPrompt } from '../prompts/extraction.js'
IMPORT { buildVerificationPrompt } from '../prompts/verification.js'

CLASS OpenAIProvider EXTENDS AIProvider:
  PRIVATE apiKey: string | null = null
  PRIVATE tokenUsage: { prompt: number, completion: number } = { prompt: 0, completion: 0 }
  PRIVATE lastRequestTime: number = 0
  PRIVATE MIN_REQUEST_INTERVAL: number = 100  // ms between requests

  CONSTRUCTOR(config: AgentConfig):
    super(config)

  ASYNC authenticate(apiKey: string) -> boolean:
    INPUT:
      - apiKey: plaintext API key
    OUTPUT:
      - boolean success
    STEPS:
      1. VALIDATE apiKey is not empty
      2. encryptedKey = AWAIT encrypt(apiKey)
      3. STORE in chrome.storage.local:
           key: "openai_credential_" + this.config.id
           value: encryptedKey
      4. this.apiKey = apiKey
      5. RETURN true
    ERRORS:
      - Empty key: THROW "API key cannot be empty"
      - Encryption failed: THROW "Failed to secure API key"

  ASYNC loadCredential() -> void:
    INPUT: none
    OUTPUT: none
    STEPS:
      1. GET encryptedKey from chrome.storage.local:
           key: "openai_credential_" + this.config.id
      2. IF encryptedKey:
           this.apiKey = AWAIT decrypt(encryptedKey)

  ASYNC isAuthenticated() -> boolean:
    INPUT: none
    OUTPUT: boolean
    STEPS:
      1. IF NOT this.apiKey:
           AWAIT this.loadCredential()
      2. RETURN this.apiKey !== null

  getProviderInfo() -> ProviderInfo:
    INPUT: none
    OUTPUT: ProviderInfo
    STEPS:
      1. metadata = MODEL_METADATA.openai[this.config.model]
      2. RETURN {
           id: "openai",
           displayName: "OpenAI",
           model: this.config.model,
           modelDisplayName: metadata.displayName,
           knowledgeCutoff: metadata.knowledgeCutoff,
           knowledgeCutoffDate: new Date(metadata.knowledgeCutoffDate)
         }

  getModelQualityRank() -> number:
    INPUT: none
    OUTPUT: number
    STEPS:
      1. metadata = MODEL_METADATA.openai[this.config.model]
      2. RETURN metadata.qualityRank

  ASYNC extractFacts(content: ExtractedContent, categories: FactCategory[]) -> ExtractionResult:
    INPUT:
      - content: ExtractedContent with sentences
      - categories: array of valid categories
    OUTPUT:
      - ExtractionResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           RETURN { success: false, facts: [], error: "Not authenticated", tokenUsage: null }
      
      2. AWAIT this.rateLimitDelay()
      
      3. prompt = buildExtractionPrompt(content, categories)
      
      4. TRY:
           response = AWAIT this.callAPI({
             model: this.config.model,
             messages: [
               { role: "system", content: prompt.system },
               { role: "user", content: prompt.user }
             ],
             response_format: { type: "json_object" },
             temperature: 0.1
           })
           
           this.trackTokenUsage(response.usage)
           
           parsed = JSON.parse(response.choices[0].message.content)
           facts = this.parseFacts(parsed, content.sentences)
           
           RETURN {
             success: true,
             facts: facts,
             error: null,
             tokenUsage: response.usage
           }
         CATCH error:
           RETURN {
             success: false,
             facts: [],
             error: error.message,
             tokenUsage: null
           }

  ASYNC verifyFactWithWebSearch(fact: Fact, category: FactCategory) -> VerificationResult:
    INPUT:
      - fact: Fact to verify
      - category: fact category
    OUTPUT:
      - VerificationResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           THROW "Not authenticated"
      
      2. AWAIT this.rateLimitDelay()
      
      3. providerInfo = this.getProviderInfo()
      4. currentDate = new Date().toISOString().split('T')[0]
      
      5. prompt = buildVerificationPrompt({
           fact: fact,
           category: category,
           currentDate: currentDate,
           modelCutoffDate: providerInfo.knowledgeCutoff
         })
      
      6. // Define web search tool
         tools = [{
           type: "function",
           function: {
             name: "web_search",
             description: "Search the web for current information",
             parameters: {
               type: "object",
               properties: {
                 query: { type: "string", description: "Search query" }
               },
               required: ["query"]
             }
           }
         }]
      
      7. TRY:
           response = AWAIT this.callAPI({
             model: this.config.model,
             messages: [
               { role: "system", content: prompt.system },
               { role: "user", content: prompt.user }
             ],
             tools: tools,
             tool_choice: "auto",
             temperature: 0.1
           })
           
           this.trackTokenUsage(response.usage)
           
           // Process tool calls and final response
           result = AWAIT this.processVerificationResponse(response, fact)
           RETURN result
         CATCH error:
           RETURN {
             factId: fact.id,
             agentId: this.config.id,
             verdict: "UNVERIFIED",
             confidence: 0,
             confidenceCategory: "low",
             reasoning: "Verification failed: " + error.message,
             sources: [],
             knowledgeCutoffMessage: null
           }

  PRIVATE ASYNC callAPI(params: object) -> object:
    INPUT:
      - params: API request parameters
    OUTPUT:
      - API response object
    STEPS:
      1. response = AWAIT fetch("https://api.openai.com/v1/chat/completions", {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "Authorization": "Bearer " + this.apiKey
           },
           body: JSON.stringify(params)
         })
      
      2. IF NOT response.ok:
           errorData = AWAIT response.json()
           THROW new Error(errorData.error?.message OR response.statusText)
      
      3. RETURN AWAIT response.json()

  PRIVATE ASYNC rateLimitDelay():
    INPUT: none
    OUTPUT: none
    STEPS:
      1. elapsed = Date.now() - this.lastRequestTime
      2. IF elapsed < this.MIN_REQUEST_INTERVAL:
           AWAIT sleep(this.MIN_REQUEST_INTERVAL - elapsed)
      3. this.lastRequestTime = Date.now()

  PRIVATE trackTokenUsage(usage: object):
    INPUT:
      - usage: { prompt_tokens, completion_tokens }
    OUTPUT: none
    STEPS:
      1. this.tokenUsage.prompt += usage.prompt_tokens OR 0
      2. this.tokenUsage.completion += usage.completion_tokens OR 0

  PRIVATE parseFacts(parsed: object, sentences: Sentence[]) -> Fact[]:
    INPUT:
      - parsed: JSON response from AI
      - sentences: original sentences for mapping
    OUTPUT:
      - Fact[]
    STEPS:
      1. facts = []
      2. FOR each item IN parsed.facts:
           fact = {
             id: "f-" + facts.length,
             originalText: item.originalText,
             searchableText: item.searchableText,
             category: item.category,
             sentenceId: item.sentenceId,
             provenance: [this.config.id],
             isValid: true,
             validationNote: null
           }
           facts.push(fact)
      3. RETURN facts

  ASYNC removeCredential() -> void:
    INPUT: none
    OUTPUT: none
    STEPS:
      1. AWAIT chrome.storage.local.remove("openai_credential_" + this.config.id)
      2. this.apiKey = null

  getMaskedKey() -> string:
    INPUT: none
    OUTPUT: masked key string
    STEPS:
      1. IF NOT this.apiKey:
           RETURN ""
      2. RETURN "****" + this.apiKey.slice(-4)

EXPORT OpenAIProvider
```

---

#### Story 2.3: Anthropic Provider Adapter

MODULE AnthropicProvider:
DESCRIPTION: AI provider implementation for Anthropic Claude models

FILE: /src/ai/providers/anthropic.js

```
IMPORT { AIProvider } from '../provider-interface.js'
IMPORT { encrypt, decrypt } from '../../utils/crypto.js'
IMPORT { MODEL_METADATA } from '../../config/model-metadata.js'
IMPORT { buildExtractionPrompt } from '../prompts/extraction.js'
IMPORT { buildVerificationPrompt } from '../prompts/verification.js'

CLASS AnthropicProvider EXTENDS AIProvider:
  PRIVATE apiKey: string | null = null
  PRIVATE tokenUsage: { prompt: number, completion: number } = { prompt: 0, completion: 0 }
  PRIVATE lastRequestTime: number = 0
  PRIVATE MIN_REQUEST_INTERVAL: number = 100

  CONSTRUCTOR(config: AgentConfig):
    super(config)

  ASYNC authenticate(apiKey: string) -> boolean:
    INPUT:
      - apiKey: plaintext API key
    OUTPUT:
      - boolean
    STEPS:
      1. VALIDATE apiKey is not empty
      2. encryptedKey = AWAIT encrypt(apiKey)
      3. STORE in chrome.storage.local:
           key: "anthropic_credential_" + this.config.id
           value: encryptedKey
      4. this.apiKey = apiKey
      5. RETURN true

  ASYNC loadCredential() -> void:
    STEPS:
      1. GET encryptedKey from chrome.storage.local
      2. IF encryptedKey:
           this.apiKey = AWAIT decrypt(encryptedKey)

  ASYNC isAuthenticated() -> boolean:
    STEPS:
      1. IF NOT this.apiKey:
           AWAIT this.loadCredential()
      2. RETURN this.apiKey !== null

  getProviderInfo() -> ProviderInfo:
    STEPS:
      1. metadata = MODEL_METADATA.anthropic[this.config.model]
      2. RETURN {
           id: "anthropic",
           displayName: "Anthropic",
           model: this.config.model,
           modelDisplayName: metadata.displayName,
           knowledgeCutoff: metadata.knowledgeCutoff,
           knowledgeCutoffDate: new Date(metadata.knowledgeCutoffDate)
         }

  getModelQualityRank() -> number:
    STEPS:
      1. metadata = MODEL_METADATA.anthropic[this.config.model]
      2. RETURN metadata.qualityRank

  ASYNC extractFacts(content: ExtractedContent, categories: FactCategory[]) -> ExtractionResult:
    INPUT:
      - content: ExtractedContent
      - categories: FactCategory[]
    OUTPUT:
      - ExtractionResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           RETURN { success: false, facts: [], error: "Not authenticated", tokenUsage: null }
      
      2. AWAIT this.rateLimitDelay()
      
      3. prompt = buildExtractionPrompt(content, categories)
      
      4. TRY:
           response = AWAIT this.callAPI({
             model: this.config.model,
             max_tokens: 4096,
             system: prompt.system,
             messages: [
               { role: "user", content: prompt.user }
             ]
           })
           
           this.trackTokenUsage(response.usage)
           
           // Parse JSON from response
           content = response.content[0].text
           jsonMatch = content.match(/\{[\s\S]*\}/)
           IF NOT jsonMatch:
             THROW "No valid JSON in response"
           
           parsed = JSON.parse(jsonMatch[0])
           facts = this.parseFacts(parsed, content.sentences)
           
           RETURN { success: true, facts: facts, error: null, tokenUsage: response.usage }
         CATCH error:
           RETURN { success: false, facts: [], error: error.message, tokenUsage: null }

  ASYNC verifyFactWithWebSearch(fact: Fact, category: FactCategory) -> VerificationResult:
    INPUT:
      - fact: Fact
      - category: FactCategory
    OUTPUT:
      - VerificationResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           THROW "Not authenticated"
      
      2. AWAIT this.rateLimitDelay()
      
      3. providerInfo = this.getProviderInfo()
      4. currentDate = new Date().toISOString().split('T')[0]
      
      5. prompt = buildVerificationPrompt({
           fact: fact,
           category: category,
           currentDate: currentDate,
           modelCutoffDate: providerInfo.knowledgeCutoff
         })
      
      6. // Define web search tool for Claude
         tools = [{
           name: "web_search",
           description: "Search the web for current information to verify facts",
           input_schema: {
             type: "object",
             properties: {
               query: { type: "string", description: "Search query" }
             },
             required: ["query"]
           }
         }]
      
      7. TRY:
           response = AWAIT this.callAPI({
             model: this.config.model,
             max_tokens: 4096,
             system: prompt.system,
             messages: [{ role: "user", content: prompt.user }],
             tools: tools
           })
           
           this.trackTokenUsage(response.usage)
           result = AWAIT this.processVerificationResponse(response, fact)
           RETURN result
         CATCH error:
           RETURN {
             factId: fact.id,
             agentId: this.config.id,
             verdict: "UNVERIFIED",
             confidence: 0,
             confidenceCategory: "low",
             reasoning: "Verification failed: " + error.message,
             sources: [],
             knowledgeCutoffMessage: null
           }

  PRIVATE ASYNC callAPI(params: object) -> object:
    STEPS:
      1. response = AWAIT fetch("https://api.anthropic.com/v1/messages", {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "x-api-key": this.apiKey,
             "anthropic-version": "2023-06-01"
           },
           body: JSON.stringify(params)
         })
      
      2. IF NOT response.ok:
           errorData = AWAIT response.json()
           THROW new Error(errorData.error?.message OR response.statusText)
      
      3. RETURN AWAIT response.json()

  PRIVATE ASYNC rateLimitDelay():
    STEPS:
      1. elapsed = Date.now() - this.lastRequestTime
      2. IF elapsed < this.MIN_REQUEST_INTERVAL:
           AWAIT sleep(this.MIN_REQUEST_INTERVAL - elapsed)
      3. this.lastRequestTime = Date.now()

  PRIVATE trackTokenUsage(usage: object):
    STEPS:
      1. this.tokenUsage.prompt += usage.input_tokens OR 0
      2. this.tokenUsage.completion += usage.output_tokens OR 0

  ASYNC removeCredential() -> void:
    STEPS:
      1. AWAIT chrome.storage.local.remove("anthropic_credential_" + this.config.id)
      2. this.apiKey = null

  getMaskedKey() -> string:
    STEPS:
      1. IF NOT this.apiKey: RETURN ""
      2. RETURN "****" + this.apiKey.slice(-4)

EXPORT AnthropicProvider
```

---

#### Story 2.4: Google (Gemini) Provider Adapter

MODULE GoogleProvider:
DESCRIPTION: AI provider implementation for Google Gemini with OAuth

FILE: /src/ai/providers/google.js

```
IMPORT { AIProvider } from '../provider-interface.js'
IMPORT { MODEL_METADATA } from '../../config/model-metadata.js'
IMPORT { buildExtractionPrompt } from '../prompts/extraction.js'
IMPORT { buildVerificationPrompt } from '../prompts/verification.js'

CLASS GoogleProvider EXTENDS AIProvider:
  PRIVATE accessToken: string | null = null
  PRIVATE tokenUsage: { prompt: number, completion: number } = { prompt: 0, completion: 0 }
  PRIVATE lastRequestTime: number = 0
  PRIVATE MIN_REQUEST_INTERVAL: number = 100

  CONSTRUCTOR(config: AgentConfig):
    super(config)

  ASYNC authenticate() -> boolean:
    INPUT: none (uses OAuth flow)
    OUTPUT: boolean
    STEPS:
      1. TRY:
           // Use chrome.identity for OAuth
           token = AWAIT new Promise((resolve, reject) => {
             chrome.identity.getAuthToken({ interactive: true }, (token) => {
               IF chrome.runtime.lastError:
                 reject(chrome.runtime.lastError)
               ELSE:
                 resolve(token)
             })
           })
           
           this.accessToken = token
           
           // Store token association with config
           AWAIT chrome.storage.local.set({
             ["google_auth_" + this.config.id]: true
           })
           
           RETURN true
         CATCH error:
           LOG "OAuth failed: " + error.message
           RETURN false

  ASYNC isAuthenticated() -> boolean:
    STEPS:
      1. IF this.accessToken:
           RETURN true
      2. // Check if we have stored auth
         stored = AWAIT chrome.storage.local.get("google_auth_" + this.config.id)
         IF stored["google_auth_" + this.config.id]:
           // Try to get token non-interactively
           TRY:
             token = AWAIT new Promise((resolve, reject) => {
               chrome.identity.getAuthToken({ interactive: false }, (token) => {
                 IF chrome.runtime.lastError:
                   reject(chrome.runtime.lastError)
                 ELSE:
                   resolve(token)
               })
             })
             this.accessToken = token
             RETURN true
           CATCH:
             RETURN false
      3. RETURN false

  getProviderInfo() -> ProviderInfo:
    STEPS:
      1. metadata = MODEL_METADATA.google[this.config.model]
      2. RETURN {
           id: "google",
           displayName: "Google",
           model: this.config.model,
           modelDisplayName: metadata.displayName,
           knowledgeCutoff: metadata.knowledgeCutoff,
           knowledgeCutoffDate: new Date(metadata.knowledgeCutoffDate)
         }

  getModelQualityRank() -> number:
    STEPS:
      1. metadata = MODEL_METADATA.google[this.config.model]
      2. RETURN metadata.qualityRank

  ASYNC extractFacts(content: ExtractedContent, categories: FactCategory[]) -> ExtractionResult:
    INPUT:
      - content: ExtractedContent
      - categories: FactCategory[]
    OUTPUT:
      - ExtractionResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           RETURN { success: false, facts: [], error: "Not authenticated", tokenUsage: null }
      
      2. AWAIT this.rateLimitDelay()
      
      3. prompt = buildExtractionPrompt(content, categories)
      
      4. TRY:
           response = AWAIT this.callAPI({
             contents: [{
               parts: [{ text: prompt.system + "\n\n" + prompt.user }]
             }],
             generationConfig: {
               temperature: 0.1,
               responseMimeType: "application/json"
             }
           })
           
           this.trackTokenUsage(response.usageMetadata)
           
           text = response.candidates[0].content.parts[0].text
           parsed = JSON.parse(text)
           facts = this.parseFacts(parsed, content.sentences)
           
           RETURN { success: true, facts: facts, error: null, tokenUsage: response.usageMetadata }
         CATCH error:
           RETURN { success: false, facts: [], error: error.message, tokenUsage: null }

  ASYNC verifyFactWithWebSearch(fact: Fact, category: FactCategory) -> VerificationResult:
    INPUT:
      - fact: Fact
      - category: FactCategory
    OUTPUT:
      - VerificationResult
    STEPS:
      1. IF NOT AWAIT this.isAuthenticated():
           THROW "Not authenticated"
      
      2. AWAIT this.rateLimitDelay()
      
      3. providerInfo = this.getProviderInfo()
      4. currentDate = new Date().toISOString().split('T')[0]
      
      5. prompt = buildVerificationPrompt({
           fact: fact,
           category: category,
           currentDate: currentDate,
           modelCutoffDate: providerInfo.knowledgeCutoff
         })
      
      6. TRY:
           // Use Google Search grounding
           response = AWAIT this.callAPI({
             contents: [{
               parts: [{ text: prompt.system + "\n\n" + prompt.user }]
             }],
             tools: [{
               googleSearch: {}
             }],
             generationConfig: {
               temperature: 0.1
             }
           })
           
           this.trackTokenUsage(response.usageMetadata)
           result = this.processVerificationResponse(response, fact)
           RETURN result
         CATCH error:
           RETURN {
             factId: fact.id,
             agentId: this.config.id,
             verdict: "UNVERIFIED",
             confidence: 0,
             confidenceCategory: "low",
             reasoning: "Verification failed: " + error.message,
             sources: [],
             knowledgeCutoffMessage: null
           }

  PRIVATE ASYNC callAPI(params: object) -> object:
    STEPS:
      1. url = "https://generativelanguage.googleapis.com/v1beta/models/" +
               this.config.model + ":generateContent"
      
      2. response = AWAIT fetch(url, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "Authorization": "Bearer " + this.accessToken
           },
           body: JSON.stringify(params)
         })
      
      3. IF NOT response.ok:
           IF response.status === 401:
             // Token expired, clear and retry auth
             this.accessToken = null
             THROW new Error("Authentication expired")
           errorData = AWAIT response.json()
           THROW new Error(errorData.error?.message OR response.statusText)
      
      4. RETURN AWAIT response.json()

  PRIVATE ASYNC rateLimitDelay():
    STEPS:
      1. elapsed = Date.now() - this.lastRequestTime
      2. IF elapsed < this.MIN_REQUEST_INTERVAL:
           AWAIT sleep(this.MIN_REQUEST_INTERVAL - elapsed)
      3. this.lastRequestTime = Date.now()

  PRIVATE trackTokenUsage(usage: object):
    STEPS:
      1. IF usage:
           this.tokenUsage.prompt += usage.promptTokenCount OR 0
           this.tokenUsage.completion += usage.candidatesTokenCount OR 0

  ASYNC revokeAccess() -> void:
    STEPS:
      1. IF this.accessToken:
           chrome.identity.removeCachedAuthToken({ token: this.accessToken })
      2. AWAIT chrome.storage.local.remove("google_auth_" + this.config.id)
      3. this.accessToken = null

EXPORT GoogleProvider
```

---

#### Story 2.5: AI Agent Management UI

MODULE AgentManager:
DESCRIPTION: UI logic for adding, configuring, and removing AI agents

FILE: /src/popup/agent-manager.js

```
IMPORT { sendToBackground } from './messaging.js'
IMPORT { MessageType } from '../shared/message-types.js'

CLASS AgentManager:
  PRIVATE agents: AgentConfig[] = []
  PRIVATE currentProvider: string | null = null
  PRIVATE modal: HTMLElement | null = null

  ASYNC initialize():
    INPUT: none
    OUTPUT: none
    STEPS:
      1. AWAIT this.loadAgents()
      2. this.setupModalElements()
      3. this.renderAgentList()

  ASYNC loadAgents() -> void:
    STEPS:
      1. stored = AWAIT chrome.storage.local.get("agents")
      2. this.agents = stored.agents OR []

  ASYNC saveAgents() -> void:
    STEPS:
      1. AWAIT chrome.storage.local.set({ agents: this.agents })

  ASYNC getAgents() -> AgentConfig[]:
    STEPS:
      1. RETURN this.agents

  setupModalElements():
    STEPS:
      1. this.modal = document.getElementById('agentModal')
      2. GET providerBtns = document.querySelectorAll('.provider-btn')
      3. FOR each btn IN providerBtns:
           btn.addEventListener('click', () => this.selectProvider(btn.dataset.provider))
      
      4. document.getElementById('saveAgentBtn').addEventListener('click', () => this.saveAgent())
      5. document.getElementById('cancelAgentBtn').addEventListener('click', () => this.hideModal())
      6. document.getElementById('googleOAuthBtn').addEventListener('click', () => this.initiateOAuth())
      7. document.getElementById('apiKey').addEventListener('input', (e) => this.onApiKeyInput(e))

  showModal():
    STEPS:
      1. this.resetModal()
      2. this.modal.classList.remove('hidden')

  hideModal():
    STEPS:
      1. this.modal.classList.add('hidden')
      2. this.resetModal()

  resetModal():
    STEPS:
      1. this.currentProvider = null
      2. document.getElementById('providerSelection').classList.remove('hidden')
      3. document.getElementById('apiKeyInput').classList.add('hidden')
      4. document.getElementById('oauthSection').classList.add('hidden')
      5. document.getElementById('apiKey').value = ''
      6. document.getElementById('saveAgentBtn').disabled = true

  selectProvider(provider: string):
    INPUT:
      - provider: "openai" | "anthropic" | "google"
    OUTPUT: none
    STEPS:
      1. this.currentProvider = provider
      2. document.getElementById('providerSelection').classList.add('hidden')
      
      3. IF provider === 'google':
           document.getElementById('oauthSection').classList.remove('hidden')
           this.populateModelSelect('googleModelSelect', 'google')
         ELSE:
           document.getElementById('apiKeyInput').classList.remove('hidden')
           this.populateModelSelect('modelSelect', provider)

  populateModelSelect(selectId: string, provider: string):
    INPUT:
      - selectId: element ID
      - provider: provider name
    OUTPUT: none
    STEPS:
      1. select = document.getElementById(selectId)
      2. select.innerHTML = ''
      
      3. models = MODEL_OPTIONS[provider]
      4. FOR each model IN models:
           option = document.createElement('option')
           option.value = model.id
           option.textContent = model.displayName + " (cutoff: " + model.knowledgeCutoff + ")"
           select.appendChild(option)

  onApiKeyInput(event: Event):
    INPUT:
      - event: input event
    OUTPUT: none
    STEPS:
      1. value = event.target.value
      2. saveBtn = document.getElementById('saveAgentBtn')
      3. saveBtn.disabled = value.length < 10
      
      4. // Show masked preview
         IF value.length >= 4:
           document.getElementById('keyLast4').textContent = value.slice(-4)
           document.getElementById('apiKeyDisplay').classList.remove('hidden')

  ASYNC initiateOAuth():
    INPUT: none
    OUTPUT: none
    STEPS:
      1. TRY:
           // Create temporary config
           tempConfig = {
             id: crypto.randomUUID(),
             providerId: 'google',
             model: document.getElementById('googleModelSelect').value
           }
           
           result = AWAIT sendToBackground(MessageType.INITIATE_OAUTH, tempConfig)
           
           IF result.success:
             document.getElementById('googleModelSelect').classList.remove('hidden')
             document.getElementById('saveAgentBtn').disabled = false
             this.pendingGoogleConfig = tempConfig
         CATCH error:
           SHOW error "OAuth failed: " + error.message

  ASYNC saveAgent():
    INPUT: none
    OUTPUT: none
    STEPS:
      1. IF this.currentProvider === 'google':
           // Google OAuth already authenticated
           config = this.pendingGoogleConfig
           config.model = document.getElementById('googleModelSelect').value
           config.qualityRank = MODEL_OPTIONS.google.find(m => m.id === config.model).qualityRank
         ELSE:
           // API key providers
           apiKey = document.getElementById('apiKey').value
           model = document.getElementById('modelSelect').value
           
           config = {
             id: crypto.randomUUID(),
             providerId: this.currentProvider,
             model: model,
             qualityRank: MODEL_OPTIONS[this.currentProvider].find(m => m.id === model).qualityRank
           }
           
           // Save encrypted credential via background
           AWAIT sendToBackground(MessageType.SAVE_AGENT_CONFIG, {
             config: config,
             apiKey: apiKey
           })
      
      2. this.agents.push(config)
      3. AWAIT this.saveAgents()
      4. this.renderAgentList()
      5. this.hideModal()
      6. // Trigger popup UI update
         EMIT custom event 'agents-updated'

  renderAgentList():
    INPUT: none
    OUTPUT: none
    STEPS:
      1. container = document.getElementById('agentList')
      2. emptyState = document.getElementById('emptyState')
      
      3. IF this.agents.length === 0:
           emptyState.classList.remove('hidden')
           container.innerHTML = ''
           RETURN
      
      4. emptyState.classList.add('hidden')
      5. container.innerHTML = ''
      
      6. FOR each agent IN this.agents:
           div = document.createElement('div')
           div.className = 'agent-item'
           div.innerHTML = `
             <span class="agent-icon">${this.getProviderIcon(agent.providerId)}</span>
             <span class="agent-name">${this.getAgentDisplayName(agent)}</span>
             <span class="agent-cutoff">${this.getAgentCutoff(agent)}</span>
             <button class="btn-remove" data-id="${agent.id}">×</button>
           `
           container.appendChild(div)
      
      7. // Add remove listeners
         FOR each btn IN container.querySelectorAll('.btn-remove'):
           btn.addEventListener('click', () => this.removeAgent(btn.dataset.id))

  ASYNC removeAgent(agentId: string):
    INPUT:
      - agentId: agent config ID
    OUTPUT: none
    STEPS:
      1. agent = this.agents.find(a => a.id === agentId)
      2. IF NOT agent:
           RETURN
      
      3. // Remove credential via background
         AWAIT sendToBackground(MessageType.REMOVE_AGENT, { config: agent })
      
      4. this.agents = this.agents.filter(a => a.id !== agentId)
      5. AWAIT this.saveAgents()
      6. this.renderAgentList()
      7. EMIT custom event 'agents-updated'

  getProviderIcon(providerId: string) -> string:
    STEPS:
      1. icons = { openai: '🤖', anthropic: '🧠', google: '🔮' }
      2. RETURN icons[providerId] OR '❓'

  getAgentDisplayName(agent: AgentConfig) -> string:
    STEPS:
      1. model = MODEL_OPTIONS[agent.providerId].find(m => m.id === agent.model)
      2. RETURN model?.displayName OR agent.model

  getAgentCutoff(agent: AgentConfig) -> string:
    STEPS:
      1. model = MODEL_OPTIONS[agent.providerId].find(m => m.id === agent.model)
      2. RETURN model?.knowledgeCutoff OR 'Unknown'

CONST MODEL_OPTIONS = {
  openai: [
    { id: 'gpt-4o', displayName: 'GPT-4o', knowledgeCutoff: 'Oct 2023', qualityRank: 100 },
    { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', knowledgeCutoff: 'Oct 2023', qualityRank: 80 },
    { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', knowledgeCutoff: 'Dec 2023', qualityRank: 95 }
  ],
  anthropic: [
    { id: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', knowledgeCutoff: 'Aug 2023', qualityRank: 98 },
    { id: 'claude-3-sonnet-20240229', displayName: 'Claude 3 Sonnet', knowledgeCutoff: 'Aug 2023', qualityRank: 85 },
    { id: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', knowledgeCutoff: 'Aug 2023', qualityRank: 70 }
  ],
  google: [
    { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', knowledgeCutoff: 'Nov 2023', qualityRank: 90 },
    { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', knowledgeCutoff: 'Nov 2023', qualityRank: 75 }
  ]
}

EXPORT AgentManager, MODEL_OPTIONS
```

MODULE CryptoUtils:
DESCRIPTION: Web Crypto API encryption utilities for API key storage

FILE: /src/utils/crypto.js

```
PRIVATE KEY_NAME = 'truthseek_encryption_key'

ASYNC FUNCTION deriveKey() -> CryptoKey:
  INPUT: none
  OUTPUT: CryptoKey
  STEPS:
    1. // Check for existing key
       stored = AWAIT chrome.storage.local.get(KEY_NAME)
       IF stored[KEY_NAME]:
         // Import stored key
         keyData = base64ToArrayBuffer(stored[KEY_NAME])
         RETURN AWAIT crypto.subtle.importKey(
           'raw',
           keyData,
           { name: 'AES-GCM' },
           false,
           ['encrypt', 'decrypt']
         )
    
    2. // Generate new key
       key = AWAIT crypto.subtle.generateKey(
         { name: 'AES-GCM', length: 256 },
         true,
         ['encrypt', 'decrypt']
       )
    
    3. // Export and store
       exported = AWAIT crypto.subtle.exportKey('raw', key)
       AWAIT chrome.storage.local.set({
         [KEY_NAME]: arrayBufferToBase64(exported)
       })
    
    4. RETURN key

ASYNC FUNCTION encrypt(plaintext: string) -> string:
  INPUT:
    - plaintext: string to encrypt
  OUTPUT:
    - encrypted string (base64)
  STEPS:
    1. key = AWAIT deriveKey()
    2. iv = crypto.getRandomValues(new Uint8Array(12))
    3. encoded = new TextEncoder().encode(plaintext)
    
    4. ciphertext = AWAIT crypto.subtle.encrypt(
         { name: 'AES-GCM', iv: iv },
         key,
         encoded
       )
    
    5. // Combine IV + ciphertext
       combined = new Uint8Array(iv.length + ciphertext.byteLength)
       combined.set(iv, 0)
       combined.set(new Uint8Array(ciphertext), iv.length)
    
    6. RETURN arrayBufferToBase64(combined.buffer)

ASYNC FUNCTION decrypt(encrypted: string) -> string:
  INPUT:
    - encrypted: base64 encrypted string
  OUTPUT:
    - decrypted plaintext
  STEPS:
    1. key = AWAIT deriveKey()
    2. combined = base64ToArrayBuffer(encrypted)
    3. combinedArray = new Uint8Array(combined)
    
    4. // Extract IV and ciphertext
       iv = combinedArray.slice(0, 12)
       ciphertext = combinedArray.slice(12)
    
    5. decrypted = AWAIT crypto.subtle.decrypt(
         { name: 'AES-GCM', iv: iv },
         key,
         ciphertext
       )
    
    6. RETURN new TextDecoder().decode(decrypted)

FUNCTION arrayBufferToBase64(buffer: ArrayBuffer) -> string:
  STEPS:
    1. bytes = new Uint8Array(buffer)
    2. binary = String.fromCharCode.apply(null, bytes)
    3. RETURN btoa(binary)

FUNCTION base64ToArrayBuffer(base64: string) -> ArrayBuffer:
  STEPS:
    1. binary = atob(base64)
    2. bytes = new Uint8Array(binary.length)
    3. FOR i = 0 TO binary.length:
         bytes[i] = binary.charCodeAt(i)
    4. RETURN bytes.buffer

EXPORT encrypt, decrypt
```

---

### Epic 3: Fact Extraction Engine

#### Story 3.1: HTML Content Extraction

MODULE ContentExtractor:
DESCRIPTION: Extracts meaningful text from webpage DOM with sentence tracking

FILE: /src/content/extractor.js

```
CONST MAX_CONTENT_SIZE = 100 * 1024  // 100KB
CONST EXCLUDED_TAGS = ['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'ASIDE', 'HEADER', 'NOSCRIPT', 'IFRAME']

FUNCTION extractPageContent() -> ExtractedContent:
  INPUT: none (operates on current document)
  OUTPUT: ExtractedContent
  STEPS:
    1. WAIT for document ready:
         IF document.readyState !== 'complete':
           AWAIT new Promise(resolve => window.addEventListener('load', resolve))
         // Additional delay for dynamic content
         AWAIT sleep(2000)
    
    2. sentences = []
    3. totalCharacters = 0
    4. truncated = false
    
    5. // Walk the DOM tree
       walker = document.createTreeWalker(
         document.body,
         NodeFilter.SHOW_TEXT,
         {
           acceptNode: (node) => {
             IF shouldExcludeNode(node):
               RETURN NodeFilter.FILTER_REJECT
             RETURN NodeFilter.FILTER_ACCEPT
           }
         }
       )
    
    6. currentNode = walker.nextNode()
       WHILE currentNode:
         text = currentNode.textContent.trim()
         IF text.length > 0:
           // Split into sentences
           nodeSentences = splitIntoSentences(text)
           xpath = getXPath(currentNode)
           
           FOR each sentenceText IN nodeSentences:
             IF totalCharacters + sentenceText.length > MAX_CONTENT_SIZE:
               truncated = true
               BREAK outer loop
             
             sentence = {
               id: "s-" + sentences.length.toString().padStart(4, '0'),
               text: sanitizeText(sentenceText),
               xpath: xpath
             }
             sentences.push(sentence)
             totalCharacters += sentenceText.length
         
         currentNode = walker.nextNode()
    
    7. RETURN {
         sentences: sentences,
         truncated: truncated,
         totalCharacters: totalCharacters
       }

FUNCTION shouldExcludeNode(node: Node) -> boolean:
  INPUT:
    - node: DOM node
  OUTPUT:
    - boolean
  STEPS:
    1. parent = node.parentElement
    2. WHILE parent:
         IF EXCLUDED_TAGS.includes(parent.tagName):
           RETURN true
         IF parent.getAttribute('aria-hidden') === 'true':
           RETURN true
         IF parent.style.display === 'none':
           RETURN true
         IF parent.style.visibility === 'hidden':
           RETURN true
         parent = parent.parentElement
    3. RETURN false

FUNCTION splitIntoSentences(text: string) -> string[]:
  INPUT:
    - text: paragraph or text block
  OUTPUT:
    - array of sentences
  STEPS:
    1. // Use Intl.Segmenter if available
       IF typeof Intl.Segmenter !== 'undefined':
         segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
         segments = Array.from(segmenter.segment(text))
         RETURN segments.map(s => s.segment.trim()).filter(s => s.length > 0)
    
    2. // Fallback: regex-based splitting
       // Handle common abbreviations
       normalized = text
         .replace(/Mr\./g, 'Mr')
         .replace(/Mrs\./g, 'Mrs')
         .replace(/Dr\./g, 'Dr')
         .replace(/vs\./g, 'vs')
         .replace(/etc\./g, 'etc')
         .replace(/e\.g\./g, 'eg')
         .replace(/i\.e\./g, 'ie')
       
       sentences = normalized.split(/(?<=[.!?])\s+/)
       RETURN sentences.map(s => s.trim()).filter(s => s.length > 10)

FUNCTION getXPath(node: Node) -> string:
  INPUT:
    - node: DOM node
  OUTPUT:
    - XPath string
  STEPS:
    1. parts = []
    2. current = node
    
    3. WHILE current AND current.nodeType !== Node.DOCUMENT_NODE:
         IF current.nodeType === Node.ELEMENT_NODE:
           tagName = current.tagName.toLowerCase()
           siblings = Array.from(current.parentNode?.children OR [])
             .filter(el => el.tagName === current.tagName)
           IF siblings.length > 1:
             index = siblings.indexOf(current) + 1
             parts.unshift(tagName + '[' + index + ']')
           ELSE:
             parts.unshift(tagName)
         ELSE IF current.nodeType === Node.TEXT_NODE:
           textNodes = Array.from(current.parentNode?.childNodes OR [])
             .filter(n => n.nodeType === Node.TEXT_NODE)
           IF textNodes.length > 1:
             index = textNodes.indexOf(current) + 1
             parts.unshift('text()[' + index + ']')
           ELSE:
             parts.unshift('text()')
         
         current = current.parentNode
    
    4. RETURN '//' + parts.join('/')

FUNCTION sanitizeText(text: string) -> string:
  INPUT:
    - text: raw text
  OUTPUT:
    - sanitized text
  STEPS:
    1. RETURN text
         .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Control chars
         .replace(/\s+/g, ' ')  // Normalize whitespace
         .trim()

EXPORT extractPageContent
```

---

#### Story 3.2: Fact Extraction Prompt Engineering

MODULE ExtractionPrompts:
DESCRIPTION: Optimized prompts for fact extraction across AI providers

FILE: /src/ai/prompts/extraction.js

```
IMPORT { CATEGORIES } from '../../config/categories.js'

FUNCTION buildExtractionPrompt(content: ExtractedContent, categories: FactCategory[]) -> { system: string, user: string }:
  INPUT:
    - content: ExtractedContent with sentences
    - categories: valid category enum values
  OUTPUT:
    - { system, user } prompt strings
  STEPS:
    1. system = `You are a fact extraction specialist. Your task is to identify verifiable factual claims from text.

RULES:
1. Extract ONLY objectively verifiable facts - claims that can be confirmed or refuted with evidence
2. Include both explicit facts (directly stated) and implicit facts (clearly implied)
3. EXCLUDE: opinions, predictions, subjective assessments, definitions without claims
4. For each fact, provide:
   - originalText: the exact text from the source
   - searchableText: rephrased as a search-friendly statement
   - category: one of the defined categories
   - sentenceId: the source sentence ID

CATEGORIES:
${categories.map(c => '- ' + c + ': ' + CATEGORIES[c].description).join('\n')}

OUTPUT FORMAT (JSON):
{
  "facts": [
    {
      "originalText": "exact quote from source",
      "searchableText": "rephrased for search",
      "category": "CATEGORY_NAME",
      "sentenceId": "s-0001"
    }
  ]
}

EXAMPLES:

Input sentence (s-0001): "The Eiffel Tower, completed in 1889, stands 330 meters tall."
Output:
{
  "facts": [
    {
      "originalText": "completed in 1889",
      "searchableText": "Eiffel Tower construction completed 1889",
      "category": "HISTORICAL_EVENT",
      "sentenceId": "s-0001"
    },
    {
      "originalText": "stands 330 meters tall",
      "searchableText": "Eiffel Tower height 330 meters",
      "category": "STATISTICAL_QUANTITATIVE",
      "sentenceId": "s-0001"
    }
  ]
}

Input sentence (s-0002): "Many experts believe AI will transform healthcare."
Output:
{
  "facts": []
}
// This is an opinion/prediction, not a verifiable fact

Input sentence (s-0003): "According to the CDC, approximately 38 million Americans have diabetes."
Output:
{
  "facts": [
    {
      "originalText": "approximately 38 million Americans have diabetes",
      "searchableText": "CDC diabetes statistics 38 million Americans",
      "category": "STATISTICAL_QUANTITATIVE",
      "sentenceId": "s-0003"
    }
  ]
}`

    2. // Build user prompt with all sentences
       sentenceList = content.sentences
         .map(s => `[${s.id}] ${s.text}`)
         .join('\n')
       
       user = `Extract all verifiable facts from the following sentences. Respond with valid JSON only.

SENTENCES:
${sentenceList}

${content.truncated ? '\nNOTE: Content was truncated due to length. Extract facts from available text.' : ''}`

    3. RETURN { system, user }

EXPORT buildExtractionPrompt
```

---

#### Story 3.3: Multi-Agent Fact Extraction Orchestration

MODULE ExtractionOrchestrator:
DESCRIPTION: Coordinates parallel fact extraction across all configured AI agents

FILE: /src/background/extraction-orchestrator.js

```
IMPORT { CATEGORIES } from '../config/categories.js'
IMPORT { sendToTab } from './messaging.js'
IMPORT { MessageType } from '../shared/message-types.js'

CONST EXTRACTION_TIMEOUT = 60000  // 60 seconds

ASYNC FUNCTION extractFromAllAgents(content: ExtractedContent, agents: AIProvider[], tabId: number) -> RawExtractionResults[]:
  INPUT:
    - content: ExtractedContent from page
    - agents: array of configured AI provider instances
    - tabId: tab to send progress updates
  OUTPUT:
    - array of RawExtractionResults
  STEPS:
    1. results = []
    2. categories = Object.keys(CATEGORIES)
    
    3. // Create extraction promises with timeout
       promises = agents.map(agent => {
         RETURN extractWithTimeout(agent, content, categories)
       })
    
    4. // Execute in parallel
       settled = AWAIT Promise.allSettled(promises)
    
    5. // Process results
       FOR i = 0 TO settled.length:
         result = settled[i]
         agent = agents[i]
         
         IF result.status === 'fulfilled':
           results.push({
             agentId: agent.config.id,
             facts: result.value.facts,
             success: result.value.success,
             error: result.value.error
           })
           
           // Send progress update
           AWAIT sendToTab(tabId, {
             type: MessageType.EXTRACTION_PROGRESS,
             payload: {
               agentId: agent.config.id,
               agentName: agent.getProviderInfo().modelDisplayName,
               factsCount: result.value.facts.length,
               status: 'complete'
             }
           })
         ELSE:
           // Handle timeout or error
           results.push({
             agentId: agent.config.id,
             facts: [],
             success: false,
             error: result.reason?.message OR 'Extraction failed'
           })
           
           AWAIT sendToTab(tabId, {
             type: MessageType.EXTRACTION_PROGRESS,
             payload: {
               agentId: agent.config.id,
               agentName: agent.getProviderInfo().modelDisplayName,
               factsCount: 0,
               status: 'failed',
               error: result.reason?.message
             }
           })
    
    6. RETURN results

ASYNC FUNCTION extractWithTimeout(agent: AIProvider, content: ExtractedContent, categories: FactCategory[]) -> ExtractionResult:
  INPUT:
    - agent: AI provider instance
    - content: page content
    - categories: valid categories
  OUTPUT:
    - ExtractionResult
  STEPS:
    1. RETURN Promise.race([
         agent.extractFacts(content, categories),
         new Promise((_, reject) => {
           setTimeout(() => reject(new Error('Extraction timeout')), EXTRACTION_TIMEOUT)
         })
       ])

EXPORT extractFromAllAgents
```

---

#### Story 3.4: Fact Deduplication Engine

MODULE DeduplicationEngine:
DESCRIPTION: Removes duplicate and semantically equivalent facts with model-quality tiebreaking

FILE: /src/background/deduplication.js

```
IMPORT { MODEL_RANKINGS } from '../config/model-rankings.js'

FUNCTION deduplicate(rawResults: RawExtractionResults[]) -> Fact[]:
  INPUT:
    - rawResults: extraction results from all agents
  OUTPUT:
    - deduplicated Fact array
  STEPS:
    1. // Flatten all facts
       allFacts = []
       FOR each result IN rawResults:
         FOR each fact IN result.facts:
           allFacts.push({
             ...fact,
             agentId: result.agentId,
             agentRank: getAgentRank(result.agentId)
           })
    
    2. // Group by exact normalized text match
       exactGroups = groupByExactMatch(allFacts)
    
    3. // Find semantic matches across remaining facts
       semanticGroups = findSemanticMatches(exactGroups)
    
    4. // Select best version from each group
       deduplicated = []
       FOR each group IN semanticGroups:
         best = selectBestVersion(group)
         // Merge provenance
         best.provenance = [...new Set(group.map(f => f.agentId))]
         deduplicated.push(best)
    
    5. // Assign new sequential IDs
       FOR i = 0 TO deduplicated.length:
         deduplicated[i].id = "f-" + i.toString().padStart(4, '0')
    
    6. RETURN deduplicated

FUNCTION groupByExactMatch(facts: Fact[]) -> Fact[][]:
  INPUT:
    - facts: all extracted facts
  OUTPUT:
    - array of fact groups
  STEPS:
    1. groups = new Map<string, Fact[]>()
    
    2. FOR each fact IN facts:
         key = normalizeText(fact.originalText)
         IF NOT groups.has(key):
           groups.set(key, [])
         groups.get(key).push(fact)
    
    3. RETURN Array.from(groups.values())

FUNCTION normalizeText(text: string) -> string:
  INPUT:
    - text: original text
  OUTPUT:
    - normalized text for comparison
  STEPS:
    1. RETURN text
         .toLowerCase()
         .replace(/[^\w\s]/g, '')  // Remove punctuation
         .replace(/\s+/g, ' ')      // Normalize whitespace
         .trim()

FUNCTION findSemanticMatches(exactGroups: Fact[][]) -> Fact[][]:
  INPUT:
    - exactGroups: groups from exact matching
  OUTPUT:
    - merged groups including semantic matches
  STEPS:
    1. // For each group, check if it should merge with others
       finalGroups = []
       processed = new Set<number>()
    
    2. FOR i = 0 TO exactGroups.length:
         IF processed.has(i):
           CONTINUE
         
         currentGroup = [...exactGroups[i]]
         processed.add(i)
         
         FOR j = i + 1 TO exactGroups.length:
           IF processed.has(j):
             CONTINUE
           
           // Compare representative facts
           similarity = calculateSimilarity(
             currentGroup[0].searchableText,
             exactGroups[j][0].searchableText
           )
           
           IF similarity >= 0.9:
             // Merge groups
             currentGroup.push(...exactGroups[j])
             processed.add(j)
         
         finalGroups.push(currentGroup)
    
    3. RETURN finalGroups

FUNCTION calculateSimilarity(text1: string, text2: string) -> number:
  INPUT:
    - text1: first text
    - text2: second text
  OUTPUT:
    - similarity score 0-1
  STEPS:
    1. // Jaccard similarity on word tokens
       words1 = new Set(normalizeText(text1).split(' '))
       words2 = new Set(normalizeText(text2).split(' '))
    
    2. intersection = new Set([...words1].filter(w => words2.has(w)))
       union = new Set([...words1, ...words2])
    
    3. IF union.size === 0:
         RETURN 0
    
    4. RETURN intersection.size / union.size

FUNCTION selectBestVersion(candidates: Fact[]) -> Fact:
  INPUT:
    - candidates: facts to choose from
  OUTPUT:
    - best fact version
  STEPS:
    1. // Sort by model quality rank (descending)
       sorted = candidates.sort((a, b) => b.agentRank - a.agentRank)
    
    2. // If tied on rank, prefer longer/more specific searchableText
       topRank = sorted[0].agentRank
       topCandidates = sorted.filter(f => f.agentRank === topRank)
    
    3. IF topCandidates.length === 1:
         RETURN topCandidates[0]
    
    4. // Tiebreak: prefer longer searchableText (more specific)
       RETURN topCandidates.sort((a, b) => 
         b.searchableText.length - a.searchableText.length
       )[0]

FUNCTION getAgentRank(agentId: string) -> number:
  INPUT:
    - agentId: agent config ID
  OUTPUT:
    - quality rank number
  STEPS:
    1. // Load agent config from storage
       stored = chrome.storage.local.get("agents")
       agent = stored.agents?.find(a => a.id === agentId)
    2. RETURN agent?.qualityRank OR 0

EXPORT deduplicate
```

---

#### Story 3.5: Fact Categorization Validation

MODULE CategorizationValidator:
DESCRIPTION: Validates and corrects fact category assignments

FILE: /src/background/categorization.js

```
IMPORT { CATEGORIES, VALID_CATEGORIES } from '../config/categories.js'

FUNCTION validateAndCorrectCategories(facts: Fact[]) -> Fact[]:
  INPUT:
    - facts: deduplicated facts
  OUTPUT:
    - facts with validated/corrected categories
  STEPS:
    1. validated = []
    
    2. FOR each fact IN facts:
         IF VALID_CATEGORIES.includes(fact.category):
           validated.push(fact)
         ELSE:
           // Attempt re-categorization
           corrected = recategorize(fact)
           validated.push(corrected)
    
    3. RETURN validated

FUNCTION recategorize(fact: Fact) -> Fact:
  INPUT:
    - fact: fact with invalid/missing category
  OUTPUT:
    - fact with corrected category
  STEPS:
    1. // Use keyword-based heuristics for quick re-categorization
       text = (fact.originalText + ' ' + fact.searchableText).toLowerCase()
    
    2. // Check for category indicators
       IF containsAny(text, ['percent', '%', 'million', 'billion', 'number', 'rate', 'average']):
         fact.category = 'STATISTICAL_QUANTITATIVE'
       ELSE IF containsAny(text, ['law', 'regulation', 'court', 'legal', 'ruling', 'statute']):
         fact.category = 'LEGAL_REGULATORY'
       ELSE IF containsAny(text, ['study', 'research', 'experiment', 'theory', 'hypothesis']):
         fact.category = 'SCIENTIFIC_TECHNICAL'
       ELSE IF containsAny(text, ['disease', 'treatment', 'symptom', 'patient', 'drug', 'medical']):
         fact.category = 'MEDICAL_BIOLOGICAL'
       ELSE IF containsAny(text, ['war', 'founded', 'century', 'ancient', 'historical']):
         fact.category = 'HISTORICAL_EVENT'
       ELSE IF containsAny(text, ['country', 'government', 'political', 'population', 'nation']):
         fact.category = 'GEOPOLITICAL_SOCIAL'
       ELSE IF containsAny(text, ['said', 'stated', 'according to', 'quote', 'claimed']):
         fact.category = 'ATTRIBUTION_QUOTE'
       ELSE IF containsAny(text, ['causes', 'leads to', 'results in', 'because', 'effect']):
         fact.category = 'CAUSAL_RELATIONAL'
       ELSE:
         fact.category = 'DEFINITIONAL_ATTRIBUTE'  // Default fallback
    
    3. RETURN fact

FUNCTION containsAny(text: string, keywords: string[]) -> boolean:
  INPUT:
    - text: text to search
    - keywords: keywords to find
  OUTPUT:
    - boolean
  STEPS:
    1. RETURN keywords.some(kw => text.includes(kw))

EXPORT validateAndCorrectCategories
```

FILE: /src/config/categories.js

```
CONST CATEGORIES = {
  HISTORICAL_EVENT: {
    description: "Events that occurred at specific points in time (wars, discoveries, founding dates)"
  },
  STATISTICAL_QUANTITATIVE: {
    description: "Numerical claims, percentages, measurements, counts"
  },
  DEFINITIONAL_ATTRIBUTE: {
    description: "Factual attributes or properties of entities (location, composition, characteristics)"
  },
  SCIENTIFIC_TECHNICAL: {
    description: "Scientific facts, technical specifications, research findings"
  },
  MEDICAL_BIOLOGICAL: {
    description: "Health-related facts, biological processes, medical information"
  },
  LEGAL_REGULATORY: {
    description: "Laws, regulations, legal rulings, compliance requirements"
  },
  GEOPOLITICAL_SOCIAL: {
    description: "Political boundaries, demographics, social structures, international relations"
  },
  ATTRIBUTION_QUOTE: {
    description: "Statements attributed to specific people or organizations"
  },
  CAUSAL_RELATIONAL: {
    description: "Cause-and-effect relationships, correlations, dependencies"
  }
}

CONST VALID_CATEGORIES = Object.keys(CATEGORIES)

EXPORT CATEGORIES, VALID_CATEGORIES
```

---

### Epic 4: Live Web Search Verification Engine

#### Story 4.1: Live Web Search Integration

MODULE SearchEngine:
DESCRIPTION: Performs live web searches for fact verification

FILE: /src/background/search.js

```
IMPORT { buildSearchQuery } from './search-strategies.js'
IMPORT { validateUrl } from './url-validator.js'

ASYNC FUNCTION performLiveSearch(fact: Fact, category: FactCategory, isRefuting: boolean = false) -> Source[]:
  INPUT:
    - fact: Fact to search for
    - category: fact category for query optimization
    - isRefuting: whether to search for refuting evidence
  OUTPUT:
    - array of validated Source objects (1-3 sources)
  STEPS:
    1. // Build optimized search query
       query = buildSearchQuery(fact.searchableText, category, isRefuting)
    
    2. // Search will be performed by AI provider's native search tool
       // This function prepares the query and processes results
       RETURN {
         query: query,
         timestamp: Date.now()
       }

FUNCTION processSearchResults(rawResults: object[], fact: Fact) -> Promise<Source[]>:
  INPUT:
    - rawResults: raw search results from AI provider
    - fact: fact being verified (for relevance check)
  OUTPUT:
    - validated Source array
  STEPS:
    1. sources = []
    
    2. FOR each result IN rawResults:
         IF sources.length >= 3:
           BREAK  // Max 3 sources per fact
         
         // Validate URL
         validation = AWAIT validateUrl(result.url, fact.originalText)
         
         IF validation.valid:
           source = {
             url: validation.url,
             title: result.title OR '',
             snippet: result.snippet OR '',
             domain: extractDomain(result.url),
             tier: 0,  // Will be assigned by source-tiering
             isSupporting: true,  // Will be set by caller
             validatedAt: Date.now()
           }
           sources.push(source)
    
    3. RETURN sources

FUNCTION extractDomain(url: string) -> string:
  INPUT:
    - url: full URL
  OUTPUT:
    - domain string
  STEPS:
    1. TRY:
         parsed = new URL(url)
         RETURN parsed.hostname
       CATCH:
         RETURN ''

EXPORT performLiveSearch, processSearchResults
```

---

#### Story 4.2: Search Query Optimization by Category

MODULE SearchStrategies:
DESCRIPTION: Category-specific search query optimization (static strategies)

FILE: /src/background/search-strategies.js

```
CONST CURRENT_YEAR = new Date().getFullYear()

FUNCTION buildSearchQuery(searchableText: string, category: FactCategory, isRefuting: boolean) -> string:
  INPUT:
    - searchableText: fact's searchable text
    - category: fact category
    - isRefuting: whether to add refuting qualifiers
  OUTPUT:
    - optimized search query string
  STEPS:
    1. baseQuery = searchableText
    
    2. // Apply category-specific enhancements
       SWITCH category:
         CASE 'MEDICAL_BIOLOGICAL':
           baseQuery = baseQuery + ' site:nih.gov OR site:cdc.gov OR site:pubmed.ncbi.nlm.nih.gov OR site:mayoclinic.org'
         
         CASE 'LEGAL_REGULATORY':
           baseQuery = baseQuery + ' site:*.gov OR "court ruling" OR "legal" OR "regulation"'
         
         CASE 'STATISTICAL_QUANTITATIVE':
           baseQuery = baseQuery + ' "official statistics" OR site:census.gov OR site:bls.gov OR "data"'
         
         CASE 'SCIENTIFIC_TECHNICAL':
           baseQuery = baseQuery + ' "peer-reviewed" OR "journal" OR "study" OR site:*.edu'
         
         CASE 'HISTORICAL_EVENT':
           // Determine if past historical or current event
           IF isCurrentEvent(searchableText):
             baseQuery = baseQuery + ' ' + CURRENT_YEAR + ' OR ' + (CURRENT_YEAR - 1) + ' current recent'
           ELSE:
             years = extractYears(searchableText)
             IF years.length > 0:
               baseQuery = baseQuery + ' ' + years.join(' ')
         
         CASE 'GEOPOLITICAL_SOCIAL':
           // Check for current positions/roles
           IF containsCurrentIndicator(searchableText):
             baseQuery = baseQuery + ' ' + CURRENT_YEAR + ' current'
         
         DEFAULT:
           // Use searchable text as-is
           PASS
    
    3. // Add refuting qualifiers if needed
       IF isRefuting:
         baseQuery = baseQuery + ' false OR debunked OR incorrect OR "not true" OR misleading'
    
    4. RETURN baseQuery

FUNCTION isCurrentEvent(text: string) -> boolean:
  INPUT:
    - text: searchable text
  OUTPUT:
    - boolean
  STEPS:
    1. currentIndicators = ['current', 'now', 'today', 'presently', 'currently', 'recent']
    2. lowered = text.toLowerCase()
    
    3. // Check for current indicators
       IF currentIndicators.some(ind => lowered.includes(ind)):
         RETURN true
    
    4. // Check for recent years (within last 2 years)
       years = extractYears(text)
       IF years.some(y => y >= CURRENT_YEAR - 2):
         RETURN true
    
    5. RETURN false

FUNCTION extractYears(text: string) -> number[]:
  INPUT:
    - text: text to extract years from
  OUTPUT:
    - array of year numbers
  STEPS:
    1. matches = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) OR []
    2. RETURN matches.map(m => parseInt(m))

FUNCTION containsCurrentIndicator(text: string) -> boolean:
  INPUT:
    - text: text to check
  OUTPUT:
    - boolean
  STEPS:
    1. indicators = ['president', 'secretary', 'ceo', 'chairman', 'director', 'leader', 'head of']
    2. lowered = text.toLowerCase()
    3. RETURN indicators.some(ind => lowered.includes(ind))

EXPORT buildSearchQuery
```

---

#### Story 4.3: URL Validation & Anti-Hallucination

MODULE URLValidator:
DESCRIPTION: Validates URLs are real, accessible, and contain relevant content

FILE: /src/background/url-validator.js

```
CONST TIMEOUT_MS = 10000
CONST MAX_REDIRECTS = 3

CONST SOFT_404_PATTERNS = [
  /page\s*(not|wasn't)\s*found/i,
  /404\s*(error|not found)?/i,
  /not\s*found/i,
  /doesn't\s*exist/i,
  /no\s*(longer|results)\s*(available|found)?/i,
  /content\s*(is\s*)?(unavailable|not available)/i,
  /we\s*couldn't\s*find/i,
  /this\s*page\s*(has\s*been|was)\s*(removed|deleted)/i
]

ASYNC FUNCTION validateUrl(url: string, factText: string) -> ValidationResult:
  INPUT:
    - url: URL to validate
    - factText: fact text for relevance checking
  OUTPUT:
    - ValidationResult
  STEPS:
    1. // === EARLY EXIT PHASE ===
       
       // Attempt fetch with timeout
       TRY:
         controller = new AbortController()
         timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
         
         response = AWAIT fetch(url, {
           method: 'GET',
           redirect: 'follow',
           signal: controller.signal,
           headers: {
             'User-Agent': 'TruthSeek/1.0 Fact-Checker'
           }
         })
         
         clearTimeout(timeoutId)
       CATCH error:
         IF error.name === 'AbortError':
           RETURN { valid: false, url: url, reason: 'Timeout', relevanceScore: null, redirectCount: null }
         RETURN { valid: false, url: url, reason: 'Network error: ' + error.message, relevanceScore: null, redirectCount: null }
    
    2. // Check HTTP status - EARLY EXIT on error
       IF response.status >= 400:
         RETURN { valid: false, url: url, reason: 'HTTP ' + response.status, relevanceScore: null, redirectCount: null }
    
    3. // Check redirect count - EARLY EXIT if too many
       redirectCount = countRedirects(response)
       IF redirectCount > MAX_REDIRECTS:
         RETURN { valid: false, url: url, reason: 'Too many redirects (' + redirectCount + ')', relevanceScore: null, redirectCount: redirectCount }
    
    4. // === COMBINED ANALYSIS PHASE ===
       
       // Get response body
       body = AWAIT response.text()
       bodyLower = body.toLowerCase()
    
    5. // Extract key terms from fact
       keyTerms = extractKeyTerms(factText)
    
    6. // Calculate relevance score
       relevanceScore = calculateRelevance(keyTerms, bodyLower)
    
    7. // Check for soft-404 patterns
       hasSoft404 = checkSoft404Patterns(bodyLower)
    
    8. // === DECISION LOGIC ===
       
       // High relevance (≥60%): VALID regardless of soft-404
       IF relevanceScore >= 60:
         RETURN {
           valid: true,
           url: response.url,  // Use final URL after redirects
           reason: null,
           relevanceScore: relevanceScore,
           redirectCount: redirectCount
         }
    
    9. // Low relevance (<60%) AND soft-404: INVALID
       IF relevanceScore < 60 AND hasSoft404:
         RETURN {
           valid: false,
           url: url,
           reason: 'Soft 404 detected',
           relevanceScore: relevanceScore,
           redirectCount: redirectCount
         }
    
    10. // Very low relevance (<40%): INVALID
        IF relevanceScore < 40:
          RETURN {
            valid: false,
            url: url,
            reason: 'Content not relevant',
            relevanceScore: relevanceScore,
            redirectCount: redirectCount
          }
    
    11. // Marginal relevance (40-59%) with no soft-404: VALID
        RETURN {
          valid: true,
          url: response.url,
          reason: null,
          relevanceScore: relevanceScore,
          redirectCount: redirectCount
        }

FUNCTION extractKeyTerms(factText: string) -> string[]:
  INPUT:
    - factText: fact text
  OUTPUT:
    - array of key terms
  STEPS:
    1. // Remove common stop words
       stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
                           'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                           'would', 'could', 'should', 'may', 'might', 'must', 'shall',
                           'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
                           'as', 'into', 'through', 'during', 'before', 'after', 'above',
                           'below', 'between', 'under', 'that', 'this', 'which', 'who',
                           'whom', 'whose', 'what', 'where', 'when', 'why', 'how', 'and',
                           'or', 'but', 'not', 'no', 'yes', 'it', 'its'])
    
    2. // Tokenize and filter
       words = factText.toLowerCase()
         .replace(/[^\w\s]/g, ' ')
         .split(/\s+/)
         .filter(w => w.length > 2 AND NOT stopWords.has(w))
    
    3. // Also extract numbers
       numbers = factText.match(/\d+(\.\d+)?/g) OR []
    
    4. RETURN [...new Set([...words, ...numbers])]

FUNCTION calculateRelevance(keyTerms: string[], bodyLower: string) -> number:
  INPUT:
    - keyTerms: key terms from fact
    - bodyLower: lowercase page body
  OUTPUT:
    - relevance percentage 0-100
  STEPS:
    1. IF keyTerms.length === 0:
         RETURN 0
    
    2. foundCount = keyTerms.filter(term => bodyLower.includes(term.toLowerCase())).length
    
    3. RETURN Math.round((foundCount / keyTerms.length) * 100)

FUNCTION checkSoft404Patterns(bodyLower: string) -> boolean:
  INPUT:
    - bodyLower: lowercase page body
  OUTPUT:
    - boolean
  STEPS:
    1. // Only check first 5000 chars for performance
       checkText = bodyLower.substring(0, 5000)
    
    2. FOR each pattern IN SOFT_404_PATTERNS:
         IF pattern.test(checkText):
           RETURN true
    
    3. RETURN false

FUNCTION countRedirects(response: Response) -> number:
  INPUT:
    - response: fetch Response object
  OUTPUT:
    - redirect count
  STEPS:
    1. // response.redirected is boolean, but we need count
       // This is an approximation - actual count requires manual redirect following
       RETURN response.redirected ? 1 : 0

EXPORT validateUrl
```

---

#### Story 4.4: Source Credibility Assessment

MODULE SourceTiering:
DESCRIPTION: Assigns credibility tiers to sources based on domain and category

FILE: /src/background/source-tiering.js

```
IMPORT sourceTiers from '../config/source-tiers.json'

FUNCTION assignSourceTier(domain: string, category: FactCategory) -> number:
  INPUT:
    - domain: source domain
    - category: fact category
  OUTPUT:
    - tier number 1-4
  STEPS:
    1. // Check category-specific overrides first
       categoryOverrides = sourceTiers.categoryOverrides[category]
       IF categoryOverrides:
         FOR each mapping IN categoryOverrides:
           IF domainMatches(domain, mapping.pattern):
             RETURN mapping.tier
    
    2. // Check global defaults
       FOR each mapping IN sourceTiers.globalDefaults:
         IF domainMatches(domain, mapping.pattern):
           RETURN mapping.tier
    
    3. // Default to Tier 4 (unknown)
       RETURN 4

FUNCTION domainMatches(domain: string, pattern: string) -> boolean:
  INPUT:
    - domain: actual domain
    - pattern: pattern to match
  OUTPUT:
    - boolean
  STEPS:
    1. // Handle wildcard patterns
       IF pattern.startsWith('*.'):
         suffix = pattern.substring(1)  // Remove *
         RETURN domain.endsWith(suffix)
    
    2. // Exact match
       IF domain === pattern:
         RETURN true
    
    3. // Subdomain match (e.g., "www.nih.gov" matches "nih.gov")
       IF domain.endsWith('.' + pattern):
         RETURN true
    
    4. RETURN false

FUNCTION assignTiersToSources(sources: Source[], category: FactCategory) -> Source[]:
  INPUT:
    - sources: array of sources without tiers
    - category: fact category
  OUTPUT:
    - sources with tiers assigned
  STEPS:
    1. RETURN sources.map(source => ({
         ...source,
         tier: assignSourceTier(source.domain, category)
       }))

EXPORT assignSourceTier, assignTiersToSources
```

---

#### Story 4.5: Fact Verification via AI with Live Web Grounding

MODULE VerificationPrompts:
DESCRIPTION: Prompts that enforce grounding in live web search results

FILE: /src/ai/prompts/verification.js

```
FUNCTION buildVerificationPrompt(context: VerificationPromptContext) -> { system: string, user: string }:
  INPUT:
    - context: VerificationPromptContext
  OUTPUT:
    - { system, user }
  STEPS:
    1. system = `You are a fact verification specialist. Your ONLY job is to verify facts using the web search results provided.

CRITICAL RULES:
1. Base your assessment ONLY on the provided sources from web search
2. Do NOT use your training data or knowledge
3. You MUST cite specific sources (by URL) for every claim you make
4. If sources are insufficient or conflicting, verdict MUST be "UNVERIFIED"

CURRENT DATE: ${context.currentDate}
YOUR KNOWLEDGE CUTOFF: ${context.modelCutoffDate}

For facts about events after your knowledge cutoff, rely ENTIRELY on the search results.

OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE" | "FALSE" | "UNVERIFIED",
  "confidence": <0-100 based on source quality>,
  "reasoning": "<brief explanation in layman's terms>",
  "citedSources": [
    {
      "url": "<source URL>",
      "supports": true | false,
      "quote": "<relevant quote from source>"
    }
  ]
}

VERDICT GUIDELINES:
- TRUE: Multiple reliable sources confirm the fact
- FALSE: Reliable sources contradict the fact
- UNVERIFIED: Insufficient evidence, conflicting sources, or sources too unreliable`

    2. user = `FACT TO VERIFY:
"${context.fact.originalText}"

CATEGORY: ${context.category}

SUPPORTING SOURCES FOUND:
${formatSources(context.supportingSources)}

REFUTING SOURCES FOUND:
${formatSources(context.refutingSources)}

Based ONLY on these sources, verify the fact. Respond with valid JSON only.`

    3. RETURN { system, user }

FUNCTION formatSources(sources: Source[]) -> string:
  INPUT:
    - sources: array of sources
  OUTPUT:
    - formatted string
  STEPS:
    1. IF sources.length === 0:
         RETURN "No sources found."
    
    2. formatted = sources.map((s, i) => 
         `[${i + 1}] ${s.url}
Title: ${s.title}
Snippet: ${s.snippet}
Domain Tier: ${s.tier}`
       ).join('\n\n')
    
    3. RETURN formatted

EXPORT buildVerificationPrompt
```

---

#### Story 4.6: Dual-Direction Verification (Truth AND Falsity)

MODULE VerificationOrchestrator:
DESCRIPTION: Coordinates verification with both supporting and refuting searches

FILE: /src/background/verification-orchestrator.js

```
IMPORT { buildSearchQuery } from './search-strategies.js'
IMPORT { validateUrl } from './url-validator.js'
IMPORT { assignTiersToSources } from './source-tiering.js'
IMPORT { calculateConfidence } from './confidence-scoring.js'
IMPORT { buildVerificationPrompt } from '../ai/prompts/verification.js'

ASYNC FUNCTION verifyFact(fact: Fact, agent: AIProvider) -> VerificationResult:
  INPUT:
    - fact: Fact to verify
    - agent: AI provider to use
  OUTPUT:
    - VerificationResult
  STEPS:
    1. providerInfo = agent.getProviderInfo()
    2. currentDate = new Date().toISOString().split('T')[0]
    
    3. // Build context for verification
       context = {
         fact: fact,
         category: fact.category,
         currentDate: currentDate,
         modelCutoffDate: providerInfo.knowledgeCutoff,
         supportingSources: [],
         refutingSources: []
       }
    
    4. // Call AI with web search capability
       // The AI will perform searches and return results
       TRY:
         rawResult = AWAIT agent.verifyFactWithWebSearch(fact, fact.category)
         
         // Process and validate returned sources
         supportingSources = AWAIT processAndValidateSources(
           rawResult.sources.filter(s => s.isSupporting),
           fact
         )
         refutingSources = AWAIT processAndValidateSources(
           rawResult.sources.filter(s => NOT s.isSupporting),
           fact
         )
         
         // Assign tiers to validated sources
         supportingSources = assignTiersToSources(supportingSources, fact.category)
         refutingSources = assignTiersToSources(refutingSources, fact.category)
         
         // Calculate confidence with evidence-based caps
         hasVerifiedUrls = supportingSources.length > 0 OR refutingSources.length > 0
         confidenceResult = calculateConfidence(
           rawResult.verdict,
           rawResult.aiConfidence OR 0.5,
           supportingSources,
           refutingSources,
           hasVerifiedUrls
         )
         
         // Check for knowledge cutoff issues
         cutoffMessage = checkKnowledgeCutoff(fact, providerInfo, hasVerifiedUrls)
         
         RETURN {
           factId: fact.id,
           agentId: agent.config.id,
           verdict: rawResult.verdict,
           confidence: confidenceResult.score,
           confidenceCategory: confidenceResult.category,
           reasoning: rawResult.reasoning,
           sources: [...supportingSources, ...refutingSources],
           knowledgeCutoffMessage: cutoffMessage
         }
       CATCH error:
         RETURN {
           factId: fact.id,
           agentId: agent.config.id,
           verdict: 'UNVERIFIED',
           confidence: 0,
           confidenceCategory: 'low',
           reasoning: 'Verification failed: ' + error.message,
           sources: [],
           knowledgeCutoffMessage: null
         }

ASYNC FUNCTION processAndValidateSources(sources: Source[], fact: Fact) -> Source[]:
  INPUT:
    - sources: raw sources from AI
    - fact: fact for relevance check
  OUTPUT:
    - validated sources
  STEPS:
    1. validated = []
    
    2. FOR each source IN sources:
         IF validated.length >= 3:
           BREAK
         
         validation = AWAIT validateUrl(source.url, fact.originalText)
         IF validation.valid:
           validated.push({
             ...source,
             url: validation.url,
             validatedAt: Date.now()
           })
    
    3. RETURN validated

FUNCTION checkKnowledgeCutoff(fact: Fact, providerInfo: ProviderInfo, hasEvidence: boolean) -> string | null:
  INPUT:
    - fact: Fact being verified
    - providerInfo: AI provider info
    - hasEvidence: whether evidence was found
  OUTPUT:
    - user-friendly message or null
  STEPS:
    1. // Check if fact references recent events
       factYears = extractYears(fact.originalText)
       cutoffDate = providerInfo.knowledgeCutoffDate
       cutoffYear = cutoffDate.getFullYear()
    
    2. // Check if any referenced year is after cutoff
       hasRecentReference = factYears.some(y => y > cutoffYear)
       hasCurrentIndicator = /\b(current|now|today|presently)\b/i.test(fact.originalText)
    
    3. IF (hasRecentReference OR hasCurrentIndicator) AND NOT hasEvidence:
         RETURN `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${providerInfo.knowledgeCutoff}). We could not find sufficient current sources to verify it.`
    
    4. RETURN null

FUNCTION extractYears(text: string) -> number[]:
  STEPS:
    1. matches = text.match(/\b(20[0-2][0-9])\b/g) OR []
    2. RETURN matches.map(m => parseInt(m))

EXPORT verifyFact
```

---

#### Story 4.7: Confidence Score Calculation

MODULE ConfidenceScoring:
DESCRIPTION: Calculates confidence scores with Tier 1 fast-track and evidence caps

FILE: /src/background/confidence-scoring.js

```
CONST TIER_WEIGHTS = {
  supporting: { 1: 20, 2: 15, 3: 10, 4: 5 },
  refuting: { 1: 25, 2: 18, 3: 12, 4: 5 }
}

CONST CONFIDENCE_THRESHOLDS = {
  low: 60,
  medium: 85
}

CONST NO_EVIDENCE_CAP = 85

FUNCTION calculateConfidence(
  verdict: Verdict,
  aiConfidence: number,
  supportingSources: Source[],
  refutingSources: Source[],
  hasVerifiedUrls: boolean
) -> { score: number, category: string }:
  INPUT:
    - verdict: TRUE | FALSE | UNVERIFIED
    - aiConfidence: 0-1 confidence from AI
    - supportingSources: sources supporting the fact
    - refutingSources: sources refuting the fact
    - hasVerifiedUrls: whether any URLs were validated
  OUTPUT:
    - { score: 0-100, category: 'low'|'medium'|'high' }
  STEPS:
    1. // === TIER 1 FAST-TRACK CHECK ===
       IF verdict === 'TRUE' AND aiConfidence >= 0.8:
         tier1Supporting = supportingSources.filter(s => s.tier === 1)
         tier1to3Refuting = refutingSources.filter(s => s.tier <= 3)
         
         // Fast-track if no credible refutation and Tier 1 support exists
         IF tier1to3Refuting.length === 0 AND tier1Supporting.length > 0:
           IF tier1Supporting.length >= 3:
             RETURN { score: 100, category: 'high' }
           IF tier1Supporting.length === 2:
             RETURN { score: 95, category: 'high' }
           IF tier1Supporting.length === 1:
             RETURN { score: 90, category: 'high' }
    
    2. // === STANDARD CALCULATION ===
       score = 50  // Base score
    
    3. // Check if we have Tier 1-2 supporting sources
       hasTier1or2Support = supportingSources.some(s => s.tier <= 2)
    
    4. // Add points for supporting sources
       FOR each source IN supportingSources:
         score += TIER_WEIGHTS.supporting[source.tier]
    
    5. // Subtract points for refuting sources
       FOR each source IN refutingSources:
         // Skip Tier 4 refuting if we have Tier 1-2 support
         IF source.tier === 4 AND hasTier1or2Support:
           CONTINUE
         score -= TIER_WEIGHTS.refuting[source.tier]
    
    6. // Clamp to valid range
       score = Math.max(0, Math.min(100, score))
    
    7. // === APPLY EVIDENCE CAP ===
       IF NOT hasVerifiedUrls:
         score = Math.min(score, NO_EVIDENCE_CAP)
    
    8. // === CATEGORIZE ===
       category = categorizeScore(score)
    
    9. RETURN { score, category }

FUNCTION categorizeScore(score: number) -> string:
  INPUT:
    - score: 0-100
  OUTPUT:
    - 'low' | 'medium' | 'high'
  STEPS:
    1. IF score < CONFIDENCE_THRESHOLDS.low:
         RETURN 'low'
    2. IF score <= CONFIDENCE_THRESHOLDS.medium:
         RETURN 'medium'
    3. RETURN 'high'

EXPORT calculateConfidence, categorizeScore
```

---

#### Story 4.8: Multi-Agent Verification Aggregation

MODULE Aggregation:
DESCRIPTION: Aggregates verification results from multiple AI agents

FILE: /src/background/aggregation.js

```
FUNCTION aggregateResults(agentResults: VerificationResult[]) -> AggregatedResult:
  INPUT:
    - agentResults: array of results from different agents
  OUTPUT:
    - AggregatedResult
  STEPS:
    1. IF agentResults.length === 0:
         THROW "No results to aggregate"
    
    2. IF agentResults.length === 1:
         // Single agent - no aggregation needed
         result = agentResults[0]
         RETURN {
           factId: result.factId,
           aggregateVerdict: result.verdict,
           aggregateConfidence: result.confidence,
           aggregateConfidenceCategory: result.confidenceCategory,
           agentResults: agentResults,
           hasDisagreement: false,
           disagreementNote: null
         }
    
    3. // Count verdicts
       verdictCounts = {
         TRUE: agentResults.filter(r => r.verdict === 'TRUE').length,
         FALSE: agentResults.filter(r => r.verdict === 'FALSE').length,
         UNVERIFIED: agentResults.filter(r => r.verdict === 'UNVERIFIED').length
       }
    
    4. // Check for strong disagreement (TRUE vs FALSE)
       hasStrongDisagreement = verdictCounts.TRUE > 0 AND verdictCounts.FALSE > 0
    
    5. // Determine aggregate verdict
       aggregateVerdict = determineAggregateVerdict(verdictCounts, hasStrongDisagreement)
    
    6. // Calculate aggregate confidence
       confidences = agentResults.map(r => r.confidence)
       baseConfidence = average(confidences)
    
    7. // Apply disagreement penalty
       IF hasStrongDisagreement:
         aggregateConfidence = Math.max(0, baseConfidence - 20)
         disagreementNote = "Agents strongly disagree: some found TRUE, others FALSE"
       ELSE IF verdictCounts.UNVERIFIED > 0 AND (verdictCounts.TRUE > 0 OR verdictCounts.FALSE > 0):
         aggregateConfidence = Math.max(0, baseConfidence - 10)
         disagreementNote = "Some agents could not verify this fact"
       ELSE:
         aggregateConfidence = baseConfidence
         disagreementNote = null
    
    8. RETURN {
         factId: agentResults[0].factId,
         aggregateVerdict: aggregateVerdict,
         aggregateConfidence: Math.round(aggregateConfidence),
         aggregateConfidenceCategory: categorizeScore(aggregateConfidence),
         agentResults: agentResults,
         hasDisagreement: hasStrongDisagreement OR (disagreementNote !== null),
         disagreementNote: disagreementNote
       }

FUNCTION determineAggregateVerdict(verdictCounts: object, hasStrongDisagreement: boolean) -> Verdict:
  INPUT:
    - verdictCounts: { TRUE, FALSE, UNVERIFIED }
    - hasStrongDisagreement: boolean
  OUTPUT:
    - Verdict
  STEPS:
    1. // Strong disagreement always results in UNVERIFIED
       IF hasStrongDisagreement:
         RETURN 'UNVERIFIED'
    
    2. // Majority vote
       total = verdictCounts.TRUE + verdictCounts.FALSE + verdictCounts.UNVERIFIED
       
       IF verdictCounts.TRUE > total / 2:
         RETURN 'TRUE'
       IF verdictCounts.FALSE > total / 2:
         RETURN 'FALSE'
    
    3. // No clear majority - return UNVERIFIED
       RETURN 'UNVERIFIED'

FUNCTION average(numbers: number[]) -> number:
  INPUT:
    - numbers: array of numbers
  OUTPUT:
    - average
  STEPS:
    1. IF numbers.length === 0:
         RETURN 0
    2. RETURN numbers.reduce((a, b) => a + b, 0) / numbers.length

EXPORT aggregateResults
```

---

### Epic 5: Source Tier Management System

#### Story 5.1: Default Source Tier Configuration

MODULE SourceTierConfig:
DESCRIPTION: Static tier mappings for domains by category

FILE: /src/config/source-tiers.json

```
{
  "globalDefaults": [
    { "pattern": "*.gov", "tier": 1 },
    { "pattern": "*.edu", "tier": 1 },
    { "pattern": "nih.gov", "tier": 1 },
    { "pattern": "cdc.gov", "tier": 1 },
    { "pattern": "fda.gov", "tier": 1 },
    { "pattern": "who.int", "tier": 1 },
    { "pattern": "pubmed.ncbi.nlm.nih.gov", "tier": 1 },
    { "pattern": "nature.com", "tier": 1 },
    { "pattern": "science.org", "tier": 1 },
    { "pattern": "reuters.com", "tier": 2 },
    { "pattern": "apnews.com", "tier": 2 },
    { "pattern": "bbc.com", "tier": 2 },
    { "pattern": "nytimes.com", "tier": 2 },
    { "pattern": "washingtonpost.com", "tier": 2 },
    { "pattern": "theguardian.com", "tier": 2 },
    { "pattern": "wikipedia.org", "tier": 3 },
    { "pattern": "britannica.com", "tier": 2 },
    { "pattern": "snopes.com", "tier": 2 },
    { "pattern": "factcheck.org", "tier": 2 },
    { "pattern": "politifact.com", "tier": 2 }
  ],
  "categoryOverrides": {
    "MEDICAL_BIOLOGICAL": [
      { "pattern": "mayoclinic.org", "tier": 1 },
      { "pattern": "webmd.com", "tier": 2 },
      { "pattern": "healthline.com", "tier": 3 },
      { "pattern": "nejm.org", "tier": 1 },
      { "pattern": "thelancet.com", "tier": 1 },
      { "pattern": "jamanetwork.com", "tier": 1 }
    ],
    "LEGAL_REGULATORY": [
      { "pattern": "supremecourt.gov", "tier": 1 },
      { "pattern": "uscourts.gov", "tier": 1 },
      { "pattern": "law.cornell.edu", "tier": 1 },
      { "pattern": "findlaw.com", "tier": 2 },
      { "pattern": "justia.com", "tier": 2 }
    ],
    "STATISTICAL_QUANTITATIVE": [
      { "pattern": "census.gov", "tier": 1 },
      { "pattern": "bls.gov", "tier": 1 },
      { "pattern": "data.gov", "tier": 1 },
      { "pattern": "worldbank.org", "tier": 1 },
      { "pattern": "statista.com", "tier": 2 },
      { "pattern": "pewresearch.org", "tier": 1 }
    ],
    "SCIENTIFIC_TECHNICAL": [
      { "pattern": "arxiv.org", "tier": 1 },
      { "pattern": "plos.org", "tier": 1 },
      { "pattern": "ieee.org", "tier": 1 },
      { "pattern": "sciencedirect.com", "tier": 1 },
      { "pattern": "springer.com", "tier": 1 }
    ],
    "HISTORICAL_EVENT": [
      { "pattern": "archives.gov", "tier": 1 },
      { "pattern": "loc.gov", "tier": 1 },
      { "pattern": "history.com", "tier": 2 },
      { "pattern": "smithsonianmag.com", "tier": 2 }
    ]
  }
}
```

---

### Epic 6: Real-Time Page Modification & Modal System

#### Story 6.1: Real-Time Sentence Highlighting Injection

MODULE Highlighter:
DESCRIPTION: Manages sentence highlighting and color updates in page DOM

FILE: /src/content/highlighter.js

```
CONST HIGHLIGHT_CLASS = 'truthseek-highlight'
CONST STATUS_CLASSES = {
  processing: 'ts-processing',
  true: 'ts-true',
  false: 'ts-false',
  unverified: 'ts-unverified'
}

CONST STATUS_PRIORITY = {
  false: 3,      // Highest priority (worst case)
  unverified: 2,
  processing: 1,
  true: 0        // Lowest priority
}

PRIVATE sentenceElements: Map<string, HTMLElement> = new Map()
PRIVATE sentenceStatuses: Map<string, Map<string, string>> = new Map()  // sentenceId -> factId -> status
PRIVATE originalNodes: Map<string, { parent: Node, nextSibling: Node, text: string }> = new Map()

FUNCTION highlightSentence(sentenceId: string, xpath: string, status: string):
  INPUT:
    - sentenceId: sentence identifier
    - xpath: XPath to locate sentence
    - status: 'processing' | 'true' | 'false' | 'unverified'
  OUTPUT: none
  STEPS:
    1. // Check if already highlighted
       IF sentenceElements.has(sentenceId):
         updateHighlightColor(sentenceId, status)
         RETURN
    
    2. // Find element by XPath
       TRY:
         result = document.evaluate(
           xpath,
           document,
           null,
           XPathResult.FIRST_ORDERED_NODE_TYPE,
           null
         )
         node = result.singleNodeValue
       CATCH:
         LOG "Failed to find element for " + sentenceId
         RETURN
    
    3. IF NOT node:
         RETURN
    
    4. // Store original node info for restoration
       originalNodes.set(sentenceId, {
         parent: node.parentNode,
         nextSibling: node.nextSibling,
         text: node.textContent
       })
    
    5. // Create wrapper span
       span = document.createElement('span')
       span.className = HIGHLIGHT_CLASS + ' ' + STATUS_CLASSES[status]
       span.dataset.sentenceId = sentenceId
       span.textContent = node.textContent
    
    6. // Replace text node with span
       node.parentNode.replaceChild(span, node)
    
    7. // Store reference
       sentenceElements.set(sentenceId, span)
       sentenceStatuses.set(sentenceId, new Map())
    
    8. // Add click listener for modal
       span.addEventListener('click', (e) => {
         e.preventDefault()
         e.stopPropagation()
         openModalForSentence(sentenceId)
       })

FUNCTION updateHighlightColor(sentenceId: string, status: string, factId?: string):
  INPUT:
    - sentenceId: sentence identifier
    - status: new status
    - factId: optional fact ID (for multi-fact tracking)
  OUTPUT: none
  STEPS:
    1. span = sentenceElements.get(sentenceId)
       IF NOT span:
         RETURN
    
    2. // Track status for this fact
       IF factId:
         statuses = sentenceStatuses.get(sentenceId)
         IF statuses:
           statuses.set(factId, status)
    
    3. // Calculate worst-case status for sentence
       finalStatus = getWorstStatus(sentenceId)
    
    4. // Remove all status classes
       FOR each className IN Object.values(STATUS_CLASSES):
         span.classList.remove(className)
    
    5. // Add new status class
       span.classList.add(STATUS_CLASSES[finalStatus])

FUNCTION getWorstStatus(sentenceId: string) -> string:
  INPUT:
    - sentenceId: sentence identifier
  OUTPUT:
    - worst status string
  STEPS:
    1. statuses = sentenceStatuses.get(sentenceId)
       IF NOT statuses OR statuses.size === 0:
         RETURN 'processing'
    
    2. worstPriority = -1
       worstStatus = 'processing'
    
    3. FOR each [factId, status] IN statuses:
         priority = STATUS_PRIORITY[status] OR 0
         IF priority > worstPriority:
           worstPriority = priority
           worstStatus = status
    
    4. RETURN worstStatus

FUNCTION removeAllHighlights():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. FOR each [sentenceId, span] IN sentenceElements:
         original = originalNodes.get(sentenceId)
         IF original AND span.parentNode:
           // Create text node with original content
           textNode = document.createTextNode(original.text)
           span.parentNode.replaceChild(textNode, span)
    
    2. // Clear all tracking
       sentenceElements.clear()
       sentenceStatuses.clear()
       originalNodes.clear()

FUNCTION getSentenceElement(sentenceId: string) -> HTMLElement | null:
  INPUT:
    - sentenceId: sentence identifier
  OUTPUT:
    - HTMLElement or null
  STEPS:
    1. RETURN sentenceElements.get(sentenceId) OR null

EXPORT highlightSentence, updateHighlightColor, removeAllHighlights, getSentenceElement
```

FILE: /src/content/styles.css

```
.truthseek-highlight {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.3s ease;
}

.truthseek-highlight:hover {
  opacity: 0.8;
}

.ts-processing {
  background-color: rgba(100, 149, 237, 0.3);  /* Light blue */
  border-bottom: 2px dashed #6495ED;
}

.ts-true {
  background-color: rgba(34, 197, 94, 0.3);    /* Green */
  border-bottom: 2px solid #22C55E;
}

.ts-false {
  background-color: rgba(239, 68, 68, 0.3);    /* Red */
  border-bottom: 2px solid #EF4444;
}

.ts-unverified {
  background-color: rgba(234, 179, 8, 0.3);    /* Yellow */
  border-bottom: 2px solid #EAB308;
}
```

---

#### Story 6.2: Fact Modal Component

MODULE Modal:
DESCRIPTION: Displays fact verification details in an interactive modal

FILE: /src/content/modal.js

```
IMPORT { getSentenceElement } from './highlighter.js'

PRIVATE modalContainer: HTMLElement | null = null
PRIVATE currentSentenceId: string | null = null
PRIVATE factsData: Map<string, AggregatedResult> = new Map()

FUNCTION initializeModal():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. // Create modal container if not exists
       IF document.getElementById('truthseek-modal'):
         modalContainer = document.getElementById('truthseek-modal')
         RETURN
    
    2. modalContainer = document.createElement('div')
       modalContainer.id = 'truthseek-modal'
       modalContainer.className = 'ts-modal-overlay hidden'
       modalContainer.innerHTML = `
         <div class="ts-modal-content">
           <button class="ts-modal-close">&times;</button>
           <div class="ts-modal-header">
             <h3>Fact Check Results</h3>
             <p class="ts-sentence-text"></p>
           </div>
           <div class="ts-modal-body">
             <div class="ts-facts-list"></div>
           </div>
         </div>
       `
    
    3. document.body.appendChild(modalContainer)
    
    4. // Add event listeners
       modalContainer.querySelector('.ts-modal-close').addEventListener('click', closeModal)
       modalContainer.addEventListener('click', (e) => {
         IF e.target === modalContainer:
           closeModal()
       })

FUNCTION openModalForSentence(sentenceId: string):
  INPUT:
    - sentenceId: sentence to show facts for
  OUTPUT: none
  STEPS:
    1. initializeModal()
    
    2. currentSentenceId = sentenceId
    
    3. // Get sentence text from element
       sentenceElement = getSentenceElement(sentenceId)
       sentenceText = sentenceElement?.textContent OR ''
    
    4. // Update header
       modalContainer.querySelector('.ts-sentence-text').textContent = sentenceText
    
    5. // Render facts for this sentence
       renderFactsForSentence(sentenceId)
    
    6. // Show modal
       modalContainer.classList.remove('hidden')

FUNCTION renderFactsForSentence(sentenceId: string):
  INPUT:
    - sentenceId: sentence identifier
  OUTPUT: none
  STEPS:
    1. factsContainer = modalContainer.querySelector('.ts-facts-list')
       factsContainer.innerHTML = ''
    
    2. // Get facts for this sentence
       sentenceFacts = Array.from(factsData.values())
         .filter(r => r.agentResults[0]?.factId?.startsWith(sentenceId) OR true)  // Filter logic may vary
    
    3. IF sentenceFacts.length === 0:
         factsContainer.innerHTML = '<p class="ts-no-facts">Verifying facts...</p>'
         RETURN
    
    4. FOR each result IN sentenceFacts:
         factElement = renderFact(result)
         factsContainer.appendChild(factElement)

FUNCTION renderFact(result: AggregatedResult) -> HTMLElement:
  INPUT:
    - result: aggregated verification result
  OUTPUT:
    - HTMLElement
  STEPS:
    1. div = document.createElement('div')
       div.className = 'ts-fact-item'
       div.dataset.factId = result.factId
    
    2. // Determine verdict class
       verdictClass = 'ts-verdict-' + result.aggregateVerdict.toLowerCase()
    
    3. div.innerHTML = `
         <div class="ts-fact-header ${verdictClass}">
           <span class="ts-verdict-badge">${getVerdictEmoji(result.aggregateVerdict)} ${result.aggregateVerdict}</span>
           <div class="ts-confidence-wrapper">
             <div class="ts-confidence-bar">
               <div class="ts-confidence-fill ${getConfidenceClass(result.aggregateConfidenceCategory)}" 
                    style="width: ${result.aggregateConfidence}%"></div>
             </div>
             <span class="ts-confidence-text">${result.aggregateConfidence}%</span>
           </div>
         </div>
         
         <div class="ts-fact-reasoning">
           <p>${result.agentResults[0]?.reasoning OR 'Processing...'}</p>
         </div>
         
         ${result.hasDisagreement ? `
           <div class="ts-disagreement-warning">
             ⚠️ ${result.disagreementNote}
           </div>
         ` : ''}
         
         ${result.agentResults[0]?.knowledgeCutoffMessage ? `
           <div class="ts-cutoff-message">
             ℹ️ ${result.agentResults[0].knowledgeCutoffMessage}
           </div>
         ` : ''}
         
         <div class="ts-sources">
           <h4>Sources</h4>
           ${renderSources(result.agentResults[0]?.sources OR [])}
         </div>
         
         ${result.agentResults.length > 1 ? renderAgentDetails(result.agentResults) : ''}
       `
    
    4. RETURN div

FUNCTION renderSources(sources: Source[]) -> string:
  INPUT:
    - sources: array of sources
  OUTPUT:
    - HTML string
  STEPS:
    1. IF sources.length === 0:
         RETURN '<p class="ts-no-sources">No verified sources found</p>'
    
    2. html = '<ul class="ts-sources-list">'
    
    3. FOR each source IN sources:
         tierBadge = getTierBadge(source.tier)
         supportClass = source.isSupporting ? 'ts-supporting' : 'ts-refuting'
         html += `
           <li class="ts-source-item ${supportClass}">
             <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
               ${escapeHtml(source.title OR source.domain)}
             </a>
             ${tierBadge}
             <span class="ts-source-type">${source.isSupporting ? '✓ Supporting' : '✗ Refuting'}</span>
           </li>
         `
    
    4. html += '</ul>'
       RETURN html

FUNCTION renderAgentDetails(agentResults: VerificationResult[]) -> string:
  INPUT:
    - agentResults: array of per-agent results
  OUTPUT:
    - HTML string
  STEPS:
    1. html = '<div class="ts-agent-details">'
       html += '<h4>Individual Agent Assessments</h4>'
    
    2. FOR each result IN agentResults:
         verdictClass = 'ts-verdict-' + result.verdict.toLowerCase()
         html += `
           <details class="ts-agent-section">
             <summary class="${verdictClass}">
               Agent: ${result.agentId.substring(0, 8)}... - ${result.verdict} (${result.confidence}%)
             </summary>
             <div class="ts-agent-content">
               <p><strong>Reasoning:</strong> ${escapeHtml(result.reasoning)}</p>
               <p><strong>Confidence:</strong> ${result.confidence}% (${result.confidenceCategory})</p>
               ${renderSources(result.sources)}
             </div>
           </details>
         `
    
    3. html += '</div>'
       RETURN html

FUNCTION updateFact(factId: string, result: AggregatedResult):
  INPUT:
    - factId: fact identifier
    - result: updated result
  OUTPUT: none
  STEPS:
    1. factsData.set(factId, result)
    
    2. // If modal is open showing this fact, re-render
       IF currentSentenceId:
         existingElement = modalContainer.querySelector(`[data-fact-id="${factId}"]`)
         IF existingElement:
           newElement = renderFact(result)
           existingElement.replaceWith(newElement)

FUNCTION closeModal():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. IF modalContainer:
         modalContainer.classList.add('hidden')
    2. currentSentenceId = null

FUNCTION getVerdictEmoji(verdict: string) -> string:
  STEPS:
    1. SWITCH verdict:
         CASE 'TRUE': RETURN '✓'
         CASE 'FALSE': RETURN '✗'
         DEFAULT: RETURN '?'

FUNCTION getConfidenceClass(category: string) -> string:
  STEPS:
    1. SWITCH category:
         CASE 'high': RETURN 'ts-confidence-high'
         CASE 'medium': RETURN 'ts-confidence-medium'
         DEFAULT: RETURN 'ts-confidence-low'

FUNCTION getTierBadge(tier: number) -> string:
  STEPS:
    1. labels = { 1: 'Primary', 2: 'Major', 3: 'General', 4: 'Unknown' }
       RETURN `<span class="ts-tier-badge ts-tier-${tier}">${labels[tier]}</span>`

FUNCTION escapeHtml(text: string) -> string:
  STEPS:
    1. div = document.createElement('div')
       div.textContent = text
       RETURN div.innerHTML

EXPORT initializeModal, openModalForSentence, updateFact, closeModal
```

FILE: /src/content/modal.css

```
.ts-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
}

.ts-modal-overlay.hidden {
  display: none;
}

.ts-modal-content {
  background: #ffffff;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  width: 90%;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
}

.ts-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
}

.ts-modal-close:hover {
  color: #000;
}

.ts-modal-header {
  padding: 20px 20px 10px;
  border-bottom: 1px solid #eee;
}

.ts-modal-header h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #333;
}

.ts-sentence-text {
  font-style: italic;
  color: #666;
  margin: 0;
  font-size: 14px;
}

.ts-modal-body {
  padding: 20px;
}

.ts-fact-item {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.ts-fact-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ts-fact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.ts-verdict-true { background: rgba(34, 197, 94, 0.1); }
.ts-verdict-false { background: rgba(239, 68, 68, 0.1); }
.ts-verdict-unverified { background: rgba(234, 179, 8, 0.1); }

.ts-verdict-badge {
  font-weight: 600;
  font-size: 14px;
}

.ts-confidence-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ts-confidence-bar {
  width: 100px;
  height: 8px;
  background: #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
}

.ts-confidence-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.ts-confidence-high { background: #22C55E; }
.ts-confidence-medium { background: #EAB308; }
.ts-confidence-low { background: #EF4444; }

.ts-confidence-text {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.ts-fact-reasoning {
  font-size: 14px;
  line-height: 1.5;
  color: #444;
  margin-bottom: 12px;
}

.ts-disagreement-warning,
.ts-cutoff-message {
  background: #FEF3C7;
  border-left: 4px solid #EAB308;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
  border-radius: 0 4px 4px 0;
}

.ts-sources h4 {
  font-size: 14px;
  margin: 0 0 8px;
  color: #333;
}

.ts-sources-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ts-source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.ts-source-item a {
  color: #2563EB;
  text-decoration: none;
  flex: 1;
}

.ts-source-item a:hover {
  text-decoration: underline;
}

.ts-tier-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.ts-tier-1 { background: #DCFCE7; color: #166534; }
.ts-tier-2 { background: #DBEAFE; color: #1E40AF; }
.ts-tier-3 { background: #FEF3C7; color: #92400E; }
.ts-tier-4 { background: #F3F4F6; color: #374151; }

.ts-source-type {
  font-size: 11px;
  color: #666;
}

.ts-supporting .ts-source-type { color: #166534; }
.ts-refuting .ts-source-type { color: #DC2626; }

.ts-agent-details {
  margin-top: 16px;
}

.ts-agent-details h4 {
  font-size: 14px;
  margin: 0 0 8px;
}

.ts-agent-section {
  margin-bottom: 8px;
}

.ts-agent-section summary {
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.ts-agent-content {
  padding: 12px;
  font-size: 13px;
}
```

---

#### Story 6.3: Multi-Agent Assessment Display

(Integrated into Story 6.2 - renderAgentDetails function)

---

### Epic 7: Progress & Results UI

#### Story 7.1: Progress Popup Component

MODULE ProgressPopup:
DESCRIPTION: Floating progress display with drag support

FILE: /src/content/progress-popup.js

```
IMPORT { removeAllHighlights } from './highlighter.js'
IMPORT { closeModal } from './modal.js'

PRIVATE popup: HTMLElement | null = null
PRIVATE isDragging: boolean = false
PRIVATE dragOffset: { x: number, y: number } = { x: 0, y: 0 }

FUNCTION showProgress():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. IF popup:
         popup.classList.remove('hidden')
         RETURN
    
    2. popup = document.createElement('div')
       popup.id = 'truthseek-progress'
       popup.className = 'ts-progress-popup'
       popup.innerHTML = `
         <div class="ts-progress-header" id="ts-drag-handle">
           <span class="ts-progress-title">TruthSeek</span>
           <span class="ts-progress-status" id="ts-status">Initializing...</span>
         </div>
         <div class="ts-progress-body">
           <div class="ts-progress-step" id="ts-step">Starting fact check...</div>
           <div class="ts-progress-counts" id="ts-counts"></div>
           <div class="ts-progress-bar-container">
             <div class="ts-progress-bar" id="ts-bar" style="width: 0%"></div>
           </div>
         </div>
       `
    
    3. document.body.appendChild(popup)
    
    4. // Position top-right
       popup.style.top = '20px'
       popup.style.right = '20px'
    
    5. // Setup drag functionality
       setupDraggable()

FUNCTION updateProgress(update: ProgressUpdate):
  INPUT:
    - update: ProgressUpdate object
  OUTPUT: none
  STEPS:
    1. IF NOT popup:
         showProgress()
    
    2. // Update step text
       stepElement = document.getElementById('ts-step')
       IF stepElement:
         stepElement.textContent = update.step
    
    3. // Update counts if available
       countsElement = document.getElementById('ts-counts')
       IF countsElement AND update.totalFacts:
         current = update.currentFact OR 0
         countsElement.textContent = `Fact ${current} of ${update.totalFacts}`
         countsElement.classList.remove('hidden')
    
    4. // Update progress bar
       barElement = document.getElementById('ts-bar')
       IF barElement:
         barElement.style.width = update.percentComplete + '%'
    
    5. // Update status
       statusElement = document.getElementById('ts-status')
       IF statusElement:
         statusElement.textContent = 'Running'
         statusElement.className = 'ts-progress-status ts-status-running'

FUNCTION showResults(summary: ResultsSummary):
  INPUT:
    - summary: ResultsSummary object
  OUTPUT: none
  STEPS:
    1. IF NOT popup:
         showProgress()
    
    2. // Transform to results view
       popup.className = 'ts-progress-popup ts-results-mode'
    
    3. // Determine overall status color
       statusColor = getOverallStatusColor(summary)
    
    4. popup.innerHTML = `
         <div class="ts-progress-header ${statusColor}" id="ts-drag-handle">
           <span class="ts-progress-title">TruthSeek Results</span>
           <button class="ts-close-btn" id="ts-close-results">&times;</button>
         </div>
         <div class="ts-results-body">
           <div class="ts-results-summary">
             <div class="ts-result-stat">
               <span class="ts-stat-value">${summary.totalFacts}</span>
               <span class="ts-stat-label">Facts Checked</span>
             </div>
             <div class="ts-result-breakdown">
               <div class="ts-breakdown-item ts-true">
                 <span class="ts-breakdown-count">${summary.trueCount}</span>
                 <span class="ts-breakdown-label">True</span>
               </div>
               <div class="ts-breakdown-item ts-false">
                 <span class="ts-breakdown-count">${summary.falseCount}</span>
                 <span class="ts-breakdown-label">False</span>
               </div>
               <div class="ts-breakdown-item ts-unverified">
                 <span class="ts-breakdown-count">${summary.unverifiedCount}</span>
                 <span class="ts-breakdown-label">Unverified</span>
               </div>
             </div>
           </div>
           <div class="ts-overall-confidence">
             <span class="ts-confidence-label">Overall Confidence:</span>
             <div class="ts-confidence-bar-large">
               <div class="ts-confidence-fill-large ${getConfidenceClass(summary.overallConfidenceCategory)}" 
                    style="width: ${summary.overallConfidence}%"></div>
             </div>
             <span class="ts-confidence-value">${summary.overallConfidence}%</span>
           </div>
           <p class="ts-results-hint">Click highlighted text to view details</p>
         </div>
       `
    
    5. // Re-setup drag
       setupDraggable()
    
    6. // Add close handler
       document.getElementById('ts-close-results').addEventListener('click', closeResults)

FUNCTION closeResults():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. // Hide popup
       IF popup:
         popup.classList.add('hidden')
    
    2. // Remove all highlights from page
       removeAllHighlights()
    
    3. // Close modal if open
       closeModal()

FUNCTION hidePopup():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. IF popup:
         popup.classList.add('hidden')

FUNCTION setupDraggable():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. handle = document.getElementById('ts-drag-handle')
       IF NOT handle:
         RETURN
    
    2. handle.addEventListener('mousedown', (e) => {
         isDragging = true
         rect = popup.getBoundingClientRect()
         dragOffset = {
           x: e.clientX - rect.left,
           y: e.clientY - rect.top
         }
         popup.style.cursor = 'grabbing'
       })
    
    3. document.addEventListener('mousemove', (e) => {
         IF NOT isDragging:
           RETURN
         
         // Calculate new position
         newX = e.clientX - dragOffset.x
         newY = e.clientY - dragOffset.y
         
         // Constrain to viewport
         maxX = window.innerWidth - popup.offsetWidth
         maxY = window.innerHeight - popup.offsetHeight
         newX = Math.max(0, Math.min(newX, maxX))
         newY = Math.max(0, Math.min(newY, maxY))
         
         popup.style.left = newX + 'px'
         popup.style.top = newY + 'px'
         popup.style.right = 'auto'
       })
    
    4. document.addEventListener('mouseup', () => {
         isDragging = false
         IF popup:
           popup.style.cursor = 'grab'
       })

FUNCTION getOverallStatusColor(summary: ResultsSummary) -> string:
  INPUT:
    - summary: ResultsSummary
  OUTPUT:
    - CSS class name
  STEPS:
    1. IF summary.falseCount > summary.totalFacts * 0.3:
         RETURN 'ts-status-danger'
    2. IF summary.unverifiedCount > summary.totalFacts * 0.5:
         RETURN 'ts-status-warning'
    3. RETURN 'ts-status-success'

FUNCTION getConfidenceClass(category: string) -> string:
  STEPS:
    1. SWITCH category:
         CASE 'high': RETURN 'ts-confidence-high'
         CASE 'medium': RETURN 'ts-confidence-medium'
         DEFAULT: RETURN 'ts-confidence-low'

EXPORT showProgress, updateProgress, showResults, closeResults, hidePopup
```

FILE: /src/content/progress-popup.css

```
.ts-progress-popup {
  position: fixed;
  width: 280px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 999998;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.ts-progress-popup.hidden {
  display: none;
}

.ts-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2563EB;
  color: white;
  cursor: grab;
}

.ts-progress-header.ts-status-success { background: #22C55E; }
.ts-progress-header.ts-status-warning { background: #EAB308; }
.ts-progress-header.ts-status-danger { background: #EF4444; }

.ts-progress-title {
  font-weight: 600;
  font-size: 14px;
}

.ts-progress-status {
  font-size: 12px;
  opacity: 0.9;
}

.ts-status-running::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  margin-left: 6px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ts-progress-body {
  padding: 16px;
}

.ts-progress-step {
  font-size: 13px;
  color: #444;
  margin-bottom: 8px;
}

.ts-progress-counts {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.ts-progress-counts.hidden {
  display: none;
}

.ts-progress-bar-container {
  height: 6px;
  background: #e5e5e5;
  border-radius: 3px;
  overflow: hidden;
}

.ts-progress-bar {
  height: 100%;
  background: #2563EB;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Results Mode */
.ts-results-mode .ts-close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.ts-results-body {
  padding: 16px;
}

.ts-results-summary {
  margin-bottom: 16px;
}

.ts-result-stat {
  text-align: center;
  margin-bottom: 12px;
}

.ts-stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.ts-stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.ts-result-breakdown {
  display: flex;
  justify-content: space-around;
  gap: 8px;
}

.ts-breakdown-item {
  flex: 1;
  text-align: center;
  padding: 8px;
  border-radius: 8px;
}

.ts-breakdown-item.ts-true { background: rgba(34, 197, 94, 0.1); }
.ts-breakdown-item.ts-false { background: rgba(239, 68, 68, 0.1); }
.ts-breakdown-item.ts-unverified { background: rgba(234, 179, 8, 0.1); }

.ts-breakdown-count {
  display: block;
  font-size: 20px;
  font-weight: 600;
}

.ts-breakdown-item.ts-true .ts-breakdown-count { color: #22C55E; }
.ts-breakdown-item.ts-false .ts-breakdown-count { color: #EF4444; }
.ts-breakdown-item.ts-unverified .ts-breakdown-count { color: #EAB308; }

.ts-breakdown-label {
  font-size: 11px;
  color: #666;
}

.ts-overall-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ts-confidence-label {
  font-size: 12px;
  color: #666;
}

.ts-confidence-bar-large {
  flex: 1;
  height: 8px;
  background: #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
}

.ts-confidence-fill-large {
  height: 100%;
  border-radius: 4px;
}

.ts-confidence-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.ts-results-hint {
  text-align: center;
  font-size: 12px;
  color: #888;
  margin: 0;
}
```

---

#### Story 7.2: Results Summary Display

(Integrated into Story 7.1 - showResults function)

---

#### Story 7.3: Run/Cancel Controls

MODULE Orchestrator:
DESCRIPTION: Main workflow coordination and state machine

FILE: /src/background/orchestrator.js

```
IMPORT { extractPageContent } from '../content/extractor.js'
IMPORT { extractFromAllAgents } from './extraction-orchestrator.js'
IMPORT { deduplicate } from './deduplication.js'
IMPORT { validateAndCorrectCategories } from './categorization.js'
IMPORT { validateFacts } from './fact-validator.js'
IMPORT { verifyFact } from './verification-orchestrator.js'
IMPORT { aggregateResults } from './aggregation.js'
IMPORT { sendToTab, broadcast } from './messaging.js'
IMPORT { MessageType } from '../shared/message-types.js'

PRIVATE state: ExtensionState = {
  status: 'IDLE',
  currentStep: null,
  totalFacts: null,
  processedFacts: null,
  results: null,
  startedAt: null,
  completedAt: null
}

PRIVATE cancellationRequested: boolean = false
PRIVATE agents: AIProvider[] = []

ASYNC FUNCTION start(tabId: number):
  INPUT:
    - tabId: tab to fact-check
  OUTPUT: none
  STEPS:
    1. // Validate agents configured
       AWAIT loadAgents()
       IF agents.length === 0:
         THROW "No AI agents configured"
    
    2. // Update state
       cancellationRequested = false
       state = {
         status: 'RUNNING',
         currentStep: 'Extracting page content',
         totalFacts: null,
         processedFacts: 0,
         results: null,
         startedAt: Date.now(),
         completedAt: null
       }
       AWAIT persistState()
       broadcastState()
    
    3. // Show progress popup
       AWAIT sendToTab(tabId, {
         type: MessageType.SHOW_PROGRESS,
         payload: {}
       })
    
    4. TRY:
         // Step 1: Extract page content
         updateProgress(tabId, 'Extracting page content...', 5)
         content = AWAIT requestPageContent(tabId)
         
         IF cancellationRequested:
           handleCancellation()
           RETURN
         
         // Step 2: Extract facts from all agents
         updateProgress(tabId, 'Extracting facts from AI agents...', 15)
         rawResults = AWAIT extractFromAllAgents(content, agents, tabId)
         
         IF cancellationRequested:
           handleCancellation()
           RETURN
         
         // Step 3: Deduplicate
         updateProgress(tabId, 'Processing extracted facts...', 30)
         deduplicatedFacts = deduplicate(rawResults)
         
         // Step 4: Validate categories
         facts = validateAndCorrectCategories(deduplicatedFacts)
         
         // Step 5: Validate verifiability
         facts = validateFacts(facts)
         
         state.totalFacts = facts.length
         
         // Step 6: Highlight sentences
         updateProgress(tabId, 'Highlighting sentences...', 35)
         FOR each fact IN facts:
           AWAIT sendToTab(tabId, {
             type: MessageType.HIGHLIGHT_SENTENCE,
             payload: {
               sentenceId: fact.sentenceId,
               xpath: getSentenceXPath(content, fact.sentenceId),
               status: 'processing'
             }
           })
         
         IF cancellationRequested:
           handleCancellation()
           RETURN
         
         // Step 7: Verify each fact
         results = []
         FOR i = 0 TO facts.length:
           IF cancellationRequested:
             BREAK
           
           fact = facts[i]
           percent = 35 + Math.round((i / facts.length) * 60)
           updateProgress(tabId, `Verifying fact ${i + 1} of ${facts.length}...`, percent, facts.length, i + 1)
           
           // Verify with all agents
           agentResults = []
           FOR each agent IN agents:
             result = AWAIT verifyFact(fact, agent)
             agentResults.push(result)
           
           // Aggregate results
           aggregated = aggregateResults(agentResults)
           results.push(aggregated)
           
           // Update highlight color
           AWAIT sendToTab(tabId, {
             type: MessageType.UPDATE_HIGHLIGHT_COLOR,
             payload: {
               sentenceId: fact.sentenceId,
               status: aggregated.aggregateVerdict.toLowerCase(),
               factId: fact.id
             }
           })
           
           state.processedFacts = i + 1
           AWAIT persistState()
         
         // Step 8: Complete
         state.status = 'COMPLETE'
         state.results = results
         state.completedAt = Date.now()
         AWAIT persistState()
         
         // Show results
         summary = calculateSummary(results)
         AWAIT sendToTab(tabId, {
           type: MessageType.SHOW_RESULTS,
           payload: summary
         })
         
         broadcastState()
         
       CATCH error:
         LOG "Fact check failed: " + error.message
         state.status = 'CANCELLED'
         state.currentStep = 'Error: ' + error.message
         AWAIT persistState()
         broadcastState()

FUNCTION cancel():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. cancellationRequested = true

FUNCTION handleCancellation():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. state.status = 'CANCELLED'
    2. state.currentStep = 'Cancelled by user'
    3. state.completedAt = Date.now()
    4. AWAIT persistState()
    5. broadcastState()

FUNCTION getState() -> ExtensionState:
  INPUT: none
  OUTPUT: current state
  STEPS:
    1. RETURN { ...state }

ASYNC FUNCTION loadAgents():
  INPUT: none
  OUTPUT: none
  STEPS:
    1. stored = AWAIT chrome.storage.local.get('agents')
    2. configs = stored.agents OR []
    3. agents = []
    
    4. FOR each config IN configs:
         SWITCH config.providerId:
           CASE 'openai':
             agents.push(new OpenAIProvider(config))
           CASE 'anthropic':
             agents.push(new AnthropicProvider(config))
           CASE 'google':
             agents.push(new GoogleProvider(config))

ASYNC FUNCTION persistState():
  STEPS:
    1. AWAIT chrome.storage.local.set({ extensionState: state })

FUNCTION broadcastState():
  STEPS:
    1. broadcast({
         type: MessageType.STATE_UPDATE,
         payload: state,
         timestamp: Date.now()
       })

FUNCTION updateProgress(tabId: number, step: string, percent: number, total?: number, current?: number):
  STEPS:
    1. state.currentStep = step
    2. sendToTab(tabId, {
         type: MessageType.UPDATE_PROGRESS,
         payload: {
           step: step,
           percentComplete: percent,
           totalFacts: total,
           currentFact: current
         }
       })

ASYNC FUNCTION requestPageContent(tabId: number) -> ExtractedContent:
  STEPS:
    1. response = AWAIT sendToTab(tabId, {
         type: MessageType.GET_PAGE_CONTENT,
         payload: {}
       })
    2. RETURN response.data

FUNCTION getSentenceXPath(content: ExtractedContent, sentenceId: string) -> string:
  STEPS:
    1. sentence = content.sentences.find(s => s.id === sentenceId)
    2. RETURN sentence?.xpath OR ''

FUNCTION calculateSummary(results: AggregatedResult[]) -> ResultsSummary:
  STEPS:
    1. totalFacts = results.length
    2. trueCount = results.filter(r => r.aggregateVerdict === 'TRUE').length
    3. falseCount = results.filter(r => r.aggregateVerdict === 'FALSE').length
    4. unverifiedCount = results.filter(r => r.aggregateVerdict === 'UNVERIFIED').length
    5. avgConfidence = results.reduce((sum, r) => sum + r.aggregateConfidence, 0) / totalFacts
    
    6. RETURN {
         totalFacts,
         trueCount,
         falseCount,
         unverifiedCount,
         overallConfidence: Math.round(avgConfidence),
         overallConfidenceCategory: categorizeScore(avgConfidence)
       }

EXPORT start, cancel, getState
```

---

#### Story 7.4: Donation Link Integration

(Integrated into Story 1.3 - popup.html footer section)

---

### Epic 8: Accuracy Assurance & Hallucination Prevention

#### Story 8.1: Fact Extraction Validation

MODULE FactValidator:
DESCRIPTION: Filters out non-verifiable statements from extracted facts

FILE: /src/background/fact-validator.js

```
CONST OPINION_INDICATORS = [
  'best', 'worst', 'amazing', 'terrible', 'beautiful', 'ugly',
  'should', 'must', 'need to', 'have to', 'ought to',
  'i think', 'i believe', 'in my opinion', 'personally',
  'obviously', 'clearly', 'everyone knows'
]

CONST PREDICTION_INDICATORS = [
  'will be', 'going to', 'is expected to', 'is likely to',
  'probably will', 'may become', 'might happen',
  'in the future', 'someday', 'eventually'
]

CONST TAUTOLOGY_PATTERNS = [
  /^a .+ is a .+$/i,
  /^.+ is defined as .+$/i,
  /^by definition/i
]

FUNCTION validateFacts(facts: Fact[]) -> Fact[]:
  INPUT:
    - facts: deduplicated facts
  OUTPUT:
    - validated facts with isValid flag set
  STEPS:
    1. validated = []
    
    2. FOR each fact IN facts:
         validation = validateSingleFact(fact)
         fact.isValid = validation.isValid
         fact.validationNote = validation.note
         
         IF validation.isValid OR validation.isBorderline:
           validated.push(fact)
    
    3. RETURN validated

FUNCTION validateSingleFact(fact: Fact) -> { isValid: boolean, isBorderline: boolean, note: string | null }:
  INPUT:
    - fact: single fact
  OUTPUT:
    - validation result
  STEPS:
    1. text = (fact.originalText + ' ' + fact.searchableText).toLowerCase()
    
    2. // Check for opinions
       IF containsOpinionIndicator(text):
         RETURN { isValid: false, isBorderline: false, note: 'Contains subjective opinion' }
    
    3. // Check for predictions
       IF containsPredictionIndicator(text):
         RETURN { isValid: false, isBorderline: false, note: 'Contains prediction/speculation' }
    
    4. // Check for tautologies
       IF isTautology(text):
         RETURN { isValid: false, isBorderline: false, note: 'Tautological statement' }
    
    5. // Check for vague claims
       IF isVagueClaim(text):
         RETURN { isValid: true, isBorderline: true, note: 'Borderline: vague claim' }
    
    6. RETURN { isValid: true, isBorderline: false, note: null }

FUNCTION containsOpinionIndicator(text: string) -> boolean:
  INPUT:
    - text: lowercase text
  OUTPUT:
    - boolean
  STEPS:
    1. RETURN OPINION_INDICATORS.some(ind => text.includes(ind))

FUNCTION containsPredictionIndicator(text: string) -> boolean:
  INPUT:
    - text: lowercase text
  OUTPUT:
    - boolean
  STEPS:
    1. RETURN PREDICTION_INDICATORS.some(ind => text.includes(ind))

FUNCTION isTautology(text: string) -> boolean:
  INPUT:
    - text: lowercase text
  OUTPUT:
    - boolean
  STEPS:
    1. RETURN TAUTOLOGY_PATTERNS.some(pattern => pattern.test(text))

FUNCTION isVagueClaim(text: string) -> boolean:
  INPUT:
    - text: lowercase text
  OUTPUT:
    - boolean
  STEPS:
    1. vagueTerms = ['some', 'many', 'few', 'several', 'often', 'sometimes', 'rarely']
    2. vagueCount = vagueTerms.filter(term => text.includes(term)).length
    3. RETURN vagueCount >= 2

EXPORT validateFacts
```

---

#### Story 8.2: Verification Grounding Enforcement

MODULE GroundingValidator:
DESCRIPTION: Ensures AI responses are grounded in provided sources

FILE: /src/background/grounding-validator.js

```
FUNCTION validateGrounding(response: object, providedUrls: string[]) -> { valid: boolean, issues: string[] }:
  INPUT:
    - response: AI verification response
    - providedUrls: URLs that were provided to AI
  OUTPUT:
    - validation result
  STEPS:
    1. issues = []
    
    2. // Extract cited URLs from response
       citedUrls = extractCitedUrls(response)
    
    3. // Check each cited URL was in provided set
       FOR each url IN citedUrls:
         IF NOT providedUrls.includes(url):
           issues.push('Cited URL not in search results: ' + url)
    
    4. // Check reasoning references sources
       IF response.reasoning AND NOT referencesSource(response.reasoning):
         issues.push('Reasoning does not reference any sources')
    
    5. // Check for training data leakage indicators
       leakageIndicators = detectTrainingDataLeakage(response.reasoning)
       IF leakageIndicators.length > 0:
         issues.push(...leakageIndicators)
    
    6. RETURN {
         valid: issues.length === 0,
         issues: issues
       }

FUNCTION extractCitedUrls(response: object) -> string[]:
  INPUT:
    - response: AI response object
  OUTPUT:
    - array of cited URLs
  STEPS:
    1. urls = []
    
    2. IF response.citedSources:
         FOR each source IN response.citedSources:
           IF source.url:
             urls.push(source.url)
    
    3. // Also extract URLs from reasoning text
       IF response.reasoning:
         urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
         matches = response.reasoning.match(urlPattern) OR []
         urls.push(...matches)
    
    4. RETURN [...new Set(urls)]

FUNCTION referencesSource(reasoning: string) -> boolean:
  INPUT:
    - reasoning: reasoning text
  OUTPUT:
    - boolean
  STEPS:
    1. sourceIndicators = [
         'according to', 'source', 'states that', 'reports',
         'found that', 'indicates', 'confirms', 'shows'
       ]
    2. lowered = reasoning.toLowerCase()
    3. RETURN sourceIndicators.some(ind => lowered.includes(ind))

FUNCTION detectTrainingDataLeakage(reasoning: string) -> string[]:
  INPUT:
    - reasoning: reasoning text
  OUTPUT:
    - array of leakage indicators
  STEPS:
    1. indicators = []
    2. lowered = reasoning.toLowerCase()
    
    3. // Phrases suggesting knowledge not from sources
       leakagePhrases = [
         'i know that',
         'it is well known',
         'as everyone knows',
         'based on my knowledge',
         'from my training',
         'i learned that',
         'common knowledge'
       ]
    
    4. FOR each phrase IN leakagePhrases:
         IF lowered.includes(phrase):
           indicators.push('Possible training data usage: "' + phrase + '"')
    
    5. RETURN indicators

EXPORT validateGrounding
```

---

#### Story 8.3: Knowledge Cutoff Handling

MODULE RecencyHandler:
DESCRIPTION: Handles facts affected by model knowledge cutoffs

FILE: /src/background/recency-handler.js

```
FUNCTION checkRecencyIssues(
  fact: Fact,
  providerInfo: ProviderInfo,
  searchResults: Source[]
) -> { hasIssue: boolean, message: string | null }:
  INPUT:
    - fact: Fact being verified
    - providerInfo: AI provider info with cutoff date
    - searchResults: sources found
  OUTPUT:
    - { hasIssue, message }
  STEPS:
    1. cutoffDate = providerInfo.knowledgeCutoffDate
    2. currentYear = new Date().getFullYear()
    3. cutoffYear = cutoffDate.getFullYear()
    
    4. // Extract years from fact
       factYears = extractYears(fact.originalText)
    
    5. // Check for post-cutoff references
       hasPostCutoffYear = factYears.some(y => y > cutoffYear)
    
    6. // Check for current-position indicators
       hasCurrentIndicator = /\b(current|currently|presently|now|today|as of)\b/i.test(fact.originalText)
    
    7. // Check for role/position indicators
       hasRoleIndicator = /\b(president|secretary|ceo|chairman|director|minister|leader)\b/i.test(fact.originalText)
    
    8. // Determine if recency is a concern
       needsCurrentSources = hasPostCutoffYear OR (hasCurrentIndicator AND hasRoleIndicator)
    
    9. IF NOT needsCurrentSources:
         RETURN { hasIssue: false, message: null }
    
    10. // Check if we have current sources
        hasCurrentSources = searchResults.some(s => {
          sourceYear = extractSourceYear(s)
          RETURN sourceYear >= currentYear - 1
        })
    
    11. IF hasCurrentSources:
          RETURN { hasIssue: false, message: null }
    
    12. // Generate user-friendly message
        message = `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${providerInfo.knowledgeCutoff}). We could not find sufficient current sources to verify it.`
    
    13. RETURN { hasIssue: true, message: message }

FUNCTION extractYears(text: string) -> number[]:
  INPUT:
    - text: text to search
  OUTPUT:
    - array of year numbers
  STEPS:
    1. matches = text.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/g) OR []
    2. RETURN matches.map(m => parseInt(m))

FUNCTION extractSourceYear(source: Source) -> number:
  INPUT:
    - source: Source object
  OUTPUT:
    - year number or 0
  STEPS:
    1. // Try to extract year from URL
       urlYears = extractYears(source.url)
       IF urlYears.length > 0:
         RETURN Math.max(...urlYears)
    
    2. // Try to extract from snippet
       snippetYears = extractYears(source.snippet)
       IF snippetYears.length > 0:
         RETURN Math.max(...snippetYears)
    
    3. RETURN 0

EXPORT checkRecencyIssues
```

---

#### Story 8.4: Cross-Agent Consistency Check

(Integrated into Story 4.8 - aggregation.js with disagreement detection)

---

## 4. Error Handling Rules

| Condition | Required Behavior |
|-----------|-------------------|
| No AI agents configured | Disable Run button; show "Configure agents first" message |
| API key invalid/expired | Show authentication error; prompt to re-authenticate |
| OAuth token expired | Silently refresh if possible; prompt re-auth if not |
| AI request timeout (60s) | Mark agent as failed; continue with other agents |
| All agents fail extraction | Show error message; suggest retry |
| URL validation timeout (10s) | Mark URL as invalid; exclude from evidence |
| URL returns 4xx/5xx | Mark URL as invalid; exclude from evidence |
| Soft-404 detected | Mark URL as invalid; exclude from evidence |
| Content not relevant | Mark URL as invalid; exclude from evidence |
| All URLs fail validation | Cap confidence at 85%; mark as lacking verified evidence |
| Strong agent disagreement | Set aggregate verdict to UNVERIFIED; show disagreement note |
| JSON parse error from AI | Attempt regex extraction; mark agent as failed if unparsable |
| Network error | Retry once; then mark as failed with reason |
| Page content > 100KB | Truncate with warning; process available content |
| XPath invalid (DOM changed) | Skip highlighting for that sentence; log warning |
| Storage quota exceeded | Clear old data; show warning |
| User cancels mid-process | Set status CANCELLED; preserve partial results |

---

## 5. Edge Case Logic

| Edge Case | Required Handling |
|-----------|-------------------|
| Empty page content | Show "No content to analyze" message |
| No facts extracted | Show "No verifiable facts found" summary |
| Single-agent mode | Skip aggregation; use agent result directly |
| Sentence with multiple facts | Show worst-case color; modal lists all facts |
| Fact spans multiple sentences | Associate with first sentence |
| Dynamic page content | Wait 2s after load; re-extract on user request |
| Iframe content | Extract main document only |
| Very long sentences | Truncate display in modal; preserve full text |
| Special characters in XPath | Escape properly; fallback to text search |
| Rate limiting from provider | Implement exponential backoff; show waiting status |
| Modal opened during verification | Show partial data; update in real-time |
| Multiple tabs fact-checking | Isolate state per tab |
| Browser extension update | Preserve state; graceful reload |
| Knowledge cutoff affects result | Display user-friendly message with model/date |
| No supporting sources found | Allow refuting-only verdict if strong |
| Only Tier 4 sources found | Cap confidence appropriately |
| Duplicate sentences on page | Generate unique IDs based on position |

---

## 6. Dependencies

```
orchestrator.js
├── extraction-orchestrator.js
│   ├── ai/providers/openai.js
│   ├── ai/providers/anthropic.js
│   ├── ai/providers/google.js
│   └── ai/prompts/extraction.js
├── deduplication.js
│   └── config/model-rankings.js
├── categorization.js
│   └── config/categories.js
├── fact-validator.js
├── verification-orchestrator.js
│   ├── search.js
│   │   └── search-strategies.js
│   ├── url-validator.js
│   ├── source-tiering.js
│   │   └── config/source-tiers.json
│   ├── ai/prompts/verification.js
│   ├── confidence-scoring.js
│   ├── grounding-validator.js
│   └── recency-handler.js
├── aggregation.js
└── messaging.js

content/highlighter.js
├── content/styles.css
└── shared/message-utils.js

content/modal.js
├── content/modal.css
├── content/highlighter.js (for getSentenceElement)
└── shared/message-utils.js

content/progress-popup.js
├── content/progress-popup.css
├── content/highlighter.js (for removeAllHighlights)
├── content/modal.js (for closeModal)
└── shared/message-utils.js

popup/popup.js
├── popup/messaging.js
├── popup/agent-manager.js
│   ├── utils/crypto.js
│   └── config/model-metadata.js
└── shared/message-types.js

ai/providers/*.js
├── ai/provider-interface.js
├── ai/types.js
├── ai/prompts/extraction.js
├── ai/prompts/verification.js
├── utils/crypto.js
└── config/model-metadata.js
```

---

## 7. Open Questions

None. All design decisions are resolved in the acceptance criteria and design document.

---

*End of Pseudocode Specification*


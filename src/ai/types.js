/**
 * TruthSeek AI Type Definitions
 * Standardized response types for AI provider operations
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {Fact[]} facts - Array of extracted facts
 * @property {string} agentId - ID of agent that performed extraction
 * @property {number} tokensUsed - Number of tokens consumed
 * @property {number} timestamp - Extraction timestamp
 * @property {Object} metadata - Additional provider-specific metadata
 */

/**
 * @typedef {Object} Fact
 * @property {string} id - Unique fact identifier
 * @property {string} originalText - Text as it appears in page
 * @property {string} searchableText - Rephrased version optimized for search
 * @property {string} category - Fact category (one of 9 categories)
 * @property {string} sentenceId - Reference to source sentence
 * @property {string[]} provenance - Agent IDs that extracted this fact
 * @property {boolean} isValid - Passed validation
 * @property {string|null} validationNote - Note if borderline/invalid
 */

/**
 * @typedef {Object} VerificationResult
 * @property {string} factId - ID of fact being verified
 * @property {string} agentId - ID of agent that performed verification
 * @property {string} verdict - 'TRUE' | 'FALSE' | 'UNVERIFIED'
 * @property {number} confidence - Confidence score 0-100
 * @property {string} confidenceCategory - 'low' | 'medium' | 'high'
 * @property {string} reasoning - Layman-friendly explanation
 * @property {Source[]} sources - Evidence sources (supporting and refuting)
 * @property {string|null} knowledgeCutoffMessage - Message if cutoff affected result
 * @property {number} tokensUsed - Number of tokens consumed
 * @property {number} timestamp - Verification timestamp
 */

/**
 * @typedef {Object} Source
 * @property {string} url - Validated URL
 * @property {string} title - Page title
 * @property {string} snippet - Relevant snippet
 * @property {string} domain - Extracted domain
 * @property {number} tier - Credibility tier (1-4, 1 = highest)
 * @property {boolean} isSupporting - True if supports fact, false if refutes
 * @property {number} validatedAt - Timestamp when URL was validated
 */

/**
 * @typedef {Object} ProviderInfo
 * @property {string} id - Provider ID ('openai' | 'anthropic' | 'google')
 * @property {string} displayName - Human-readable provider name
 * @property {string} model - Model identifier
 * @property {string} modelDisplayName - Human-readable model name
 * @property {string} knowledgeCutoff - Knowledge cutoff date (readable format)
 * @property {Date} knowledgeCutoffDate - Knowledge cutoff date (Date object)
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} id - Unique agent ID (UUID)
 * @property {string} providerId - Provider ID ('openai' | 'anthropic' | 'google')
 * @property {string} model - Model identifier
 * @property {string|null} encryptedCredential - Encrypted API key (for OpenAI/Anthropic)
 * @property {string|null} oauthToken - OAuth token (for Google, managed by Chrome)
 * @property {number} qualityRank - Model quality ranking for tiebreaking
 * @property {string} displayName - Human-readable agent name
 * @property {string} modelDisplayName - Human-readable model name
 * @property {string} knowledgeCutoff - Knowledge cutoff date
 */

// Export empty object to make this a module
export {};


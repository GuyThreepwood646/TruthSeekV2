/**
 * TruthSeek AI Provider Interface
 * Abstract base class defining the contract for all AI provider adapters
 */

/**
 * Abstract AI Provider Interface
 * All provider adapters (OpenAI, Anthropic, Google) must extend this class
 */
export class AIProvider {
  /**
   * Extract facts from HTML content
   * @param {string} htmlContent - Page content with sentences
   * @param {string[]} categories - Array of valid fact categories
   * @returns {Promise<ExtractionResult>} Extracted facts with metadata
   * @abstract
   */
  async extractFacts(htmlContent, categories) {
    throw new Error('extractFacts() must be implemented by subclass');
  }

  /**
   * Verify a fact using live web search
   * @param {object} fact - Fact object to verify
   * @param {string} category - Fact category for query optimization
   * @returns {Promise<VerificationResult>} Verification verdict with sources
   * @abstract
   */
  async verifyFactWithWebSearch(fact, category) {
    throw new Error('verifyFactWithWebSearch() must be implemented by subclass');
  }

  /**
   * Check if provider is authenticated
   * @returns {Promise<boolean>} True if authenticated
   * @abstract
   */
  async isAuthenticated() {
    throw new Error('isAuthenticated() must be implemented by subclass');
  }

  /**
   * Get provider information
   * @returns {ProviderInfo} Provider metadata
   * @abstract
   */
  getProviderInfo() {
    throw new Error('getProviderInfo() must be implemented by subclass');
  }

  /**
   * Get model quality ranking for deduplication tiebreaking
   * @returns {number} Quality rank (higher = better)
   * @abstract
   */
  getModelQualityRank() {
    throw new Error('getModelQualityRank() must be implemented by subclass');
  }
}

/**
 * Common error codes for AI provider operations
 */
export const AIProviderError = {
  // Authentication errors
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // API errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Request errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  TIMEOUT: 'TIMEOUT',
  
  // Response errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  PARSING_ERROR: 'PARSING_ERROR',
  
  // Search errors
  SEARCH_FAILED: 'SEARCH_FAILED',
  NO_RESULTS: 'NO_RESULTS'
};

Object.freeze(AIProviderError);

/**
 * AI Provider Exception class
 */
export class AIProviderException extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AIProviderException';
    this.code = code;
    this.details = details;
  }
}


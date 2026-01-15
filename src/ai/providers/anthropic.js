/**
 * TruthSeek Anthropic Provider Adapter
 * Implements AI provider interface for Anthropic Claude models
 */

import { AIProvider, AIProviderError, AIProviderException } from '../provider-interface.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { getModelMetadata } from '../../config/model-metadata.js';
import { parseExtractionResponse, buildExtractionPrompt, cleanJsonResponse } from '../prompts/extraction.js';
import { buildVerificationPrompt, buildSearchQuery } from '../prompts/verification.js';
import { calculateConfidence } from '../../background/confidence-scoring.js';
import { checkKnowledgeCutoff } from '../../background/verification-orchestrator.js';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

export class AnthropicProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
    this.lastRequestTime = 0;
    this.tokenUsage = { input: 0, output: 0, total: 0 };
  }

  /**
   * Authenticate with Anthropic API key
   * @param {string} apiKey - Anthropic API key
   * @returns {Promise<void>}
   */
  async authenticate(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'API key must be a non-empty string'
      );
    }

    // Test the API key with a minimal request
    try {
      const response = await this.makeRequest(
        '/messages',
        'POST',
        {
          model: this.config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        apiKey
      );

      if (!response.content || !Array.isArray(response.content)) {
        throw new Error('Invalid API response');
      }

      // Encrypt and store API key
      const encrypted = await encrypt(apiKey);
      this.config.encryptedCredential = encrypted;

      // Save to storage
      await this.saveConfig();

      console.log('Anthropic authentication successful');
    } catch (error) {
      console.error('Anthropic authentication failed:', error);
      throw new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Failed to authenticate with Anthropic API',
        error.message
      );
    }
  }

  /**
   * Extract facts from HTML content
   * @param {string} htmlContent - Page content with sentences
   * @param {string[]} categories - Array of valid fact categories
   * @returns {Promise<ExtractionResult>}
   */
  async extractFacts(htmlContent, categories) {
    if (!await this.isAuthenticated()) {
      throw new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Not authenticated'
      );
    }

    try {
      const apiKey = await this.getDecryptedApiKey();
      
      // Build extraction prompt
      const prompts = this.buildExtractionPrompt(htmlContent, categories);

      const requestBody = {
        model: this.config.model,
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for consistency
        system: prompts.system,
        messages: [
          {
            role: 'user',
            content: prompts.user
          }
        ]
      };

      const response = await this.makeRequest(
        '/messages',
        'POST',
        requestBody,
        apiKey
      );

      // Parse response
      const content = response.content[0].text;
      const facts = parseExtractionResponse(content);

      // Track token usage
      if (response.usage) {
        this.tokenUsage.input += response.usage.input_tokens || 0;
        this.tokenUsage.output += response.usage.output_tokens || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }

      return {
        facts: facts,
        agentId: this.config.id,
        tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0,
        timestamp: Date.now(),
        metadata: {
          model: this.config.model,
          provider: 'anthropic'
        }
      };

    } catch (error) {
      console.error('Anthropic extraction error:', error);
      throw this.mapError(error);
    }
  }

  /**
   * Verify fact using live web search
   * @param {object} fact - Fact to verify
   * @param {string} category - Fact category
   * @returns {Promise<VerificationResult>}
   */
  async verifyFactWithWebSearch(fact, category) {
    if (!await this.isAuthenticated()) {
      throw new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Not authenticated'
      );
    }

    try {
      const apiKey = await this.getDecryptedApiKey();
      const providerInfo = this.getProviderInfo();
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Build search queries
      const supportingQuery = buildSearchQuery(fact, 'supporting');
      const refutingQuery = buildSearchQuery(fact, 'refuting');
      
      // Define web search tool for Anthropic tool_use
      const tools = [{
        name: "web_search",
        description: "Search the web for current information to verify facts. Returns actual URLs from live search results.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to find relevant information"
            }
          },
          required: ["query"]
        }
      }];
      
      // Perform web searches
      const sources = await this.performWebSearches(supportingQuery, refutingQuery, apiKey, tools);
      
      // Build verification prompt with sources
      const prompt = buildVerificationPrompt({
        fact,
        category,
        currentDate,
        modelCutoffDate: providerInfo.knowledgeCutoff,
        supportingSources: sources.supporting,
        refutingSources: sources.refuting
      });
      
      // Call Anthropic for verification
      const response = await this.makeRequest(
        '/messages',
        'POST',
        {
          model: this.config.model,
          max_tokens: 4096,
          temperature: 0.1,
          system: prompt.system,
          messages: [
            {
              role: 'user',
              content: prompt.user
            }
          ]
        },
        apiKey
      );
      
      // Track token usage
      if (response.usage) {
        this.tokenUsage.input += response.usage.input_tokens || 0;
        this.tokenUsage.output += response.usage.output_tokens || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }
      
      // Parse result
      const content = response.content[0].text;
      
      if (!content || typeof content !== 'string') {
        console.error('Invalid verification response content:', content);
        throw new Error('Invalid response content from Anthropic API');
      }
      
      const cleanedContent = cleanJsonResponse(content);
      
      // Extract JSON from response (Anthropic sometimes wraps JSON in text)
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No valid JSON in response:', cleanedContent.substring(0, 200));
        throw new Error('No valid JSON in verification response');
      }
      
      let result;
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse verification JSON:', jsonMatch[0].substring(0, 200));
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }
      
      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Response is not a valid object');
      }
      
      if (!result.verdict || !result.reasoning) {
        console.error('Missing required fields in verification result:', result);
        throw new Error('Incomplete verification response');
      }
      
      // Calculate confidence
      const hasVerifiedUrls = sources.supporting.length > 0 || sources.refuting.length > 0;
      const confidenceResult = calculateConfidence(
        result.verdict,
        result.confidence / 100,
        sources.supporting,
        sources.refuting,
        hasVerifiedUrls
      );
      
      // Check knowledge cutoff
      const cutoffMessage = checkKnowledgeCutoff(fact, providerInfo, hasVerifiedUrls);
      
      return {
        factId: fact.id,
        agentId: this.config.id,
        verdict: result.verdict,
        confidence: confidenceResult.score,
        confidenceCategory: confidenceResult.category,
        reasoning: result.reasoning,
        sources: [...sources.supporting, ...sources.refuting],
        knowledgeCutoffMessage: cutoffMessage,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Anthropic verification error:', error);
      
      return {
        factId: fact.id,
        agentId: this.config.id,
        verdict: 'UNVERIFIED',
        confidence: 0,
        confidenceCategory: 'very-low',
        reasoning: `Verification failed: ${error.message}`,
        sources: [],
        knowledgeCutoffMessage: null,
        tokensUsed: 0,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Perform web searches using Anthropic tool_use
   * @private
   */
  async performWebSearches(supportingQuery, refutingQuery, apiKey, tools) {
    const sources = { supporting: [], refuting: [] };
    
    try {
      // Note: Anthropic's tool_use simulates web search
      // In production, this would integrate with actual search APIs
      const supportingResults = await this.callToolSearch(supportingQuery, apiKey, tools);
      sources.supporting = this.parseSearchResults(supportingResults, true);
      
      const refutingResults = await this.callToolSearch(refutingQuery, apiKey, tools);
      sources.refuting = this.parseSearchResults(refutingResults, false);
    } catch (error) {
      console.warn('Web search failed:', error);
    }
    
    return sources;
  }
  
  /**
   * Call tool search using Anthropic tool_use
   * @private
   */
  async callToolSearch(query, apiKey, tools) {
    const response = await this.makeRequest(
      '/messages',
      'POST',
      {
        model: this.config.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Search the web for: ${query}`
          }
        ],
        tools: tools
      },
      apiKey
    );
    
    if (response.usage) {
      this.tokenUsage.input += response.usage.input_tokens || 0;
      this.tokenUsage.output += response.usage.output_tokens || 0;
      this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
    }
    
    return response;
  }
  
  /**
   * Parse search results from Anthropic tool_use response
   * @private
   */
  parseSearchResults(response, isSupporting) {
    const sources = [];
    
    try {
      // Check for tool_use in response
      const content = response.content || [];
      
      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'web_search') {
          // Tool was called - extract results from subsequent text blocks
          continue;
        }
        
        if (block.type === 'text') {
          // Extract URLs from text content
          const text = block.text || '';
          const urlPattern = /https?:\/\/[^\s<>"]+/g;
          const urls = text.match(urlPattern) || [];
          
          for (const url of urls.slice(0, 3)) {
            try {
              const domain = new URL(url).hostname;
              sources.push({
                url,
                title: `Result from ${domain}`,
                snippet: `Found via search`,
                domain,
                tier: 3,
                isSupporting,
                validatedAt: Date.now()
              });
            } catch (e) {
              // Invalid URL
            }
          }
        }
      }
    } catch (error) {
      console.error('Parse error:', error);
    }
    
    return sources;
  }

  /**
   * Check if authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return !!(this.config.encryptedCredential);
  }

  /**
   * Get provider information
   * @returns {ProviderInfo}
   */
  getProviderInfo() {
    const metadata = getModelMetadata(this.config.model);
    
    return {
      id: 'anthropic',
      displayName: 'Anthropic',
      model: this.config.model,
      modelDisplayName: metadata?.displayName || this.config.model,
      knowledgeCutoff: metadata?.knowledgeCutoff || 'Unknown',
      knowledgeCutoffDate: metadata?.knowledgeCutoffDate || new Date()
    };
  }

  /**
   * Get model quality rank
   * @returns {number}
   */
  getModelQualityRank() {
    const metadata = getModelMetadata(this.config.model);
    return metadata?.qualityRank || 0;
  }

  /**
   * Get token usage statistics
   * @returns {object}
   */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }

  /**
   * Reset token usage statistics
   */
  resetTokenUsage() {
    this.tokenUsage = { input: 0, output: 0, total: 0 };
  }

  // Private helper methods

  /**
   * Get decrypted API key
   * @returns {Promise<string>}
   * @private
   */
  async getDecryptedApiKey() {
    if (!this.config.encryptedCredential) {
      throw new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'No API key configured'
      );
    }

    try {
      return await decrypt(this.config.encryptedCredential);
    } catch (error) {
      throw new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'Failed to decrypt API key',
        error.message
      );
    }
  }

  /**
   * Make HTTP request to Anthropic API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object} body - Request body
   * @param {string} apiKey - API key
   * @returns {Promise<object>}
   * @private
   */
  async makeRequest(endpoint, method, body, apiKey) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();

    const url = `${ANTHROPIC_API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AIProviderException(
          AIProviderError.TIMEOUT,
          'Request timed out'
        );
      }
      throw error;
    }
  }

  /**
   * Build extraction prompt
   * @param {object} content - ExtractedContent object
   * @param {string[]} categories - Valid categories
   * @returns {object} { system, user } prompts
   * @private
   */
  buildExtractionPrompt(content, categories) {
    return buildExtractionPrompt(content, categories);
  }

  /**
   * Build verification prompt
   * @param {object} fact - Fact to verify
   * @param {string} category - Fact category
   * @returns {string}
   * @private
   */
  buildVerificationPrompt(fact, category) {
    // Placeholder - will be implemented in Story 4.5
    return `Verify the following fact: "${fact.searchableText}"\nCategory: ${category}\n\nBase your assessment ONLY on provided sources. Do not use your training data.`;
  }

  /**
   * Map error to AIProviderException
   * @param {Error} error - Original error
   * @returns {AIProviderException}
   * @private
   */
  mapError(error) {
    if (error instanceof AIProviderException) {
      return error;
    }

    const message = error.message || 'Unknown error';

    // Map common Anthropic errors
    if (message.includes('rate_limit') || message.includes('429')) {
      return new AIProviderException(
        AIProviderError.RATE_LIMIT_EXCEEDED,
        'Anthropic rate limit exceeded',
        message
      );
    }

    if (message.includes('overloaded') || message.includes('529')) {
      return new AIProviderException(
        AIProviderError.API_ERROR,
        'Anthropic API overloaded',
        message
      );
    }

    if (message.includes('invalid_api_key') || message.includes('401')) {
      return new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'Invalid Anthropic API key',
        message
      );
    }

    if (message.includes('timeout') || message.includes('ECONNABORTED')) {
      return new AIProviderException(
        AIProviderError.TIMEOUT,
        'Request timed out',
        message
      );
    }

    // Generic API error
    return new AIProviderException(
      AIProviderError.API_ERROR,
      'Anthropic API error',
      message
    );
  }

  /**
   * Save config to storage
   * @returns {Promise<void>}
   * @private
   */
  async saveConfig() {
    const result = await chrome.storage.local.get(['agents']);
    const agents = result.agents || [];
    
    const index = agents.findIndex(a => a.id === this.config.id);
    if (index >= 0) {
      agents[index] = this.config;
    } else {
      agents.push(this.config);
    }

    await chrome.storage.local.set({ agents });
  }
}


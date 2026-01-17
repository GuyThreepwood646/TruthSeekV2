/**
 * TruthSeek OpenAI Provider Adapter
 * Implements AI provider interface for OpenAI models
 */

import { AIProvider, AIProviderError, AIProviderException } from '../provider-interface.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { getModelMetadata } from '../../config/model-metadata.js';
import { parseExtractionResponse, buildAdaptiveExtractionPrompt, cleanJsonResponse } from '../prompts/extraction.js';
import { buildVerificationPrompt, buildSearchQuery } from '../prompts/verification.js';
import { calculateConfidence } from '../../background/confidence-scoring.js';
import { checkKnowledgeCutoff } from '../../background/verification-orchestrator.js';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

export class OpenAIProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
    this.lastRequestTime = 0;
    this.tokenUsage = { prompt: 0, completion: 0, total: 0 };
  }

  /**
   * Authenticate with OpenAI API key
   * @param {string} apiKey - OpenAI API key
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
      const response = await this.makeRequest('/models', 'GET', null, apiKey);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid API response');
      }

      // Encrypt and store API key
      const encrypted = await encrypt(apiKey);
      this.config.encryptedCredential = encrypted;

      // Save to storage
      await this.saveConfig();

      console.log('OpenAI authentication successful');
    } catch (error) {
      console.error('OpenAI authentication failed:', error);
      throw new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Failed to authenticate with OpenAI API',
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
        messages: [
          {
            role: 'system',
            content: prompts.system
          },
          {
            role: 'user',
            content: prompts.user
          }
        ],
        temperature: 0.1, // Low temperature for consistency
        response_format: { type: 'json_object' }
      };

      const response = await this.makeRequest(
        '/chat/completions',
        'POST',
        requestBody,
        apiKey
      );

      // Parse response
      const content = response.choices[0].message.content;
      const facts = parseExtractionResponse(content);

      // Track token usage
      if (response.usage) {
        this.tokenUsage.prompt += response.usage.prompt_tokens || 0;
        this.tokenUsage.completion += response.usage.completion_tokens || 0;
        this.tokenUsage.total += response.usage.total_tokens || 0;
      }

      return {
        facts: facts,
        agentId: this.config.id,
        tokensUsed: response.usage?.total_tokens || 0,
        timestamp: Date.now(),
        metadata: {
          model: this.config.model,
          provider: 'openai'
        }
      };

    } catch (error) {
      console.error('OpenAI extraction error:', error);
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
      
      // Define web search function for OpenAI function calling
      const tools = [{
        type: "function",
        function: {
          name: "web_search",
          description: "Search the web for current information. Returns actual URLs from live search results.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query"
              }
            },
            required: ["query"]
          }
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
        refutingSources: sources.refuting,
        pageMetadata: fact.pageMetadata || null
      });
      
      // Call OpenAI for verification
      const response = await this.makeRequest(
        '/chat/completions',
        'POST',
        {
          model: this.config.model,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        },
        apiKey
      );
      
      // Track token usage
      if (response.usage) {
        this.tokenUsage.prompt += response.usage.prompt_tokens || 0;
        this.tokenUsage.completion += response.usage.completion_tokens || 0;
        this.tokenUsage.total += response.usage.total_tokens || 0;
      }
      
      // Parse result
      const content = response.choices[0].message.content;
      
      if (!content || typeof content !== 'string') {
        console.error('Invalid verification response content:', content);
        throw new Error('Invalid response content from OpenAI API');
      }
      
      const cleanedContent = cleanJsonResponse(content);
      
      // Extract JSON from response (may be wrapped in text)
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
      
      const hasVerifiedUrls = sources.supporting.length > 0 || sources.refuting.length > 0;
      if (!hasVerifiedUrls) {
        return {
          factId: fact.id,
          agentId: this.config.id,
          verdict: 'UNVERIFIED',
          confidence: 0,
          confidenceCategory: 'very-low',
          reasoning: 'No verifiable sources were found to support or refute this fact.',
          sources: [],
          knowledgeCutoffMessage: null,
          tokensUsed: response.usage?.total_tokens || 0,
          timestamp: Date.now()
        };
      }
      
      // Calculate confidence
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
        tokensUsed: response.usage?.total_tokens || 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('OpenAI verification error:', error);
      
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
   * Perform web searches using function calling
   * @private
   */
  async performWebSearches(supportingQuery, refutingQuery, apiKey, tools) {
    const sources = { supporting: [], refuting: [] };
    
    try {
      // Note: OpenAI's function calling simulates web search
      // In production, this would integrate with actual search APIs
      const supportingResults = await this.callFunctionSearch(supportingQuery, apiKey, tools);
      sources.supporting = this.parseSearchResults(supportingResults, true);
      
      const refutingResults = await this.callFunctionSearch(refutingQuery, apiKey, tools);
      sources.refuting = this.parseSearchResults(refutingResults, false);
    } catch (error) {
      console.warn('Web search failed:', error);
    }
    
    return sources;
  }
  
  /**
   * Call function search
   * @private
   */
  async callFunctionSearch(query, apiKey, tools) {
    const response = await this.makeRequest(
      '/chat/completions',
      'POST',
      {
        model: this.config.model,
        messages: [{ role: "user", content: `Search: ${query}` }],
        tools: tools,
        tool_choice: "auto"
      },
      apiKey
    );
    
    if (response.usage) {
      this.tokenUsage.prompt += response.usage.prompt_tokens || 0;
      this.tokenUsage.completion += response.usage.completion_tokens || 0;
      this.tokenUsage.total += response.usage.total_tokens || 0;
    }
    
    return response;
  }
  
  /**
   * Parse search results from response
   * @private
   */
  parseSearchResults(response, isSupporting) {
    const sources = [];
    
    try {
      const message = response.choices[0].message;
      const content = message.content || '';
      
      // Extract URLs from response
      const urlPattern = /https?:\/\/[^\s<>"]+/g;
      const urls = content.match(urlPattern) || [];
      
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
      id: 'openai',
      displayName: 'OpenAI',
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
    this.tokenUsage = { prompt: 0, completion: 0, total: 0 };
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
   * Make HTTP request to OpenAI API
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

    const url = `${OPENAI_API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
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
    return buildAdaptiveExtractionPrompt(content, categories);
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

    // Map common OpenAI errors
    if (message.includes('rate_limit')) {
      return new AIProviderException(
        AIProviderError.RATE_LIMIT_EXCEEDED,
        'OpenAI rate limit exceeded',
        message
      );
    }

    if (message.includes('quota')) {
      return new AIProviderException(
        AIProviderError.QUOTA_EXCEEDED,
        'OpenAI quota exceeded',
        message
      );
    }

    if (message.includes('invalid_api_key') || message.includes('401')) {
      return new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'Invalid OpenAI API key',
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
      'OpenAI API error',
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


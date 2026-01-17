/**
 * TruthSeek Google (Gemini) Provider Adapter
 * Implements AI provider interface for Google Gemini models using API Key
 */

import { AIProvider, AIProviderError, AIProviderException } from '../provider-interface.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { getModelMetadata } from '../../config/model-metadata.js';
import { parseExtractionResponse, buildAdaptiveExtractionPrompt, cleanJsonResponse } from '../prompts/extraction.js';
import { buildVerificationPrompt, buildSearchQuery, buildGroundedVerificationPrompt } from '../prompts/verification.js';
import { calculateConfidence } from '../../background/confidence-scoring.js';
import { checkKnowledgeCutoff } from '../../background/verification-orchestrator.js';
import { resolveGoogleGroundingUrl, isGoogleGroundingRedirect } from '../../utils/url-resolver.js';

const GOOGLE_AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

export class GoogleProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
    this.lastRequestTime = 0;
    this.tokenUsage = { input: 0, output: 0, total: 0 };
  }

  /**
   * Authenticate with Google API Key
   * @param {string} apiKey - Google API key
   * @returns {Promise<void>}
   */
  async authenticate(apiKey) {
    if (!apiKey) {
      throw new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'Google API key is required'
      );
    }
    
    try {
      // Store API key temporarily for testing
      this.config.apiKey = apiKey;
      
      // Test the API key with a minimal request
      await this.makeRequest(
        `/models/${this.config.model}`,
        'GET',
        null
      );

      // Encrypt and store API key
      const encrypted = await encrypt(apiKey);
      this.config.encryptedCredential = encrypted;

      // Save to storage
      await this.saveConfig();

      console.log('Google API key authentication successful');
    } catch (error) {
      console.error('Google API key authentication failed:', error);
      throw new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Failed to authenticate with Google API key',
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
      
      // Store temporarily for makeRequest
      this.config.apiKey = apiKey;
      
      // Build extraction prompt
      const prompts = this.buildExtractionPrompt(htmlContent, categories);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `${prompts.system}\n\n${prompts.user}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistency
          candidateCount: 1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      };

      const response = await this.makeRequest(
        `/models/${this.config.model}:generateContent`,
        'POST',
        requestBody
      );

      // Validate response structure
      if (!response || !response.candidates || !response.candidates[0]) {
        console.error('Invalid API response structure:', response);
        throw new Error('Invalid response from Google API');
      }
      
      if (!response.candidates[0].content || !response.candidates[0].content.parts || !response.candidates[0].content.parts[0]) {
        console.error('Missing content in API response:', response.candidates[0]);
        throw new Error('No content in API response');
      }
      
      if (!response || !response.candidates || !response.candidates[0] ||
          !response.candidates[0].content || !response.candidates[0].content.parts ||
          !response.candidates[0].content.parts[0]) {
        console.error('Invalid verification response structure:', response);
        throw new Error('Invalid verification response structure from Google API');
      }
      
      // Parse response
      const candidate = response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const textPart = parts.find(part => typeof part?.text === 'string');
      const content = textPart?.text;
      
      if (!content || typeof content !== 'string') {
        console.error('Invalid content type:', typeof content);
        throw new Error('Invalid content format from API');
      }
      
      const facts = parseExtractionResponse(content);

      // Track token usage
      if (response.usageMetadata) {
        this.tokenUsage.input += response.usageMetadata.promptTokenCount || 0;
        this.tokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }

      return {
        facts: facts,
        agentId: this.config.id,
        tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        timestamp: Date.now(),
        metadata: {
          model: this.config.model,
          provider: 'google'
        }
      };

    } catch (error) {
      console.error('Google extraction error:', error);
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
      
      // Store temporarily for makeRequest
      this.config.apiKey = apiKey;
      
      const providerInfo = this.getProviderInfo();
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Build verification prompt optimized for Google Search grounding
      // Google Search grounding allows the model to access web pages directly,
      // so we don't need to pre-fetch and provide snippets
      const prompt = buildGroundedVerificationPrompt({
        fact,
        category,
        currentDate,
        modelCutoffDate: providerInfo.knowledgeCutoff,
        pageMetadata: fact.pageMetadata || null
      });
      
      // Call Gemini for verification with Google Search grounding
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt.system + '\n\n' + prompt.user
              }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}  // Enable Google Search grounding
          }
        ],
        generationConfig: {
          temperature: 0.1,
          candidateCount: 1,
          maxOutputTokens: 4096
          // Note: responseMimeType cannot be used with tools (Google Search)
          // We'll parse the JSON from the text response instead
        }
      };

      const response = await this.makeRequest(
        `/models/${this.config.model}:generateContent`,
        'POST',
        requestBody
      );

      // Track token usage
      if (response.usageMetadata) {
        this.tokenUsage.input += response.usageMetadata.promptTokenCount || 0;
        this.tokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }

      const candidate = response?.candidates?.[0];
      const content = extractCandidateText(candidate);
      
      if (!content) {
        const groundingMetadata = candidate?.groundingMetadata || null;
        const groundedSources = await this.extractGroundingSources(groundingMetadata);
        const finishReason = candidate?.finishReason || 'unknown';
        
        console.warn('[Google] No verification text returned:', {
          finishReason,
          hasGrounding: !!groundingMetadata,
          responseId: response?.responseId || null
        });
        
        return {
          factId: fact.id,
          agentId: this.config.id,
          verdict: 'UNVERIFIED',
          confidence: 0,
          confidenceCategory: 'very-low',
          reasoning: `No verification text returned by Google model (finishReason: ${finishReason})`,
          sources: [...groundedSources.supporting, ...groundedSources.refuting],
          knowledgeCutoffMessage: null,
          tokensUsed: response.usageMetadata?.totalTokenCount || 0,
          timestamp: Date.now()
        };
      }

function extractCandidateText(candidate) {
  if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  
  const textParts = candidate.content.parts
    .map(part => part?.text)
    .filter(text => typeof text === 'string' && text.trim().length > 0);
  
  if (textParts.length === 0) {
    return null;
  }
  
  return textParts.join('\n').trim();
}
      
      // Clean and parse JSON response
      const cleanedContent = cleanJsonResponse(content);
      
      // Extract JSON from response (may be wrapped in text when using tools)
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
      
      // Extract grounding metadata if available
      const groundingMetadata = candidate?.groundingMetadata;
      if (groundingMetadata && groundingMetadata.webSearchQueries) {
        console.log('[Google] Search queries used:', groundingMetadata.webSearchQueries);
      }
      
      // Extract sources from grounding chunks
      // Note: snippets may be empty, but URLs and titles should be present
      const groundedSources = await this.extractGroundingSources(groundingMetadata);
      
      // Calculate confidence
      const hasVerifiedUrls = groundedSources.supporting.length > 0 || groundedSources.refuting.length > 0;
      const confidenceResult = calculateConfidence(
        result.verdict,
        result.confidence / 100,
        groundedSources.supporting,
        groundedSources.refuting,
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
        sources: [...groundedSources.supporting, ...groundedSources.refuting],
        knowledgeCutoffMessage: cutoffMessage,
        tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Google verification error:', error);
      
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
   * Perform web searches using Google Search grounding
   * @private
   */
  async performWebSearches(supportingQuery, refutingQuery) {
    const sources = { supporting: [], refuting: [] };
    
    try {
      // Call Gemini with Google Search for supporting evidence
      const supportingResults = await this.callGroundedSearch(supportingQuery);
      sources.supporting = await this.parseGroundedResults(supportingResults, true);
      
      // Call Gemini with Google Search for refuting evidence
      const refutingResults = await this.callGroundedSearch(refutingQuery);
      sources.refuting = await this.parseGroundedResults(refutingResults, false);
    } catch (error) {
      console.warn('Google Search grounding failed:', error);
    }
    
    return sources;
  }
  
  /**
   * Call Gemini with Google Search grounding
   * @private
   */
  async callGroundedSearch(query) {
    const response = await this.makeRequest(
      `/models/${this.config.model}:generateContent`,
      'POST',
      {
        contents: [
          {
            parts: [
              {
                text: `Search for: ${query}`
              }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      }
    );
    
    if (response.usageMetadata) {
      this.tokenUsage.input += response.usageMetadata.promptTokenCount || 0;
      this.tokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
      this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
    }
    
    return response;
  }
  
  /**
   * Parse grounded search results
   * @private
   */
  async parseGroundedResults(response, isSupporting) {
    const sources = [];
    
    try {
      const groundingMetadata = response.candidates[0]?.groundingMetadata;
      
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        // Resolve all URLs in parallel
        const urlResolutions = [];
        
        for (const chunk of groundingMetadata.groundingChunks.slice(0, 3)) {
          if (chunk.web) {
            const originalUrl = chunk.web.uri;
            
            // Resolve redirect URL if it's a Google Grounding redirect
            if (isGoogleGroundingRedirect(originalUrl)) {
              urlResolutions.push(
                resolveGoogleGroundingUrl(originalUrl)
                  .then(resolvedUrl => ({
                    originalUrl,
                    resolvedUrl: resolvedUrl || originalUrl,
                    chunk
                  }))
                  .catch(error => {
                    console.warn(`[Google] Failed to resolve redirect URL: ${error.message}`);
                    return {
                      originalUrl,
                      resolvedUrl: originalUrl, // Fallback to original
                      chunk
                    };
                  })
              );
            } else {
              // Not a redirect, use as-is
              urlResolutions.push(Promise.resolve({
                originalUrl,
                resolvedUrl: originalUrl,
                chunk
              }));
            }
          }
        }
        
        // Wait for all URL resolutions
        const resolved = await Promise.all(urlResolutions);
        
        // Build sources with resolved URLs
        for (const { resolvedUrl, chunk } of resolved) {
          try {
            const domain = new URL(resolvedUrl).hostname;
            sources.push({
              url: resolvedUrl,
              title: chunk.web.title || `Result from ${domain}`,
              snippet: chunk.web.snippet || '',
              domain: domain,
              tier: 3,
              isSupporting,
              validatedAt: Date.now()
            });
          } catch (urlError) {
            console.warn(`[Google] Invalid resolved URL: ${resolvedUrl}`, urlError);
            // Skip invalid URLs
          }
        }
      }
    } catch (error) {
      console.error('[Google] Parse error:', error);
    }
    
    return sources;
  }
  
  /**
   * Extract sources from grounding metadata
   * @private
   */
  async extractGroundingSources(groundingMetadata) {
    const sources = { supporting: [], refuting: [] };
    
    if (!groundingMetadata || !groundingMetadata.groundingChunks) {
      console.log('[Google] No grounding metadata available');
      return sources;
    }
    
    console.log(`[Google] Processing ${groundingMetadata.groundingChunks.length} grounding chunks`);
    
    try {
      // Resolve all URLs in parallel
      const urlResolutions = [];
      
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          const originalUrl = chunk.web.uri;
          
          // Resolve redirect URL if it's a Google Grounding redirect
          if (isGoogleGroundingRedirect(originalUrl)) {
            urlResolutions.push(
              resolveGoogleGroundingUrl(originalUrl)
                .then(resolvedUrl => ({
                  originalUrl,
                  resolvedUrl: resolvedUrl || originalUrl,
                  chunk
                }))
                .catch(error => {
                  console.warn(`[Google] Failed to resolve redirect URL: ${error.message}`);
                  return {
                    originalUrl,
                    resolvedUrl: originalUrl, // Fallback to original
                    chunk
                  };
                })
            );
          } else {
            // Not a redirect, use as-is
            urlResolutions.push(Promise.resolve({
              originalUrl,
              resolvedUrl: originalUrl,
              chunk
            }));
          }
        }
      }
      
      // Wait for all URL resolutions
      const resolved = await Promise.all(urlResolutions);
      
      // Build sources with resolved URLs
      for (const { resolvedUrl, chunk } of resolved) {
        try {
          const domain = new URL(resolvedUrl).hostname;
          // Determine if supporting or refuting based on context
          // For now, add to supporting (proper classification would need more context)
          sources.supporting.push({
            url: resolvedUrl,
            title: chunk.web.title || `Result from ${domain}`,
            snippet: chunk.web.snippet || '',
            domain: domain,
            tier: 3,
            isSupporting: true,
            validatedAt: Date.now()
          });
        } catch (urlError) {
          console.warn(`[Google] Invalid resolved URL: ${resolvedUrl}`, urlError);
          // Skip invalid URLs
        }
      }
      
      console.log(`[Google] Extracted ${sources.supporting.length} sources from grounding metadata`);
    } catch (error) {
      console.error('[Google] Error extracting grounding sources:', error);
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
   * Get provider information
   * @returns {ProviderInfo}
   */
  getProviderInfo() {
    const metadata = getModelMetadata(this.config.model);
    
    return {
      id: 'google',
      displayName: 'Google',
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

  /**
   * Revoke API key (clear from storage)
   * @returns {Promise<void>}
   */
  async revokeAccess() {
    if (this.config.encryptedCredential) {
      try {
        this.config.encryptedCredential = null;
        this.config.apiKey = null;
        await this.saveConfig();
        console.log('Google API key removed');
      } catch (error) {
        console.error('Error removing API key:', error);
      }
    }
  }

  // Private helper methods

  /**
   * Make HTTP request to Google AI API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object} body - Request body
   * @returns {Promise<object>}
   * @private
   */
  async makeRequest(endpoint, method, body) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();

    // Add API key as query parameter
    const url = new URL(`${GOOGLE_AI_API_BASE}${endpoint}`);
    url.searchParams.set('key', this.config.apiKey);
    
    const headers = {
      'Content-Type': 'application/json'
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(url.toString(), {
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

    // Map common Google AI errors
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      return new AIProviderException(
        AIProviderError.RATE_LIMIT_EXCEEDED,
        'Google AI rate limit exceeded',
        message
      );
    }

    if (message.includes('UNAUTHENTICATED') || message.includes('401')) {
      return new AIProviderException(
        AIProviderError.INVALID_CREDENTIALS,
        'Invalid or expired OAuth token',
        message
      );
    }

    if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
      return new AIProviderException(
        AIProviderError.AUTH_FAILED,
        'Permission denied',
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
      'Google AI API error',
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


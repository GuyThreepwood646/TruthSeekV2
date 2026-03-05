/**
 * TruthSeek Google (Gemini) Provider Adapter
 * Implements AI provider interface for Google Gemini models using API Key
 */

import { AIProvider, AIProviderError, AIProviderException } from '../provider-interface.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { getModelMetadata } from '../../config/model-metadata.js';
import { parseExtractionResponse, buildAdaptiveExtractionPrompt, cleanJsonResponse } from '../prompts/extraction.js';
import { buildVerificationPrompt, buildSearchQuery, buildTierBiasedQuery, buildDomainBiasedQuery, buildMetadataQueries, buildCategoryQueries, buildNoEvidenceFallbackPrompt } from '../prompts/verification.js';
import { calculateConfidence, categorizeScore } from '../../background/confidence-scoring.js';
import { assignSourceTier, sortSourcesByTierPreference } from '../../background/source-tiering.js';
import { checkKnowledgeCutoff } from '../../background/verification-orchestrator.js';
import { filterValidSources } from '../../background/url-validator.js';
import { resolveGoogleGroundingUrl, isGoogleGroundingRedirect } from '../../utils/url-resolver.js';
import { extractJsonObject, buildFallbackVerificationResult } from '../../utils/json-sanitizer.js';

const GOOGLE_AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_SOURCES_PER_QUERY = 3;
const MAX_SOURCES_PER_DIRECTION = 3;
const GENERAL_RANK_OFFSET = 10;
const MAX_QUERY_VARIANTS = 4;

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
      
      const supportingQuery = buildSearchQuery(fact, 'supporting');
      const refutingQuery = buildSearchQuery(fact, 'refuting');
      const supportingTierQuery = buildTierBiasedQuery(fact, 'supporting');
      const refutingTierQuery = buildTierBiasedQuery(fact, 'refuting');
      const supportingDomainQuery = buildDomainBiasedQuery(fact, category, 'supporting');
      const refutingDomainQuery = buildDomainBiasedQuery(fact, category, 'refuting');
      const supportingMetadataQueries = buildMetadataQueries(fact, fact.pageMetadata || null, 'supporting');
      const refutingMetadataQueries = buildMetadataQueries(fact, fact.pageMetadata || null, 'refuting');
      const supportingCategoryQueries = buildCategoryQueries(fact, category, 'supporting');
      const refutingCategoryQueries = buildCategoryQueries(fact, category, 'refuting');
      
      const supportingQueries = this.buildQuerySet([
        supportingTierQuery,
        supportingDomainQuery,
        supportingQuery,
        ...supportingMetadataQueries,
        ...supportingCategoryQueries
      ]);
      
      const refutingQueries = this.buildQuerySet([
        refutingTierQuery,
        refutingDomainQuery,
        refutingQuery,
        ...refutingMetadataQueries,
        ...refutingCategoryQueries
      ]);
      
      const sources = await this.performWebSearches(
        {
          supportingQueries,
          refutingQueries
        },
        category,
        fact.id
      );
      
      let validatedSources = sources;
      try {
        const supportingValidated = await filterValidSources(sources.supporting, fact.originalText, fact.id);
        const refutingValidated = await filterValidSources(sources.refuting, fact.originalText, fact.id);
        validatedSources = { supporting: supportingValidated, refuting: refutingValidated };
      } catch (error) {
        console.warn('[Google] Source validation failed, using raw sources:', error);
      }
      
      const hasVerifiedUrls = validatedSources.supporting.length > 0 || validatedSources.refuting.length > 0;
      if (!hasVerifiedUrls) {
        const fallbackResult = await this.runNoEvidenceFallback(fact, category, providerInfo, currentDate);
        const fallbackConfidence = fallbackResult.hasModelKnowledge ? fallbackResult.confidence : 0;
        
        return {
          factId: fact.id,
          agentId: this.config.id,
          verdict: 'UNVERIFIED',
          confidence: fallbackConfidence,
          confidenceCategory: categorizeScore(fallbackConfidence),
          reasoning: fallbackResult.reasoning,
          sources: [],
          knowledgeCutoffMessage: null,
          tokensUsed: 0,
          timestamp: Date.now(),
          hasModelKnowledge: fallbackResult.hasModelKnowledge
        };
      }
      
      const prompt = buildVerificationPrompt({
        fact,
        category,
        currentDate,
        modelCutoffDate: providerInfo.knowledgeCutoff,
        supportingSources: validatedSources.supporting,
        refutingSources: validatedSources.refuting,
        pageMetadata: fact.pageMetadata || null
      });
      
      const response = await this.makeRequest(
        `/models/${this.config.model}:generateContent`,
        'POST',
        {
          contents: [
            {
              parts: [
                {
                  text: `${prompt.system}\n\n${prompt.user}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            candidateCount: 1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        }
      );
      
      if (response.usageMetadata) {
        this.tokenUsage.input += response.usageMetadata.promptTokenCount || 0;
        this.tokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }
      
      const candidate = response?.candidates?.[0];
      const content = this.extractCandidateText(candidate);
      
      if (!content) {
        return {
          factId: fact.id,
          agentId: this.config.id,
          verdict: 'UNVERIFIED',
          confidence: 0,
          confidenceCategory: 'very-low',
          reasoning: 'No verification text returned by Google model.',
          sources: [...validatedSources.supporting, ...validatedSources.refuting],
          knowledgeCutoffMessage: null,
          tokensUsed: response.usageMetadata?.totalTokenCount || 0,
          timestamp: Date.now()
        };
      }

      // Clean and parse JSON response
      const cleanedContent = cleanJsonResponse(content);
      
      // Extract JSON from response
      let result = extractJsonObject(cleanedContent);
      if (!result) {
        console.warn(`[Google] No valid JSON in response (${fact.id}), using fallback parsing:`, cleanedContent.substring(0, 200));
        result = buildFallbackVerificationResult(cleanedContent);
      }
      
      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Response is not a valid object');
      }
      
      if (!result.verdict || !result.reasoning) {
        console.warn(`[Google] Missing required fields in verification result (${fact.id}), using fallback text.`);
        const fallback = buildFallbackVerificationResult(cleanedContent);
        result = {
          ...fallback,
          ...result
        };
      }
      
      // Calculate confidence
      const confidenceResult = calculateConfidence(
        result.verdict,
        result.confidence / 100,
        validatedSources.supporting,
        validatedSources.refuting,
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
        sources: [...validatedSources.supporting, ...validatedSources.refuting],
        knowledgeCutoffMessage: cutoffMessage,
        tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error(`[Google] Verification error (${fact.id}):`, error);
      
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
   * Extract text content from a Gemini candidate response
   * @param {object|null} candidate - Gemini candidate
   * @returns {string|null}
   * @private
   */
  extractCandidateText(candidate) {
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
  
  /**
   * Perform web searches using Google Search grounding
   * @private
   */
  async performWebSearches(queries, category, factId = null) {
    const sources = { supporting: [], refuting: [] };
    
    try {
      sources.supporting = await this.runSearchQueries(
        queries.supportingQueries,
        true,
        category,
        factId
      );
      
      sources.refuting = await this.runSearchQueries(
        queries.refutingQueries,
        false,
        category,
        factId
      );
    } catch (error) {
      console.warn('Google Search grounding failed:', error);
    }
    
    return sources;
  }
  
  async runSearchQueries(queries, isSupporting, category, factId) {
    let merged = [];
    const safeQueries = Array.isArray(queries) ? queries : [];
    
    for (let i = 0; i < safeQueries.length; i++) {
      const query = safeQueries[i];
      if (!query) {
        continue;
      }
      const response = await this.callGroundedSearch(query);
      const parsed = await this.parseGroundedResults(
        response,
        isSupporting,
        i * GENERAL_RANK_OFFSET,
        category,
        factId
      );
      merged = this.mergeSources(merged, parsed);
    }
    
    return sortSourcesByTierPreference(merged)
      .slice(0, MAX_SOURCES_PER_DIRECTION);
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

  buildQuerySet(queries) {
    const seen = new Set();
    const results = [];
    
    for (const query of queries) {
      const trimmed = query?.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      results.push(trimmed);
      if (results.length >= MAX_QUERY_VARIANTS) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Run internal-knowledge fallback when no evidence URLs exist
   * @param {Fact} fact - Fact to verify
   * @param {string} category - Fact category
   * @param {object} providerInfo - Provider metadata
   * @param {string} currentDate - Current date
   * @returns {Promise<{confidence: number, reasoning: string, hasModelKnowledge: boolean}>}
   * @private
   */
  async runNoEvidenceFallback(fact, category, providerInfo, currentDate) {
    try {
      const prompt = buildNoEvidenceFallbackPrompt({
        fact,
        category,
        currentDate,
        modelCutoffDate: providerInfo.knowledgeCutoff
      });
      
      const response = await this.makeRequest(
        `/models/${this.config.model}:generateContent`,
        'POST',
        {
          contents: [
            {
              parts: [
                {
                  text: `${prompt.system}\n\n${prompt.user}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        }
      );
      
      if (response.usageMetadata) {
        this.tokenUsage.input += response.usageMetadata.promptTokenCount || 0;
        this.tokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
      }
      
      const candidate = response?.candidates?.[0];
      const contentParts = candidate?.content?.parts || [];
      const textParts = contentParts
        .map(part => part?.text)
        .filter(text => typeof text === 'string' && text.trim().length > 0);
      const content = textParts.join('\n').trim();
      
      if (!content) {
        return {
          confidence: 0,
          reasoning: 'No model-only reasoning available.',
          hasModelKnowledge: false
        };
      }
      
      const cleanedContent = cleanJsonResponse(content);
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        return {
          confidence: 0,
          reasoning: 'No model-only reasoning available.',
          hasModelKnowledge: false
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const hasModelKnowledge = parsed?.hasModelKnowledge !== false;
      
      if (!hasModelKnowledge || !parsed?.reasoning) {
        return {
          confidence: 0,
          reasoning: parsed?.reasoning || 'No model-only reasoning available.',
          hasModelKnowledge: false
        };
      }
      
      const rawConfidence = Number.isFinite(parsed.confidence) ? parsed.confidence : 0;
      const confidence = Math.max(0, Math.min(70, rawConfidence));
      
      return {
        confidence,
        reasoning: parsed.reasoning,
        hasModelKnowledge: true
      };
    } catch (error) {
      console.warn(`[Google] Fallback reasoning failed (${fact.id}):`, error);
      return {
        confidence: 0,
        reasoning: 'No model-only reasoning available.',
        hasModelKnowledge: false
      };
    }
  }
  
  /**
   * Parse grounded search results
   * @private
   */
  async parseGroundedResults(response, isSupporting, rankOffset = 0, category = null, factId = null) {
    const sources = [];
    
    try {
      const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
      
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        // Resolve all URLs in parallel
        const urlResolutions = [];
        
        const chunks = groundingMetadata.groundingChunks.slice(0, MAX_SOURCES_PER_QUERY);
        for (const chunk of chunks) {
          if (chunk.web) {
            const originalUrl = chunk.web.uri;
            
            // Resolve redirect URL if it's a Google Grounding redirect
            if (isGoogleGroundingRedirect(originalUrl)) {
              urlResolutions.push(
                resolveGoogleGroundingUrl(originalUrl, { factId })
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
        for (const [index, resolvedItem] of resolved.entries()) {
          const { resolvedUrl, chunk } = resolvedItem;
          try {
            const domain = new URL(resolvedUrl).hostname;
            sources.push({
              url: resolvedUrl,
              title: chunk.web.title || `Result from ${domain}`,
              snippet: chunk.web.snippet || '',
              domain: domain,
              tier: assignSourceTier(domain, category),
              isSupporting,
              validatedAt: Date.now(),
              rankIndex: rankOffset + index
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
   * Merge sources and remove duplicates by normalized URL
   * @param {Source[]} primary - Primary sources
   * @param {Source[]} secondary - Secondary sources
   * @returns {Source[]}
   * @private
   */
  mergeSources(primary, secondary) {
    const merged = [];
    const seen = new Set();
    
    for (const source of [...primary, ...secondary]) {
      const normalized = this.normalizeUrl(source.url);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      merged.push(source);
    }
    
    return merged;
  }

  /**
   * Normalize URL for deduplication
   * @param {string} url - URL to normalize
   * @returns {string}
   * @private
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      let normalized = `${parsed.origin}${parsed.pathname}`;
      normalized = normalized.replace(/\/$/, '');
      return normalized.toLowerCase();
    } catch (error) {
      return (url || '').toLowerCase();
    }
  }
  
  /**
   * Extract sources from grounding metadata
   * @private
   */
  async extractGroundingSources(groundingMetadata, category = null, factId = null) {
    const sources = { supporting: [], refuting: [] };
    const factSuffix = factId ? ` (${factId})` : '';
    
    if (!groundingMetadata || !groundingMetadata.groundingChunks) {
      console.log(`[Google] No grounding metadata available${factSuffix}`);
      return sources;
    }
    
    console.log(`[Google] Processing ${groundingMetadata.groundingChunks.length} grounding chunks${factSuffix}`);
    
    try {
      // Resolve all URLs in parallel
      const urlResolutions = [];
      
      const chunks = groundingMetadata.groundingChunks.slice(0, MAX_SOURCES_PER_QUERY);
      for (const chunk of chunks) {
        if (chunk.web) {
          const originalUrl = chunk.web.uri;
          
          // Resolve redirect URL if it's a Google Grounding redirect
          if (isGoogleGroundingRedirect(originalUrl)) {
            urlResolutions.push(
              resolveGoogleGroundingUrl(originalUrl, { factId })
                .then(resolvedUrl => ({
                  originalUrl,
                  resolvedUrl: resolvedUrl || originalUrl,
                  chunk
                }))
                .catch(error => {
                  console.warn(`[Google] Failed to resolve redirect URL${factSuffix}: ${error.message}`);
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
      for (const [index, resolvedItem] of resolved.entries()) {
        const { resolvedUrl, chunk } = resolvedItem;
        try {
          const domain = new URL(resolvedUrl).hostname;
          // Determine if supporting or refuting based on context
          // For now, add to supporting (proper classification would need more context)
          sources.supporting.push({
            url: resolvedUrl,
            title: chunk.web.title || `Result from ${domain}`,
            snippet: chunk.web.snippet || '',
            domain: domain,
            tier: assignSourceTier(domain, category),
            isSupporting: true,
            validatedAt: Date.now(),
            rankIndex: index
          });
        } catch (urlError) {
          console.warn(`[Google] Invalid resolved URL${factSuffix}: ${resolvedUrl}`, urlError);
          // Skip invalid URLs
        }
      }

      sources.supporting = sortSourcesByTierPreference(sources.supporting)
        .slice(0, MAX_SOURCES_PER_DIRECTION);
      
      console.log(`[Google] Extracted ${sources.supporting.length} sources from grounding metadata${factSuffix}`);
    } catch (error) {
      console.error(`[Google] Error extracting grounding sources${factSuffix}:`, error);
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

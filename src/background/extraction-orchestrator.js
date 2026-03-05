/**
 * TruthSeek Extraction Orchestrator
 * Coordinates parallel fact extraction across all configured AI agents
 */

import { VALID_CATEGORIES } from '../config/categories.js';
import { sendToTab } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { OpenAIProvider } from '../ai/providers/openai.js';
import { AnthropicProvider } from '../ai/providers/anthropic.js';
import { GoogleProvider } from '../ai/providers/google.js';

const EXTRACTION_TIMEOUT = 60000; // 60 seconds

/**
 * Extract facts from all configured agents in parallel
 * @param {ExtractedContent} content - Page content with sentences
 * @param {AIProvider[]} agents - Array of configured AI provider instances
 * @param {number} tabId - Tab ID for progress updates
 * @returns {Promise<RawExtractionResults[]>}
 */
export async function extractFromAllAgents(content, agents, tabId) {
  if (!agents || agents.length === 0) {
    throw new Error('No agents configured');
  }

  console.log(`Starting extraction with ${agents.length} agent(s)`);

  const results = [];
  const categories = VALID_CATEGORIES;

  // Create extraction promises with timeout for each agent
  const promises = agents.map(agent => 
    extractWithTimeout(agent, content, categories)
  );

  // Execute all extractions in parallel
  const settled = await Promise.allSettled(promises);

  // Process results
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const agent = agents[i];
    const providerInfo = agent.getProviderInfo();

    if (result.status === 'fulfilled') {
      // Successful extraction
      const extractionResult = result.value;
      
      // Validate extraction result
      if (!extractionResult || typeof extractionResult !== 'object') {
        console.error(`Agent ${providerInfo.modelDisplayName}: invalid extraction result:`, extractionResult);
        results.push({
          agentId: agent.config.id,
          facts: [],
          success: false,
          error: 'Invalid extraction result format',
          tokensUsed: 0,
          timestamp: Date.now()
        });
        continue;
      }
      
      const facts = Array.isArray(extractionResult.facts) ? extractionResult.facts : [];
      
      results.push({
        agentId: agent.config.id,
        facts: facts,
        success: true,
        error: null,
        tokensUsed: extractionResult.tokensUsed || 0,
        timestamp: extractionResult.timestamp || Date.now()
      });

      console.log(`Agent ${providerInfo.modelDisplayName}: extracted ${facts.length} facts`);
      console.log(`[EXTRACTION] Parsed facts from ${providerInfo.modelDisplayName}:`, JSON.stringify(facts, null, 2));

      // Send progress update to content script (silent mode - tab may be closed)
      try {
        const completedAgents = i + 1;
        const totalAgents = agents.length;
        const extractionProgress = totalAgents > 0
          ? Math.round((completedAgents / totalAgents) * 50)
          : 0;

        await sendToTab(tabId, {
          type: MessageType.EXTRACTION_PROGRESS,
          payload: {
            agentId: agent.config.id,
            agentName: providerInfo.modelDisplayName,
            factsCount: facts.length,
            status: 'complete',
            completedAgents,
            totalAgents,
            progress: extractionProgress
          },
          timestamp: Date.now()
        }, { silent: true });
      } catch (error) {
        // Only log unexpected errors (sendToTab returns null for expected errors)
        if (error) {
          console.warn('Failed to send progress update:', error);
        }
      }

    } else {
      // Failed extraction (timeout or error)
      const error = result.reason?.message || 'Extraction failed';
      
      results.push({
        agentId: agent.config.id,
        facts: [],
        success: false,
        error: error,
        tokensUsed: 0,
        timestamp: Date.now()
      });

      console.error(`Agent ${providerInfo.modelDisplayName}: extraction failed -`, error);

      // Send failure update to content script (silent mode - tab may be closed)
      try {
        const completedAgents = i + 1;
        const totalAgents = agents.length;
        const extractionProgress = totalAgents > 0
          ? Math.round((completedAgents / totalAgents) * 50)
          : 0;

        await sendToTab(tabId, {
          type: MessageType.EXTRACTION_PROGRESS,
          payload: {
            agentId: agent.config.id,
            agentName: providerInfo.modelDisplayName,
            factsCount: 0,
            status: 'failed',
            error: error,
            completedAgents,
            totalAgents,
            progress: extractionProgress
          },
          timestamp: Date.now()
        }, { silent: true });
      } catch (e) {
        // Only log unexpected errors (sendToTab returns null for expected errors)
        if (e) {
          console.warn('Failed to send error update:', e);
        }
      }
    }
  }

  // Log summary
  const successCount = results.filter(r => r.success).length;
  const totalFacts = results.reduce((sum, r) => sum + r.facts.length, 0);
  console.log(`Extraction complete: ${successCount}/${agents.length} agents succeeded, ${totalFacts} total facts`);

  return results;
}

/**
 * Extract facts with timeout wrapper and chunking
 * @param {AIProvider} agent - AI provider instance
 * @param {ExtractedContent} content - Page content
 * @param {string[]} categories - Valid categories
 * @returns {Promise<ExtractionResult>}
 * @private
 */
async function extractWithTimeout(agent, content, categories) {
  const MAX_SENTENCES_PER_BATCH = 60; // Higher cap to reduce API calls
  const MAX_CHARS_PER_BATCH = 12000; // Approx input budget per request
  
  console.log(`[Extraction] Agent ${agent.config.id}: Processing ${content.sentences.length} sentences`);
  
  // If content is small enough, process in one request
  if (content.sentences.length <= MAX_SENTENCES_PER_BATCH) {
    console.log(`[Extraction] Single batch of ${content.sentences.length} sentences`);
    return Promise.race([
      agent.extractFacts(content, categories),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Extraction timeout after ${EXTRACTION_TIMEOUT / 1000}s`));
        }, EXTRACTION_TIMEOUT);
      })
    ]);
  }
  
  // For large content, process in batches
  const batches = buildSentenceBatches(content.sentences, MAX_SENTENCES_PER_BATCH, MAX_CHARS_PER_BATCH);
  console.log(`[Extraction] Processing ${content.sentences.length} sentences in ${batches.length} batches (max ${MAX_SENTENCES_PER_BATCH} sentences, ${MAX_CHARS_PER_BATCH} chars)`);
  
  const allFacts = [];
  
  console.log(`Processing ${batches.length} batches`);
  
  // Process batches sequentially to avoid rate limits
  for (let i = 0; i < batches.length; i++) {
    try {
      const batchResult = await Promise.race([
        agent.extractFacts(batches[i], categories),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Batch ${i + 1} timeout after ${EXTRACTION_TIMEOUT / 1000}s`));
          }, EXTRACTION_TIMEOUT);
        })
      ]);
      
      if (batchResult.facts && Array.isArray(batchResult.facts)) {
        allFacts.push(...batchResult.facts);
      }
      
      console.log(`Batch ${i + 1}/${batches.length}: extracted ${batchResult.facts?.length || 0} facts`);
      
      // Small delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Batch ${i + 1} failed:`, error.message);
      // Continue with next batch even if one fails
    }
  }
  
  return {
    facts: allFacts,
    agentId: agent.config.id,
    tokensUsed: 0, // Approximate, would need to sum from batches
    timestamp: Date.now()
  };
}

function buildSentenceBatches(sentences, maxSentences, maxChars) {
  const batches = [];
  let current = [];
  let currentChars = 0;
  
  for (const sentence of sentences) {
    const textLength = sentence?.text?.length || 0;
    const nextChars = currentChars + textLength;
    
    if (
      current.length > 0 &&
      (current.length >= maxSentences || nextChars > maxChars)
    ) {
      batches.push({
        sentences: current,
        truncated: false,
        totalCharacters: currentChars
      });
      current = [];
      currentChars = 0;
    }
    
    current.push(sentence);
    currentChars += textLength;
  }
  
  if (current.length > 0) {
    batches.push({
      sentences: current,
      truncated: false,
      totalCharacters: currentChars
    });
  }
  
  return batches;
}

/**
 * Load agent instances from storage
 * @returns {Promise<AIProvider[]>}
 */
export async function loadAgentInstances() {
  try {
    // Get agent configs from storage
    const result = await chrome.storage.local.get(['agents']);
    const agentConfigs = result.agents || [];

    if (agentConfigs.length === 0) {
      console.warn('No agents configured');
      return [];
    }

    // Filter for enabled agents only (default to enabled if not set)
    const enabledConfigs = agentConfigs.filter(config => config.enabled !== false);
    
    if (enabledConfigs.length === 0) {
      console.warn('No enabled agents found');
      return [];
    }

    console.log(`Loading ${enabledConfigs.length} enabled agent(s) out of ${agentConfigs.length} total`);

    // Create provider instances
    const agents = [];
    
    for (const config of enabledConfigs) {
      try {
        let agent;
        
        switch (config.providerId) {
          case 'openai':
            agent = new OpenAIProvider(config);
            break;
          case 'anthropic':
            agent = new AnthropicProvider(config);
            break;
          case 'google':
            agent = new GoogleProvider(config);
            break;
          default:
            console.warn(`Unknown provider: ${config.providerId}`);
            continue;
        }

        // Verify authentication
        if (await agent.isAuthenticated()) {
          agents.push(agent);
          console.log(`Loaded agent: ${agent.getProviderInfo().modelDisplayName}`);
        } else {
          console.warn(`Agent not authenticated: ${config.providerId}`);
        }
      } catch (error) {
        console.error(`Failed to load agent ${config.providerId}:`, error);
      }
    }

    return agents;

  } catch (error) {
    console.error('Error loading agent instances:', error);
    throw error;
  }
}


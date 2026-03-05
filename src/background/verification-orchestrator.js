/**
 * TruthSeek Verification Orchestrator
 * Coordinates parallel fact verification across all configured AI agents
 */

import { sendToTab } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { assignTiersToSources } from './source-tiering.js';
import { filterValidSources } from './url-validator.js';
import { validateGrounding } from './grounding-validator.js';
import { checkRecencyIssues } from './recency-handler.js';

const VERIFICATION_TIMEOUT = 90000; // 90 seconds per fact

/**
 * Verify all facts using all configured agents in parallel
 * @param {Fact[]} facts - Facts to verify
 * @param {AIProvider[]} agents - Array of configured AI provider instances
 * @param {number} tabId - Tab ID for progress updates
 * @returns {Promise<RawVerificationResults[]>}
 */
export async function verifyAllFacts(facts, agents, tabId) {
  if (!facts || facts.length === 0) {
    console.log('No facts to verify');
    return [];
  }
  
  if (!agents || agents.length === 0) {
    throw new Error('No agents configured for verification');
  }
  
  console.log(`Starting verification of ${facts.length} facts with ${agents.length} agent(s)`);
  
  const allResults = [];
  
  // Verify facts in batches to avoid overwhelming APIs
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < facts.length; i += BATCH_SIZE) {
    const batch = facts.slice(i, Math.min(i + BATCH_SIZE, facts.length));
    console.log(`Verifying batch ${Math.floor(i / BATCH_SIZE) + 1}: facts ${i + 1}-${i + batch.length}`);
    
    // For each fact in batch, verify with all agents in parallel
    const batchPromises = batch.map(fact => 
      verifyFactWithAllAgents(fact, agents, tabId)
    );
    
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    
    // Send progress update
    try {
      const processedFacts = i + batch.length;
      const totalFacts = facts.length;
      const verificationProgress = totalFacts > 0
        ? Math.round(50 + ((processedFacts / totalFacts) * 50))
        : 50;

      await sendToTab(tabId, {
        type: MessageType.VERIFICATION_PROGRESS,
        payload: {
          processedFacts,
          totalFacts,
          currentFactIndex: processedFacts,
          progress: verificationProgress
        }
      });
    } catch (error) {
      console.warn('Failed to send verification progress update:', error);
    }
  }
  
  console.log(`Verification complete: ${allResults.length} fact results`);
  
  return allResults;
}

/**
 * Verify a single fact with all agents in parallel
 * @param {Fact} fact - Fact to verify
 * @param {AIProvider[]} agents - Array of agents
 * @param {number} tabId - Tab ID for progress updates
 * @returns {Promise<FactVerificationResults>}
 * @private
 */
async function verifyFactWithAllAgents(fact, agents, tabId) {
  console.log(`Verifying fact ${fact.id}: "${fact.originalText.substring(0, 50)}..."`);
  
  // Create verification promises with timeout for each agent
  const promises = agents.map(agent => 
    verifyWithTimeout(agent, fact)
  );
  
  // Execute all verifications in parallel
  const settled = await Promise.allSettled(promises);
  
  // Process results
  const agentResults = [];
  
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const agent = agents[i];
    const providerInfo = agent.getProviderInfo();
    
    if (result.status === 'fulfilled') {
      // Successful verification
      const verificationResult = result.value;
      
      // Validate and tier sources
      let processedSources = verificationResult.sources || [];
      
      try {
        const sourcesAlreadyValidated = processedSources.length > 0
          && processedSources.every(source => source.validated === true);
        
        // Validate URLs (filter out broken/irrelevant links)
        if (!sourcesAlreadyValidated) {
          processedSources = await filterValidSources(processedSources, fact.originalText, fact.id);
        }
        
        // Assign credibility tiers
        processedSources = assignTiersToSources(processedSources, fact.category);
      } catch (error) {
        console.warn('Error processing sources:', error);
        // Continue with unprocessed sources
      }
      
      // Validate grounding (ensure AI used only provided sources)
      let groundingIssues = [];
      try {
        const providedUrls = processedSources.map(s => s.url);
        const groundingValidation = validateGrounding(verificationResult, providedUrls);
        
        if (!groundingValidation.valid) {
          groundingIssues = groundingValidation.issues;
          console.warn(`Grounding issues for ${providerInfo.modelDisplayName}:`, groundingIssues);
        }
      } catch (error) {
        console.warn('Error validating grounding:', error);
      }
      
      // Check for recency issues (knowledge cutoff)
      let recencyMessage = verificationResult.knowledgeCutoffMessage;
      try {
        const recencyCheck = checkRecencyIssues(fact, providerInfo, processedSources);
        if (recencyCheck.hasIssue) {
          recencyMessage = recencyCheck.message;
        }
      } catch (error) {
        console.warn('Error checking recency:', error);
      }

      const hasValidatedSources = processedSources.length > 0;
      let adjustedVerdict = verificationResult.verdict;
      let adjustedConfidence = verificationResult.confidence;
      let adjustedConfidenceCategory = verificationResult.confidenceCategory
        || categorizeConfidence(verificationResult.confidence);
      let adjustedReasoning = verificationResult.reasoning;
      
      if (!hasValidatedSources) {
        adjustedVerdict = 'UNVERIFIED';
        adjustedConfidence = 0;
        adjustedConfidenceCategory = 'very-low';
        adjustedReasoning = adjustedReasoning
          ? `${adjustedReasoning} (No validated evidence URLs remained after source validation.)`
          : 'No validated evidence URLs remained after source validation.';
        groundingIssues.push('No validated evidence URLs remained after source validation');
      }
      
      agentResults.push({
        agentId: agent.config.id,
        providerId: providerInfo.id,
        providerName: providerInfo.displayName,
        modelDisplayName: providerInfo.modelDisplayName,
        verdict: adjustedVerdict,
        confidence: adjustedConfidence,
        confidenceCategory: adjustedConfidenceCategory,
        reasoning: adjustedReasoning,
        sources: processedSources,
        knowledgeCutoffMessage: recencyMessage,
        groundingIssues: groundingIssues,
        hasModelKnowledge: verificationResult.hasModelKnowledge !== false,
        tokensUsed: verificationResult.tokensUsed || 0,
        timestamp: verificationResult.timestamp || Date.now(),
        success: true,
        error: null
      });
      
      console.log(`Agent ${providerInfo.modelDisplayName}: ${adjustedVerdict} (confidence: ${adjustedConfidence}, ${processedSources.length} sources)`);
      
    } else {
      // Failed verification (timeout or error)
      const error = result.reason?.message || 'Verification failed';
      
      agentResults.push({
        agentId: agent.config.id,
        providerId: providerInfo.id,
        providerName: providerInfo.displayName,
        modelDisplayName: providerInfo.modelDisplayName,
        verdict: 'UNVERIFIED',
        confidence: 0,
        confidenceCategory: 'very-low',
        reasoning: `Verification failed: ${error}`,
        sources: [],
        knowledgeCutoffMessage: null,
        tokensUsed: 0,
        timestamp: Date.now(),
        success: false,
        error: error
      });
      
      console.error(`Agent ${providerInfo.modelDisplayName}: verification failed -`, error);
    }
  }
  
  return {
    factId: fact.id,
    agentResults: agentResults
  };
}

/**
 * Verify fact with timeout wrapper
 * @param {AIProvider} agent - AI provider instance
 * @param {Fact} fact - Fact to verify
 * @returns {Promise<VerificationResult>}
 * @private
 */
async function verifyWithTimeout(agent, fact) {
  return Promise.race([
    // Actual verification
    agent.verifyFactWithWebSearch(fact, fact.category),
    
    // Timeout promise
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Verification timeout after ${VERIFICATION_TIMEOUT / 1000}s`));
      }, VERIFICATION_TIMEOUT);
    })
  ]);
}

/**
 * Categorize confidence score
 * @param {number} confidence - Confidence score 0-100
 * @returns {string} Category: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
 * @private
 */
function categorizeConfidence(confidence) {
  if (confidence >= 90) return 'very-high';
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 25) return 'low';
  return 'very-low';
}

/**
 * Extract years from text for knowledge cutoff checking
 * @param {string} text - Text to extract years from
 * @returns {number[]} Array of years
 */
export function extractYears(text) {
  const matches = text.match(/\b(20[0-2][0-9])\b/g) || [];
  return matches.map(m => parseInt(m, 10));
}

/**
 * Check if fact may be affected by knowledge cutoff
 * @param {Fact} fact - Fact being verified
 * @param {ProviderInfo} providerInfo - AI provider info
 * @param {boolean} hasEvidence - Whether evidence was found
 * @returns {string|null} Warning message or null
 */
export function checkKnowledgeCutoff(fact, providerInfo, hasEvidence) {
  // Check if fact references recent events
  const factYears = extractYears(fact.originalText);
  const cutoffDate = providerInfo.knowledgeCutoffDate;
  const cutoffYear = cutoffDate.getFullYear();
  
  // Check if any referenced year is after cutoff
  const hasRecentReference = factYears.some(y => y > cutoffYear);
  const hasCurrentIndicator = /\b(current|now|today|presently|recent)\b/i.test(fact.originalText);
  
  if ((hasRecentReference || hasCurrentIndicator) && !hasEvidence) {
    return `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${providerInfo.knowledgeCutoff}). We could not find sufficient current sources to verify it.`;
  }
  
  return null;
}

/**
 * Get verification statistics
 * @param {FactVerificationResults[]} results - Verification results
 * @returns {Object} Statistics
 */
export function getVerificationStats(results) {
  const stats = {
    totalFacts: results.length,
    totalAgentVerifications: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    verdictCounts: {
      TRUE: 0,
      FALSE: 0,
      UNVERIFIED: 0
    },
    averageConfidence: 0
  };
  
  let totalConfidence = 0;
  let confidenceCount = 0;
  
  for (const factResult of results) {
    stats.totalAgentVerifications += factResult.agentResults.length;
    
    for (const agentResult of factResult.agentResults) {
      if (agentResult.success) {
        stats.successfulVerifications++;
        stats.verdictCounts[agentResult.verdict]++;
        totalConfidence += agentResult.confidence;
        confidenceCount++;
      } else {
        stats.failedVerifications++;
      }
    }
  }
  
  stats.averageConfidence = confidenceCount > 0 
    ? Math.round(totalConfidence / confidenceCount)
    : 0;
  
  return stats;
}


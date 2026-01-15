/**
 * TruthSeek Main Orchestrator
 * Coordinates the complete fact-checking workflow
 */

import { sendToTab, broadcast } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { extractFromAllAgents, loadAgentInstances } from './extraction-orchestrator.js';
import { deduplicate } from './deduplication.js';
import { validateFacts } from './fact-validator.js';
import { validateAndCorrectCategories } from './categorization.js';
import { verifyAllFacts } from './verification-orchestrator.js';
import { aggregateVerificationResults } from './consensus.js';

// Extension state
let state = {
  status: 'IDLE', // IDLE | RUNNING | COMPLETE | CANCELLED
  currentStep: null,
  totalFacts: null,
  processedFacts: null,
  results: null,
  startedAt: null,
  completedAt: null,
  currentTabId: null
};

// Cancellation flag
let cancellationRequested = false;

/**
 * Start fact-checking workflow
 * @param {number} tabId - Tab ID to fact-check
 * @returns {Promise<void>}
 */
export async function start(tabId) {
  try {
    console.log('[TruthSeek] Starting fact-check workflow for tab:', tabId);
    
    // Reset cancellation flag
    cancellationRequested = false;
    
    // Load agents
    const agents = await loadAgentInstances();
    
    if (agents.length === 0) {
      throw new Error('No AI agents configured. Please add at least one agent.');
    }
    
    console.log(`✓ Loaded ${agents.length} agent(s)`);
    
    // Update state
    state = {
      status: 'RUNNING',
      currentStep: 'Starting...',
      totalFacts: null,
      processedFacts: 0,
      results: null,
      startedAt: Date.now(),
      completedAt: null,
      currentTabId: tabId
    };
    await persistState();
    broadcastState();
    
    // Show progress popup (silent mode - tab may be closed)
    await sendToTab(tabId, {
      type: MessageType.SHOW_PROGRESS,
      payload: {
        currentStep: 'Starting fact-check...',
        progress: 0
      }
    }, { silent: true });
    
    // STEP 1: Extract page content
    updateProgress(tabId, 'Extracting page content...', 5);
    
    const contentResponse = await sendToTab(tabId, {
      type: MessageType.GET_PAGE_CONTENT,
      payload: {}
    });
    
    // Validate response
    if (!contentResponse) {
      throw new Error('No response from content script');
    }
    
    // Handle different response formats
    let content;
    if (contentResponse.success && contentResponse.data) {
      content = contentResponse.data;
    } else if (contentResponse.data) {
      content = contentResponse.data;
    } else if (contentResponse.sentences) {
      content = contentResponse;
    } else {
      console.error('Unexpected response format:', contentResponse);
      throw new Error('Invalid content format received from page');
    }
    
    if (!content.sentences || !Array.isArray(content.sentences)) {
      console.error('Content missing sentences array:', content);
      throw new Error('Invalid content format: missing sentences array');
    }
    
    console.log(`✓ Extracted ${content.sentences.length} sentences from page`);
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 2: Extract facts from all agents
    updateProgress(tabId, `Extracting facts with ${agents.length} agent(s)...`, 15);
    
    const rawResults = await extractFromAllAgents(content, agents, tabId);
    
    if (!rawResults || !Array.isArray(rawResults)) {
      throw new Error('Invalid extraction results from agents');
    }
    
    const totalRawFacts = rawResults.reduce((sum, r) => sum + (r.facts?.length || 0), 0);
    
    console.log(`✓ Extracted ${totalRawFacts} facts from ${agents.length} agents`);
    console.log(`[EXTRACTION] Raw extraction results from all agents:`, JSON.stringify(rawResults, null, 2));
    
    // Log detailed extraction info with sentence context
    console.log('[EXTRACTION] Initial facts with sentence context:');
    rawResults.forEach((agentResult, agentIndex) => {
      console.log(`  Agent ${agentIndex + 1} (${agentResult.agentId}):`, {
        totalFacts: agentResult.facts?.length || 0,
        facts: agentResult.facts?.map(fact => {
          const sentence = content.sentences.find(s => s.id === fact.sentenceId);
          return {
            factId: fact.id,
            factText: fact.originalText,
            sentenceId: fact.sentenceId,
            sentenceText: sentence?.text || 'SENTENCE NOT FOUND',
            sentenceXPath: sentence?.xpath || 'N/A',
            category: fact.category,
            confidence: fact.confidence
          };
        }) || []
      });
    });
    
    if (totalRawFacts === 0) {
      throw new Error('No facts were extracted from the page. The content may not contain verifiable factual claims.');
    }
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 3: Deduplicate facts
    updateProgress(tabId, 'Deduplicating facts...', 30);
    
    const deduplicatedFacts = await deduplicate(rawResults);
    
    if (!deduplicatedFacts || !Array.isArray(deduplicatedFacts)) {
      console.error('Deduplication returned invalid result:', deduplicatedFacts);
      throw new Error('Deduplication failed: invalid result format');
    }
    
    console.log(`✓ Deduplicated to ${deduplicatedFacts.length} unique facts`);
    console.log(`[DEDUPLICATION] Deduplicated facts:`, JSON.stringify(deduplicatedFacts, null, 2));
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 4: Validate and correct categories
    updateProgress(tabId, 'Validating categories...', 33);
    
    const categorizedFacts = validateAndCorrectCategories(deduplicatedFacts);
    
    if (!categorizedFacts || !Array.isArray(categorizedFacts)) {
      console.error('Category validation returned invalid result:', categorizedFacts);
      throw new Error('Category validation failed: invalid result format');
    }
    
    console.log(`✓ Validated categories for ${categorizedFacts.length} facts`);
    console.log(`[CATEGORIZATION] Categorized facts:`, JSON.stringify(categorizedFacts, null, 2));
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 5: Validate facts
    updateProgress(tabId, 'Validating facts...', 35);
    
    const validationResult = validateFacts(categorizedFacts);
    
    if (!validationResult || !validationResult.validFacts || !Array.isArray(validationResult.validFacts)) {
      console.error('Fact validation returned invalid result:', validationResult);
      throw new Error('Fact validation failed: invalid result format');
    }
    
    const validFacts = validationResult.validFacts;
    const invalidFacts = validationResult.invalidFacts || [];
    
    console.log(`✓ Validated ${validFacts.length} facts (${invalidFacts.length} filtered)`);
    console.log(`[VALIDATION] Valid facts ready for verification:`, JSON.stringify(validFacts, null, 2));
    
    if (invalidFacts.length > 0) {
      console.warn('[VALIDATION] Filtered facts:', JSON.stringify(invalidFacts, null, 2));
    }
    
    state.totalFacts = validFacts.length;
    await persistState();
    
    if (validFacts.length === 0) {
      // No facts to verify
      await completeWithNoFacts(tabId);
      return;
    }
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 6: Highlight sentences
    updateProgress(tabId, 'Highlighting sentences...', 40);
    
    // Group facts by sentence
    const factsBySentence = new Map();
    for (const fact of validFacts) {
      if (!factsBySentence.has(fact.sentenceId)) {
        factsBySentence.set(fact.sentenceId, []);
      }
      factsBySentence.get(fact.sentenceId).push(fact);
    }
    
    // Highlight each sentence
    for (const [sentenceId, facts] of factsBySentence) {
      const sentence = content.sentences.find(s => s.id === sentenceId);
      if (sentence) {
        await sendToTab(tabId, {
          type: MessageType.HIGHLIGHT_SENTENCE,
          payload: {
            sentenceId: sentenceId,
            xpath: sentence.xpath,
            text: sentence.text, // Include text for fallback search
            status: 'processing'
          }
        }, { silent: true });
      }
    }
    
    console.log(`✓ Highlighted ${factsBySentence.size} sentences`);
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 7: Verify all facts with all agents
    updateProgress(
      tabId, 
      `Verifying ${validFacts.length} facts...`, 
      40,
      validFacts.length,
      0
    );
    
    const results = [];
    const verificationResults = {};
    
    try {
      // Verify all facts in parallel (verification-orchestrator handles batching)
      const rawResults = await verifyAllFacts(validFacts, agents, tabId);
      
      if (cancellationRequested) {
        handleCancellation(tabId);
        return;
      }
      
      // Validate rawResults
      if (!rawResults || !Array.isArray(rawResults)) {
        console.error('Invalid rawResults from verifyAllFacts:', rawResults);
        throw new Error('Verification failed: invalid results format');
      }
      
      // Process and aggregate results
      for (const factResult of rawResults) {
        if (!factResult || !factResult.factId) {
          console.warn('Skipping invalid factResult:', factResult);
          continue;
        }
        
        const fact = validFacts.find(f => f.id === factResult.factId);
        if (!fact) {
          console.warn('Could not find fact for result:', factResult.factId);
          continue;
        }
        
        // Validate agentResults exists
        if (!factResult.agentResults || !Array.isArray(factResult.agentResults)) {
          console.warn('Missing or invalid agentResults for fact:', factResult.factId);
          continue;
        }
        
        // Skip facts with no agent results (all agents failed)
        if (factResult.agentResults.length === 0) {
          console.warn('No agent results for fact (all agents failed):', factResult.factId);
          continue;
        }
        
        // Aggregate agent results for this fact
        const aggregated = aggregateVerificationResults(factResult.agentResults);
        aggregated.factId = fact.id; // Ensure factId is set
        aggregated.sentenceId = fact.sentenceId;
        aggregated.originalText = fact.originalText;
        aggregated.factText = fact.searchableText;
        
        results.push(aggregated);
        verificationResults[fact.id] = aggregated;
        
        // Update highlight color - wrap in try/catch as tab may be closed
        try {
          await sendToTab(tabId, {
            type: MessageType.UPDATE_HIGHLIGHT_COLOR,
            payload: {
              sentenceId: fact.sentenceId,
              status: aggregated.aggregateVerdict.toLowerCase()
            }
          }, { silent: true });
        } catch (tabError) {
          console.warn('Could not update highlight (tab may be closed):', tabError.message);
          // Continue processing even if tab update fails
        }
      }
      
      state.processedFacts = validFacts.length;
      await persistState();
      
    } catch (error) {
      console.error('Error during verification:', error);
      // Continue to completion even if verification fails
    }
    
    if (cancellationRequested) {
      handleCancellation(tabId);
      return;
    }
    
    // STEP 8: Complete and show results
    console.log(`✓ Verification complete: ${results.length} facts verified`);
    console.log(`[FINAL RESULTS] Complete verification results with all metadata:`, JSON.stringify(results, null, 2));
    
    // Log detailed final results with sentence context
    console.log('[FINAL RESULTS] Verified facts with full context:');
    results.forEach((result, index) => {
      const sentence = content.sentences.find(s => s.id === result.sentenceId);
      console.log(`  Fact ${index + 1}:`, {
        factId: result.factId,
        factText: result.factText || result.originalText,
        verdict: result.aggregateVerdict,
        confidence: result.confidence,
        sentenceId: result.sentenceId,
        sentenceText: sentence?.text || 'SENTENCE NOT FOUND',
        sentenceXPath: sentence?.xpath || 'N/A',
        agentCount: result.agentResults?.length || 0,
        sources: result.sources?.length || 0,
        sourceUrls: result.sources?.map(s => s.url) || []
      });
    });
    
    console.log(`[FINAL RESULTS] Verification results map (factId -> result):`, JSON.stringify(verificationResults, null, 2));
    
    state.status = 'COMPLETE';
    state.results = results;
    state.completedAt = Date.now();
    await persistState();
    
    // Store verification results for modal access
    await chrome.storage.local.set({ verificationResults });
    
    // Calculate summary
    const summary = calculateSummary(results);
    
    // Show results (silent mode - tab may be closed)
    await sendToTab(tabId, {
      type: MessageType.SHOW_RESULTS,
      payload: { summary }
    }, { silent: true });
    
    broadcastState();
    
    const duration = ((Date.now() - state.startedAt) / 1000).toFixed(1);
    console.log(`[TruthSeek] Fact-check complete in ${duration}s`);
    
  } catch (error) {
    console.error('[TruthSeek] Fact-check failed:', error);
    
    state.status = 'IDLE';
    state.currentStep = `Error: ${error.message}`;
    state.completedAt = Date.now();
    await persistState();
    broadcastState();
    
    // Show error to user (silent mode - tab may be closed)
    if (tabId) {
      await sendToTab(tabId, {
        type: MessageType.UPDATE_PROGRESS,
        payload: {
          currentStep: `Error: ${error.message}`,
          progress: 0
        }
      }, { silent: true });
    }
    
    throw error;
  }
}

/**
 * Cancel ongoing fact-check
 * @returns {void}
 */
export function cancel() {
  console.log('[TruthSeek] Cancellation requested');
  cancellationRequested = true;
}

/**
 * Handle cancellation
 * @param {number} tabId - Tab ID
 * @private
 */
async function handleCancellation(tabId) {
  console.log('🛑 Fact-check cancelled');
  
  state.status = 'CANCELLED';
  state.currentStep = 'Cancelled by user';
  state.completedAt = Date.now();
  await persistState();
  broadcastState();
  
  // Hide progress popup (silent mode - tab may be closed)
  if (tabId) {
    await sendToTab(tabId, {
      type: MessageType.UPDATE_PROGRESS,
      payload: {
        currentStep: 'Cancelled',
        progress: 0
      }
    }, { silent: true });
  }
}

/**
 * Complete with no facts found
 * @param {number} tabId - Tab ID
 * @private
 */
async function completeWithNoFacts(tabId) {
  console.log('[TruthSeek] No verifiable facts found');
  
  state.status = 'COMPLETE';
  state.results = [];
  state.completedAt = Date.now();
  await persistState();
  
  const summary = {
    totalFacts: 0,
    trueCount: 0,
    falseCount: 0,
    unverifiedCount: 0,
    overallConfidence: 0,
    overallConfidenceCategory: 'low'
  };
  
  await sendToTab(tabId, {
    type: MessageType.SHOW_RESULTS,
    payload: { summary }
  }, { silent: true });
  
  broadcastState();
}

/**
 * Get current state
 * @returns {Object} Current state
 */
export function getState() {
  return { ...state };
}

/**
 * Update progress
 * @param {number} tabId - Tab ID
 * @param {string} step - Current step description
 * @param {number} percent - Progress percentage (0-100)
 * @param {number} [totalFacts] - Total facts count
 * @param {number} [currentFact] - Current fact number
 * @private
 */
function updateProgress(tabId, step, percent, totalFacts = null, currentFact = null) {
  state.currentStep = step;
  
  // Use silent mode for progress updates - tab may be closed/navigated
  sendToTab(tabId, {
    type: MessageType.UPDATE_PROGRESS,
    payload: {
      currentStep: step,
      progress: percent,
      totalFacts: totalFacts,
      processedFacts: currentFact
    }
  }, { silent: true }).catch(error => {
    // Only log unexpected errors (sendToTab returns null for expected errors)
    if (error) {
      console.error('Error sending progress update:', error);
    }
  });
}

/**
 * Persist state to storage
 * @private
 */
async function persistState() {
  await chrome.storage.local.set({ 
    extensionState: state 
  });
}

/**
 * Broadcast state to all listeners
 * @private
 */
function broadcastState() {
  broadcast({
    type: MessageType.STATE_UPDATE,
    payload: state
  });
}

/**
 * Calculate results summary
 * @param {Array} results - Aggregated results
 * @returns {Object} Summary
 * @private
 */
function calculateSummary(results) {
  if (!results || results.length === 0) {
    return {
      totalFacts: 0,
      trueCount: 0,
      falseCount: 0,
      unverifiedCount: 0,
      overallConfidence: 0,
      overallConfidenceCategory: 'low'
    };
  }
  
  const totalFacts = results.length;
  const trueCount = results.filter(r => r.aggregateVerdict === 'TRUE').length;
  const falseCount = results.filter(r => r.aggregateVerdict === 'FALSE').length;
  const unverifiedCount = results.filter(r => r.aggregateVerdict === 'UNVERIFIED').length;
  
  // Calculate average confidence
  const avgConfidence = results.reduce((sum, r) => sum + (r.aggregateConfidence || 0), 0) / totalFacts;
  const overallConfidence = Math.round(avgConfidence);
  
  // Categorize confidence
  let overallConfidenceCategory = 'low';
  if (overallConfidence >= 85) {
    overallConfidenceCategory = 'high';
  } else if (overallConfidence >= 60) {
    overallConfidenceCategory = 'medium';
  }
  
  return {
    totalFacts,
    trueCount,
    falseCount,
    unverifiedCount,
    overallConfidence,
    overallConfidenceCategory
  };
}


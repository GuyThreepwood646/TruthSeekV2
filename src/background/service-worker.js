/**
 * TruthSeek Background Service Worker
 * Entry point for background script
 */

// Import messaging system
import { initialize as initializeMessaging, registerHandler } from './messaging.js';
import { MessageType } from '../shared/message-types.js';

// Import orchestrator
import { start, cancel, getState, resetForTab, resetState } from './orchestrator.js';

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('TruthSeek installed:', details.reason);
  
  // Initialize default storage
  chrome.storage.local.get(['agents', 'extensionState'], (result) => {
    if (!result.agents) {
      chrome.storage.local.set({ agents: [] });
    }
    if (!result.extensionState) {
      chrome.storage.local.set({ 
        extensionState: {
          status: 'IDLE',
          currentStep: null,
          totalFacts: null,
          processedFacts: null,
          results: null,
          startedAt: null,
          completedAt: null
        }
      });
    }
  });
});

// Initialize messaging system
initializeMessaging();

// Migrate legacy state key if present
async function migrateLegacyState() {
  try {
    const result = await chrome.storage.local.get(['extensionState', 'state']);
    if (!result.extensionState && result.state) {
      await chrome.storage.local.set({ extensionState: result.state });
      console.log('[TruthSeek] Migrated legacy state to extensionState');
    }
  } catch (error) {
    console.warn('[TruthSeek] Failed to migrate legacy state:', error);
  }
}

migrateLegacyState();

// Reset stale running state on startup
async function reconcileState() {
  const state = getState();
  if (state.status !== 'RUNNING') {
    return;
  }
  
  if (!state.currentTabId) {
    await resetState('Session cleared');
    return;
  }
  
  try {
    await chrome.tabs.get(state.currentTabId);
  } catch (error) {
    await resetState('Session cleared');
  }
}

reconcileState();

// Register message handlers
registerHandler(MessageType.GET_STATE, async (payload, sender) => {
  const state = getState();
  return state;
});

registerHandler(MessageType.GET_AGENTS, async (payload, sender) => {
  const result = await chrome.storage.local.get(['agents']);
  return result.agents || [];
});

// Register handler for getting fact details
registerHandler(MessageType.GET_FACT_DETAILS, async (payload, sender) => {
  const { sentenceId } = payload;
  
  if (!sentenceId) {
    console.error('[GET_FACT_DETAILS] Missing sentenceId in payload:', payload);
    return { facts: [] };
  }
  
  console.log(`[GET_FACT_DETAILS] Looking up facts for sentence: "${sentenceId}"`);
  
  // Get verification results from storage
  const result = await chrome.storage.local.get(['verificationResults']);
  const verificationResults = result.verificationResults || {};
  
  const totalFacts = Object.keys(verificationResults).length;
  console.log(`[GET_FACT_DETAILS] Total facts in storage: ${totalFacts}`);
  
  if (totalFacts === 0) {
    console.warn('[GET_FACT_DETAILS] No verification results found in storage');
    return { facts: [] };
  }
  
  // Find facts for this sentence
  const facts = [];
  const allSentenceIds = new Set();
  
  for (const [factId, factResult] of Object.entries(verificationResults)) {
    // Collect all sentenceIds for debugging
    if (factResult.sentenceId) {
      allSentenceIds.add(factResult.sentenceId);
    }
    
    // Match sentenceId (case-sensitive exact match)
    if (factResult.sentenceId === sentenceId) {
      facts.push(factResult);
    }
  }
  
  console.log(`[GET_FACT_DETAILS] Found ${facts.length} facts for sentence "${sentenceId}"`);
  console.log(`[GET_FACT_DETAILS] Available sentenceIds in storage:`, Array.from(allSentenceIds).slice(0, 10));
  
  if (facts.length === 0 && allSentenceIds.size > 0) {
    console.warn(`[GET_FACT_DETAILS] No matching facts found. Looking for: "${sentenceId}"`);
    console.warn(`[GET_FACT_DETAILS] First few stored sentenceIds:`, Array.from(allSentenceIds).slice(0, 5));
  }
  
  if (facts.length > 0) {
    console.log(`[GET_FACT_DETAILS] Sample fact structure:`, {
      factId: facts[0].factId,
      sentenceId: facts[0].sentenceId,
      aggregateVerdict: facts[0].aggregateVerdict,
      hasAgentResults: !!facts[0].agentResults,
      agentResultsCount: facts[0].agentResults?.length || 0
    });
  }
  
  return { facts };
});

// Register START_FACT_CHECK handler - delegates to orchestrator
registerHandler(MessageType.START_FACT_CHECK, async (payload, sender) => {
  console.log('START_FACT_CHECK handler called with payload:', payload);
  const { tabId } = payload;
  
  if (!tabId) {
    throw new Error('No tabId provided in START_FACT_CHECK message');
  }
  
  console.log('Starting orchestrator for tab:', tabId);
  await start(tabId);
  
  console.log('Orchestrator started successfully');
  return { success: true };
});

// Register CANCEL_FACT_CHECK handler - delegates to orchestrator
registerHandler(MessageType.CANCEL_FACT_CHECK, async (payload, sender) => {
  cancel();
  return { success: true };
});

// Reset running state when the active tab reloads or navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    const state = getState();
    if (state.status === 'RUNNING' && state.currentTabId === tabId) {
      resetForTab(tabId, 'Page refreshed');
    }
  }
});

console.log('TruthSeek background service worker initialized');


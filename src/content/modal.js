/**
 * TruthSeek Fact Modal Component
 * Displays fact verification details when user clicks highlighted sentence
 */

import { registerHandler } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { escapeHtml, sanitizeUrl, clampPercent } from './dom-utils.js';

// State
let modalContainer = null;
let currentSentenceId = null;
const factsData = new Map(); // factId -> AggregatedResult

/**
 * Initialize modal component
 */
export function initializeModal() {
  if (modalContainer) return; // Already initialized
  
  // Create modal container
  modalContainer = document.createElement('div');
  modalContainer.id = 'truthseek-modal';
  modalContainer.className = 'ts-modal-overlay hidden';
  modalContainer.innerHTML = `
    <div class="ts-modal-content">
      <button class="ts-modal-close" aria-label="Close modal">&times;</button>
      <div class="ts-modal-header">
        <h3>Fact Check Results</h3>
        <p class="ts-sentence-text"></p>
      </div>
      <div class="ts-modal-body">
        <div class="ts-facts-list"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalContainer);
  
  // Add event listeners
  const closeBtn = modalContainer.querySelector('.ts-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // Close on backdrop click
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeModal();
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalContainer.classList.contains('hidden')) {
      closeModal();
    }
  });
  
  console.log('TruthSeek modal initialized');
}

/**
 * Open modal for a specific sentence
 * @param {string} sentenceId - Sentence identifier
 * @param {string} sentenceText - Original sentence text
 * @param {Array} facts - Facts associated with this sentence
 */
export function openModalForSentence(sentenceId, sentenceText, facts = []) {
  initializeModal();
  
  if (!sentenceId) {
    console.error('[MODAL] Missing sentenceId, cannot open modal');
    return;
  }
  
  if (currentSentenceId && currentSentenceId !== sentenceId) {
    factsData.clear();
  }
  currentSentenceId = sentenceId;
  
  console.log(`[MODAL] Opening modal for sentence: ${sentenceId}`);
  console.log(`[MODAL] Received ${facts.length} facts:`, facts);
  
  // Validate and filter facts
  const validFacts = facts.filter(fact => {
    if (!fact) {
      console.warn('[MODAL] Invalid fact (null/undefined):', fact);
      return false;
    }
    if (!fact.factId) {
      console.warn('[MODAL] Fact missing factId:', fact);
      return false;
    }
    // Ensure sentenceId matches (safety check)
    if (fact.sentenceId && fact.sentenceId !== sentenceId) {
      console.warn(`[MODAL] Fact sentenceId mismatch: expected ${sentenceId}, got ${fact.sentenceId}`);
      // Still include it, but log the warning
    }
    return true;
  });
  
  console.log(`[MODAL] Valid facts after filtering: ${validFacts.length}`);
  
  // Update header with sentence text
  const sentenceTextEl = modalContainer.querySelector('.ts-sentence-text');
  if (sentenceTextEl) {
    sentenceTextEl.textContent = sentenceText || 'Loading...';
  }
  
  // Store facts data
  validFacts.forEach(fact => {
    factsData.set(fact.factId, fact);
  });
  
  // Render facts for this sentence
  renderFactsForSentence(sentenceId, validFacts);
  
  // Show modal
  modalContainer.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Render facts for a sentence
 * @param {string} sentenceId - Sentence identifier
 * @param {Array} facts - Facts to render
 */
function renderFactsForSentence(sentenceId, facts) {
  const factsContainer = modalContainer.querySelector('.ts-facts-list');
  factsContainer.innerHTML = '';
  
  if (!facts || facts.length === 0) {
    factsContainer.innerHTML = '<p class="ts-no-facts">Verifying facts...</p>';
    return;
  }
  
  // Render each fact
  facts.forEach(fact => {
    const factElement = renderFact(fact);
    factsContainer.appendChild(factElement);
  });
}

/**
 * Render a single fact
 * @param {Object} result - Aggregated verification result
 * @returns {HTMLElement}
 */
function renderFact(result) {
  const div = document.createElement('div');
  div.className = 'ts-fact-item';
  div.dataset.factId = result.factId;
  
  const aggregateConfidence = clampPercent(result.aggregateConfidence);
  const confidenceCategory = result.aggregateConfidenceCategory || 'low';
  const hasSources = Array.isArray(result.sources) && result.sources.length > 0;
  const isUnverified = (result.aggregateVerdict || 'UNVERIFIED').toUpperCase() === 'UNVERIFIED';
  const showFallbackNote = isUnverified && !hasSources;
  const hasModelKnowledge = result.hasModelKnowledge !== false;
  
  // Determine verdict class
  const verdictClass = `ts-verdict-${(result.aggregateVerdict || 'unverified').toLowerCase()}`;
  
  // Get first agent result for display
  const primaryResult = result.agentResults && result.agentResults[0] ? result.agentResults[0] : null;
  
  div.innerHTML = `
    <div class="ts-fact-statement">
      <strong>Claim:</strong> ${escapeHtml(result.originalText || result.factText || 'Unknown fact')}
    </div>
    
    <div class="ts-fact-header ${verdictClass}">
      <span class="ts-verdict-badge">${getVerdictEmoji(result.aggregateVerdict)} ${result.aggregateVerdict || 'UNVERIFIED'}</span>
      <div class="ts-confidence-wrapper">
        <div class="ts-confidence-bar">
          <div class="ts-confidence-fill ${getConfidenceClass(confidenceCategory)}" 
               style="width: ${aggregateConfidence}%"></div>
        </div>
        <span class="ts-confidence-text">${aggregateConfidence}% confidence</span>
      </div>
    </div>
    
    <div class="ts-fact-reasoning">
      <p>${escapeHtml(result.reasoning || 'Processing verification...')}</p>
    </div>
    
    ${showFallbackNote ? `
      <div class="ts-unverified-note">
        ${!hasModelKnowledge
          ? 'No evidence or model knowledge available yet. We could not verify this claim.'
          : 'No evidence sources were found. This is a model-only assessment.'
        }
      </div>
    ` : ''}
    
    ${result.hasDisagreement ? `
      <div class="ts-disagreement-warning">
        <strong>Warning:</strong> ${escapeHtml(result.disagreementNote || 'AI agents disagree on this fact')}
        ${result.needsReVerification ? `
          <p class="ts-reverification-suggestion">
            <strong>Suggestion:</strong> This fact may benefit from additional verification with broader search terms.
            ${result.suggestedSearchTerms && result.suggestedSearchTerms.length > 0 ? `
              <span class="ts-suggested-terms">Try searching: ${result.suggestedSearchTerms.slice(0, 3).map(term => `"${escapeHtml(term)}"`).join(', ')}</span>
            ` : ''}
          </p>
        ` : ''}
      </div>
    ` : ''}
    
    ${primaryResult?.knowledgeCutoffMessage ? `
      <div class="ts-cutoff-message">
        <strong>Note:</strong> ${escapeHtml(primaryResult.knowledgeCutoffMessage)}
      </div>
    ` : ''}
    
    <div class="ts-sources">
      <h4>Evidence Sources</h4>
      ${renderSources(result.sources || [])}
    </div>
    
    ${result.agentResults && result.agentResults.length > 1 ? renderAgentDetails(result.agentResults) : ''}
  `;
  
  return div;
}

/**
 * Render sources list
 * @param {Array} sources - Array of source objects
 * @returns {string} HTML string
 */
function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return '<p class="ts-no-sources">No verified sources found</p>';
  }
  
  let html = '<ul class="ts-sources-list">';
  
  sources.forEach(source => {
    if (!source) {
      return;
    }
    const tierBadge = getTierBadge(source.tier);
    const supportClass = source.isSupporting ? 'ts-supporting' : 'ts-refuting';
    const supportIcon = source.isSupporting ? '✓' : '✗';
    const supportText = source.isSupporting ? 'Supporting' : 'Refuting';
    
    html += `
      <li class="ts-source-item ${supportClass}">
        <a href="${sanitizeUrl(source.url)}" target="_blank" rel="noopener noreferrer" class="ts-source-link">
          ${escapeHtml(source.title || source.domain || 'Source')}
        </a>
        ${tierBadge}
        <span class="ts-source-type">${supportIcon} ${supportText}</span>
        ${source.snippet ? `<p class="ts-source-snippet">${escapeHtml(source.snippet)}</p>` : ''}
      </li>
    `;
  });
  
  html += '</ul>';
  return html;
}

/**
 * Render individual agent assessments
 * @param {Array} agentResults - Array of per-agent results
 * @returns {string} HTML string
 */
function renderAgentDetails(agentResults) {
  if (!agentResults || agentResults.length === 0) {
    return '';
  }
  
  // AC6.3.6: Single-agent mode shows only that agent's assessment (no aggregate)
  // This function is only called when agentResults.length > 1, so we always show individual assessments
  
  let html = '<div class="ts-agent-details">';
  html += '<h4>Individual Agent Assessments</h4>';
  html += '<p class="ts-agent-details-hint">Expand to see how each AI model assessed this fact</p>';
  
  agentResults.forEach((result, index) => {
    // AC6.3.3: Agent sections labeled with friendly name (e.g., "Gemini - 2.5 Flash")
    const agentLabel = getAgentFriendlyName(result, index);
    
    // AC6.3.5: Disagreements are visually highlighted
    const verdictClass = `ts-verdict-${(result.verdict || 'unverified').toLowerCase()}`;
    const isDisagreement = hasDisagreementWithOthers(result, agentResults);
    const disagreementClass = isDisagreement ? 'ts-agent-disagreement' : '';
    
    // AC6.3.4: Each agent section shows: verdict, confidence, reasoning, evidence links
    html += `
      <details class="ts-agent-section ${disagreementClass}">
        <summary class="ts-agent-summary ${verdictClass}">
          <span class="ts-agent-icon">${getProviderIcon(result)}</span>
          <span class="ts-agent-label">${escapeHtml(agentLabel)}</span>
          <span class="ts-agent-verdict-badge">
            ${getVerdictEmoji(result.verdict)} ${result.verdict || 'UNVERIFIED'}
          </span>
          <span class="ts-agent-confidence-badge ${getConfidenceClass(result.confidenceCategory || 'low')}">
            ${clampPercent(result.confidence)}%
          </span>
          ${isDisagreement ? '<span class="ts-disagreement-indicator" title="This agent disagrees with others">[!]</span>' : ''}
        </summary>
        <div class="ts-agent-content">
          ${result.error ? `
            <div class="ts-agent-error">
              <strong>Error:</strong> ${escapeHtml(result.error)}
            </div>
          ` : ''}
          
          <div class="ts-agent-reasoning">
            <strong>Reasoning:</strong>
            <p>${escapeHtml(result.reasoning || 'No reasoning provided')}</p>
          </div>
          
          <div class="ts-agent-confidence-detail">
            <strong>Confidence:</strong> ${clampPercent(result.confidence)}% 
            <span class="ts-confidence-category">(${result.confidenceCategory || 'low'})</span>
            <div class="ts-confidence-bar ts-confidence-bar-small">
              <div class="ts-confidence-fill ${getConfidenceClass(result.confidenceCategory || 'low')}" 
                   style="width: ${clampPercent(result.confidence)}%"></div>
            </div>
          </div>
          
          ${result.knowledgeCutoffMessage ? `
            <div class="ts-agent-cutoff">
              <strong>Note:</strong> ${escapeHtml(result.knowledgeCutoffMessage)}
            </div>
          ` : ''}
          
          ${result.sources && result.sources.length > 0 ? `
            <div class="ts-agent-sources">
              <strong>Evidence Sources (${result.sources.length}):</strong>
              ${renderSources(result.sources)}
            </div>
          ` : '<p class="ts-no-sources-agent">No sources found by this agent</p>'}
        </div>
      </details>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Get friendly agent name from result
 * @param {Object} result - Agent result
 * @param {number} index - Agent index
 * @returns {string} Friendly name
 * @private
 */
function getAgentFriendlyName(result, index) {
  if (result.providerName && result.modelDisplayName) {
    return `${result.providerName} - ${result.modelDisplayName}`;
  }
  
  // Try to extract provider and model from agentId
  // Format: "providerId-model-timestamp" or similar
  if (result.agentId) {
    const parts = result.agentId.split('-');
    if (parts.length >= 2) {
      const provider = capitalizeFirst(parts[0]);
      const model = parts[1];
      return `${provider} - ${model}`;
    }
    // Fallback: show first 20 chars of ID
    return result.agentId.substring(0, 20) + (result.agentId.length > 20 ? '...' : '');
  }
  return `Agent ${index + 1}`;
}

/**
 * Get provider icon
 * @param {string} agentId - Agent identifier
 * @returns {string} Icon text
 * @private
 */
function getProviderIcon(result) {
  const id = (result.providerId || result.agentId || '').toLowerCase();
  if (!id) return '[AI]';
  
  if (id.includes('openai') || id.includes('gpt')) return '[OpenAI]';
  if (id.includes('anthropic') || id.includes('claude')) return '[Anthropic]';
  if (id.includes('google') || id.includes('gemini')) return '[Google]';
  return '[AI]';
}

/**
 * Check if this agent's verdict disagrees with others
 * @param {Object} result - This agent's result
 * @param {Array} allResults - All agent results
 * @returns {boolean} True if disagreement exists
 * @private
 */
function hasDisagreementWithOthers(result, allResults) {
  if (!result || !allResults || allResults.length <= 1) {
    return false;
  }
  
  const thisVerdict = result.verdict;
  
  // Check if any other agent has a different verdict
  for (const other of allResults) {
    if (other.agentId !== result.agentId && other.verdict !== thisVerdict) {
      // Strong disagreement: TRUE vs FALSE
      if ((thisVerdict === 'TRUE' && other.verdict === 'FALSE') ||
          (thisVerdict === 'FALSE' && other.verdict === 'TRUE')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 * @private
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Update a fact with new verification result
 * @param {string} factId - Fact identifier
 * @param {Object} result - Updated aggregated result
 */
export function updateFact(factId, result) {
  // Store updated result
  factsData.set(factId, result);
  
  // If modal is open and showing this fact, update it
  if (currentSentenceId && modalContainer && !modalContainer.classList.contains('hidden')) {
    const existingElement = modalContainer.querySelector(`[data-fact-id="${factId}"]`);
    if (existingElement) {
      const newElement = renderFact(result);
      existingElement.replaceWith(newElement);
    }
  }
}

/**
 * Close the modal
 */
export function closeModal() {
  if (modalContainer) {
    modalContainer.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }
  currentSentenceId = null;
  factsData.clear();
}

/**
 * Get verdict emoji
 * @param {string} verdict - Verdict string
 * @returns {string} Emoji
 */
function getVerdictEmoji(verdict) {
  switch (verdict?.toUpperCase()) {
    case 'TRUE':
      return '✓';
    case 'FALSE':
      return '✗';
    default:
      return '?';
  }
}

/**
 * Get confidence class based on category
 * @param {string} category - Confidence category
 * @returns {string} CSS class
 */
function getConfidenceClass(category) {
  switch (category?.toLowerCase()) {
    case 'very-high':
    case 'high':
      return 'ts-confidence-high';
    case 'medium':
      return 'ts-confidence-medium';
    case 'very-low':
    case 'low':
      return 'ts-confidence-low';
    default:
      return 'ts-confidence-low';
  }
}

/**
 * Get tier badge HTML
 * @param {number} tier - Tier number (1-4)
 * @returns {string} HTML string
 */
function getTierBadge(tier) {
  const labels = {
    1: 'Authoritative',
    2: 'Reputable',
    3: 'General',
    4: 'Unverified'
  };
  const label = labels[tier] || 'Unknown';
  return `<span class="ts-tier-badge ts-tier-${tier}">${label}</span>`;
}

 
// Register message handlers
registerHandler(MessageType.OPEN_MODAL, async (payload) => {
  const { sentenceId, sentenceText, facts } = payload;
  openModalForSentence(sentenceId, sentenceText, facts);
  return { success: true };
});

registerHandler(MessageType.UPDATE_MODAL, async (payload) => {
  const { factId, result } = payload;
  updateFact(factId, result);
  return { success: true };
});

registerHandler(MessageType.CLOSE_MODAL, async () => {
  closeModal();
  return { success: true };
});

console.log('TruthSeek modal component loaded');


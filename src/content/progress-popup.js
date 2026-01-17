/**
 * TruthSeek Progress Popup
 * Floating progress indicator during fact extraction and verification
 */

import { sendToBackground } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { escapeHtml, clampPercent } from './dom-utils.js';

let progressPopup = null;
let progressState = {
  visible: false,
  currentStep: '',
  progress: 0,
  totalFacts: 0,
  processedFacts: 0,
  agentUpdates: []
};

/**
 * Initialize progress popup
 */
export function initializeProgressPopup() {
  console.log('TruthSeek progress popup initialized');
}

/**
 * Show progress popup
 * @param {Object} options - Initial options
 */
export function showProgress(options = {}) {
  const safeOptions = normalizeObject(options);
  if (progressPopup) {
    // Already showing, just update
    updateProgress(safeOptions);
    return;
  }
  
  // Create popup element
  progressPopup = createProgressPopup();
  document.body.appendChild(progressPopup);
  
  // Update initial state
  progressState.visible = true;
  progressState.currentStep = safeOptions.currentStep || 'Starting...';
  progressState.progress = clampPercent(safeOptions.progress);
  progressState.totalFacts = safeOptions.totalFacts || 0;
  progressState.processedFacts = safeOptions.processedFacts || 0;
  progressState.agentUpdates = [];
  
  // Render initial state
  renderProgress();
  
  // Animate in
  requestAnimationFrame(() => {
    progressPopup.classList.add('visible');
  });
  
  console.log('Progress popup shown');
}

/**
 * Update progress popup
 * @param {Object} updates - Progress updates
 */
export function updateProgress(updates = {}) {
  const safeUpdates = normalizeObject(updates);
  if (!progressPopup) {
    console.warn('Progress popup not shown, cannot update');
    return;
  }
  
  // Update state
  if (safeUpdates.currentStep !== undefined) {
    progressState.currentStep = safeUpdates.currentStep;
  }
  if (safeUpdates.progress !== undefined) {
    progressState.progress = clampPercent(safeUpdates.progress);
  }
  if (safeUpdates.totalFacts !== undefined) {
    progressState.totalFacts = safeUpdates.totalFacts;
  }
  if (safeUpdates.processedFacts !== undefined) {
    progressState.processedFacts = safeUpdates.processedFacts;
  }
  if (safeUpdates.agentUpdate) {
    // Add agent update to list (keep last 5)
    progressState.agentUpdates.unshift(safeUpdates.agentUpdate);
    progressState.agentUpdates = progressState.agentUpdates.slice(0, 5);
  }
  
  // Re-render
  renderProgress();
}

/**
 * Hide progress popup
 */
export function hideProgress() {
  if (!progressPopup) {
    return;
  }
  
  // Animate out
  progressPopup.classList.remove('visible');
  
  // Remove after animation
  setTimeout(() => {
    if (progressPopup && progressPopup.parentNode) {
      progressPopup.parentNode.removeChild(progressPopup);
    }
    progressPopup = null;
    progressState.visible = false;
  }, 300);
  
  console.log('Progress popup hidden');
}

/**
 * Create progress popup DOM structure
 * @returns {HTMLElement}
 * @private
 */
function createProgressPopup() {
  const popup = document.createElement('div');
  popup.className = 'truthseek-progress-popup';
  popup.setAttribute('role', 'status');
  popup.setAttribute('aria-live', 'polite');
  
  return popup;
}

/**
 * Render progress popup content
 * @private
 */
function renderProgress() {
  if (!progressPopup) {
    return;
  }
  
  const { currentStep, progress, totalFacts, processedFacts, agentUpdates } = progressState;
  
  // Calculate percentage
  const percentage = totalFacts > 0 
    ? clampPercent((processedFacts / totalFacts) * 100)
    : clampPercent(progress);
  
  // Build HTML
  const html = `
    <div class="truthseek-progress-header">
      <div class="truthseek-progress-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.2"/>
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="1s"
              repeatCount="indefinite"/>
          </path>
        </svg>
      </div>
      <div class="truthseek-progress-title">TruthSeek</div>
      <button class="truthseek-progress-close" aria-label="Cancel fact-check">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div class="truthseek-progress-body">
      <div class="truthseek-progress-step">${escapeHtml(currentStep)}</div>
      
      <div class="truthseek-progress-bar-container">
        <div class="truthseek-progress-bar" style="width: ${percentage}%"></div>
      </div>
      
      <div class="truthseek-progress-stats">
        ${totalFacts > 0 
          ? `<span>${processedFacts} / ${totalFacts} facts processed</span>`
          : `<span>${percentage}%</span>`
        }
      </div>
      
      ${agentUpdates.length > 0 ? `
        <div class="truthseek-progress-agents">
          ${agentUpdates.map(update => `
            <div class="truthseek-progress-agent ${update.status || ''}">
              <span class="agent-name">${escapeHtml(update.agentName || 'Agent')}</span>
              <span class="agent-status">
                ${update.status === 'complete' 
                  ? `[Done] ${update.factsCount || 0} facts`
                  : update.status === 'failed'
                  ? '[Failed]'
                  : '...'
                }
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
  
  progressPopup.innerHTML = html;
  
  // Attach event listeners
  const closeButton = progressPopup.querySelector('.truthseek-progress-close');
  if (closeButton) {
    closeButton.addEventListener('click', handleCancelClick);
  }
}

/**
 * Handle cancel button click
 * @private
 */
function handleCancelClick() {
  console.log('User cancelled fact-check');
  
  // Send cancel message to background
  sendToBackground(MessageType.CANCEL_FACT_CHECK, {}).catch(error => {
    console.error('Error sending cancel message:', error);
  });
  
  // Hide popup
  hideProgress();
}

function normalizeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

 

/**
 * Show results summary
 * @param {Object} summary - Results summary
 */
export function showResults(summary) {
  const safeSummary = normalizeObject(summary);
  if (!progressPopup) {
    // Create popup if it doesn't exist
    progressPopup = createProgressPopup();
    document.body.appendChild(progressPopup);
    progressState.visible = true;
  }
  
  // Transform to results mode
  progressPopup.classList.add('results-mode');
  
  // Determine overall status color
  const statusColor = getOverallStatusColor(safeSummary);
  
  // Build results HTML
  const html = `
    <div class="truthseek-progress-header ${statusColor}">
      <div class="truthseek-progress-title">TruthSeek Results</div>
      <button class="truthseek-results-close" aria-label="Close results">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div class="truthseek-results-body">
      <div class="truthseek-results-summary">
        <div class="truthseek-result-stat">
          <span class="truthseek-stat-value">${safeSummary.totalFacts || 0}</span>
          <span class="truthseek-stat-label">Facts Checked</span>
        </div>
        
        <div class="truthseek-result-breakdown">
          <div class="truthseek-breakdown-item truthseek-breakdown-true">
            <span class="truthseek-breakdown-count">${safeSummary.trueCount || 0}</span>
            <span class="truthseek-breakdown-label">True</span>
          </div>
          <div class="truthseek-breakdown-item truthseek-breakdown-false">
            <span class="truthseek-breakdown-count">${safeSummary.falseCount || 0}</span>
            <span class="truthseek-breakdown-label">False</span>
          </div>
          <div class="truthseek-breakdown-item truthseek-breakdown-unverified">
            <span class="truthseek-breakdown-count">${safeSummary.unverifiedCount || 0}</span>
            <span class="truthseek-breakdown-label">Unverified</span>
          </div>
        </div>
      </div>
      
      <div class="truthseek-overall-confidence">
        <span class="truthseek-confidence-label">Overall Confidence</span>
        <div class="truthseek-confidence-bar-large">
          <div class="truthseek-confidence-fill-large ${getConfidenceClass(safeSummary.overallConfidenceCategory)}" 
               style="width: ${clampPercent(safeSummary.overallConfidence)}%"></div>
        </div>
        <span class="truthseek-confidence-value">${clampPercent(safeSummary.overallConfidence)}%</span>
      </div>
      
      <p class="truthseek-results-hint">Tip: Click highlighted text to view details</p>
    </div>
  `;
  
  progressPopup.innerHTML = html;
  
  // Show popup if hidden
  requestAnimationFrame(() => {
    progressPopup.classList.add('visible');
  });
  
  // Attach close button handler
  const closeButton = progressPopup.querySelector('.truthseek-results-close');
  if (closeButton) {
    closeButton.addEventListener('click', closeResults);
  }
  
  console.log('Results summary shown:', safeSummary);
}

/**
 * Close results and clean up page modifications
 */
export function closeResults() {
  console.log('Closing results and removing highlights');
  
  // Hide popup
  if (progressPopup) {
    progressPopup.classList.remove('visible');
    
    // Remove after animation
    setTimeout(() => {
      if (progressPopup && progressPopup.parentNode) {
        progressPopup.parentNode.removeChild(progressPopup);
      }
      progressPopup = null;
      progressState.visible = false;
    }, 300);
  }
  
  // Import and call highlighter to remove all highlights
  import('./highlighter.js').then(({ clearAllHighlights }) => {
    clearAllHighlights();
  }).catch(error => {
    console.error('Error clearing highlights:', error);
  });
  
  // Import and close modal if open
  import('./modal.js').then(({ closeModal }) => {
    closeModal();
  }).catch(error => {
    console.error('Error closing modal:', error);
  });
}

/**
 * Get overall status color based on results
 * @param {Object} summary - Results summary
 * @returns {string} CSS class
 * @private
 */
function getOverallStatusColor(summary) {
  const total = summary.totalFacts || 1;
  const falsePercent = ((summary.falseCount || 0) / total) * 100;
  const truePercent = ((summary.trueCount || 0) / total) * 100;
  
  if (falsePercent > 30) {
    return 'status-critical'; // Many false facts
  } else if (falsePercent > 10) {
    return 'status-warning'; // Some false facts
  } else if (truePercent > 70) {
    return 'status-success'; // Mostly true
  } else {
    return 'status-neutral'; // Mixed or mostly unverified
  }
}

/**
 * Get confidence class based on category
 * @param {string} category - Confidence category
 * @returns {string} CSS class
 * @private
 */
function getConfidenceClass(category) {
  switch (category?.toLowerCase()) {
    case 'high':
      return 'confidence-high';
    case 'medium':
      return 'confidence-medium';
    default:
      return 'confidence-low';
  }
}

/**
 * Get current progress state
 * @returns {Object}
 */
export function getProgressState() {
  return { ...progressState };
}


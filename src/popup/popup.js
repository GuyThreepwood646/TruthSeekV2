/**
 * TruthSeek Popup Logic
 * Manages popup UI state and user interactions
 */

// Import messaging utilities
import { initialize as initializeMessaging, sendToBackground, registerHandler } from './messaging.js';
import { MessageType } from '../shared/message-types.js';

// DOM Elements
let addAgentBtn;
let runBtn;
let cancelBtn;
let agentList;
let emptyState;
let statusMessage;

// State
let agents = [];
let extensionState = {
  status: 'IDLE',
  currentStep: null,
  totalFacts: null,
  processedFacts: null,
  results: null,
  startedAt: null,
  completedAt: null
};

/**
 * Initialize popup
 */
async function initialize() {
  // Initialize messaging system
  initializeMessaging();
  
  // Register message handlers
  registerHandler(MessageType.STATE_UPDATE, async (payload) => {
    extensionState = payload;
    updateControls();
  });
  
  // Get DOM elements
  addAgentBtn = document.getElementById('add-agent-btn');
  runBtn = document.getElementById('run-btn');
  cancelBtn = document.getElementById('cancel-btn');
  agentList = document.getElementById('agent-list');
  emptyState = document.getElementById('empty-state');
  statusMessage = document.getElementById('status-message');

  // Load state from storage
  await loadState();

  // Set up event listeners
  addAgentBtn.addEventListener('click', handleAddAgent);
  runBtn.addEventListener('click', handleRun);
  cancelBtn.addEventListener('click', handleCancel);
  
  // Set donation link (placeholder - update with actual link when available)
  const donationLink = document.getElementById('donation-link');
  if (donationLink) {
    donationLink.href = 'https://ko-fi.com/truthseek'; // TODO: Update with actual Ko-fi/PayPal/GitHub Sponsors link
  }

  // Render initial UI
  renderAgents();
  updateControls();
}

/**
 * Load state from chrome.storage
 */
async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['agents', 'state'], (result) => {
      if (result.agents) {
        agents = result.agents;
      }
      if (result.state) {
        extensionState = result.state;
      }
      resolve();
    });
  });
}

/**
 * Save agents to storage
 */
async function saveAgents() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ agents }, resolve);
  });
}

/**
 * Render agent list
 */
function renderAgents() {
  // Clear current list (except empty state)
  const agentItems = agentList.querySelectorAll('.agent-item');
  agentItems.forEach(item => item.remove());

  if (agents.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';

    agents.forEach((agent, index) => {
      const agentItem = createAgentItem(agent, index);
      agentList.appendChild(agentItem);
    });
  }
}

/**
 * Create agent list item element
 */
function createAgentItem(agent, index) {
  const div = document.createElement('div');
  div.className = 'agent-item';
  const isEnabled = agent.enabled !== false; // Default to true if not set
  
  div.innerHTML = `
    <div class="agent-checkbox-container">
      <input 
        type="checkbox" 
        class="agent-checkbox" 
        id="agent-checkbox-${index}" 
        data-index="${index}"
        ${isEnabled ? 'checked' : ''}
      />
      <label for="agent-checkbox-${index}" class="agent-checkbox-label"></label>
    </div>
    <div class="agent-info">
      <div class="agent-name">${agent.displayName || agent.providerId}</div>
      <div class="agent-model">${agent.modelDisplayName || agent.model}</div>
      <div class="agent-cutoff">Knowledge cutoff: ${agent.knowledgeCutoff || 'Unknown'}</div>
    </div>
    <button class="agent-remove" data-index="${index}" title="Remove agent">×</button>
  `;

  // Add checkbox handler
  const checkbox = div.querySelector('.agent-checkbox');
  checkbox.addEventListener('change', () => handleToggleAgent(index, checkbox.checked));

  // Add remove handler
  const removeBtn = div.querySelector('.agent-remove');
  removeBtn.addEventListener('click', () => handleRemoveAgent(index));

  return div;
}

/**
 * Handle Add Agent button click
 */
async function handleAddAgent() {
  try {
    // Import agent manager dynamically
    const { addAgent } = await import('./agent-manager.js');
    
    // Show agent addition flow
    const agentConfig = await addAgent();
    
    if (agentConfig) {
      // Add to agents array
      agents.push(agentConfig);
      await saveAgents();
      
      // Re-render
      renderAgents();
      updateControls();
      
      statusMessage.textContent = 'Agent added successfully!';
      statusMessage.style.color = '#28a745';
      
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 3000);
    }
  } catch (error) {
    console.error('Error adding agent:', error);
    statusMessage.textContent = `Error: ${error.message}`;
    statusMessage.style.color = '#dc3545';
  }
}

/**
 * Handle Toggle Agent (enable/disable)
 */
async function handleToggleAgent(index, enabled) {
  agents[index].enabled = enabled;
  await saveAgents();
  updateControls();
  
  const action = enabled ? 'enabled' : 'disabled';
  statusMessage.textContent = `Agent ${action}`;
  statusMessage.style.color = enabled ? '#28a745' : '#6b7280';
  
  setTimeout(() => {
    statusMessage.textContent = '';
  }, 2000);
}

/**
 * Handle Remove Agent
 */
async function handleRemoveAgent(index) {
  const agent = agents[index];
  
  // Import agent manager
  const { removeAgent } = await import('./agent-manager.js');
  
  // Remove agent (includes confirmation)
  const removed = await removeAgent(agent.id);
  
  if (removed) {
    agents.splice(index, 1);
    await saveAgents();
    renderAgents();
    updateControls();
    
    statusMessage.textContent = 'Agent removed successfully';
    statusMessage.style.color = '#666';
    
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 2000);
  }
}

/**
 * Handle Run button click
 */
async function handleRun() {
  const enabledAgents = agents.filter(a => a.enabled !== false);
  
  if (agents.length === 0) {
    statusMessage.textContent = 'Please add at least one AI agent';
    statusMessage.style.color = '#dc3545';
    return;
  }
  
  if (enabledAgents.length === 0) {
    statusMessage.textContent = 'Please enable at least one AI agent';
    statusMessage.style.color = '#dc3545';
    return;
  }

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    statusMessage.textContent = 'No active tab found';
    statusMessage.style.color = '#dc3545';
    return;
  }

  try {
    console.log('Sending START_FACT_CHECK to background for tab:', tab.id);
    
    // Send START_FACT_CHECK message to background
    const response = await sendToBackground(MessageType.START_FACT_CHECK, { tabId: tab.id });
    
    console.log('Received response from background:', response);
    
    statusMessage.textContent = 'Starting fact-check...';
    statusMessage.style.color = '#667eea';
    
    // Update UI state
    extensionState.status = 'RUNNING';
    updateControls();
    
    // Close popup after starting (user can reopen to see progress)
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error('Error starting fact-check:', error);
    statusMessage.textContent = `Error: ${error.message}`;
    statusMessage.style.color = '#dc3545';
  }
}

/**
 * Handle Cancel button click
 */
async function handleCancel() {
  try {
    // Send CANCEL_FACT_CHECK message to background
    await sendToBackground(MessageType.CANCEL_FACT_CHECK, {});
    
    statusMessage.textContent = 'Cancelling...';
    statusMessage.style.color = '#ffc107';
    
    // Update UI state
    extensionState.status = 'CANCELLED';
    updateControls();
    
    // Close popup after cancelling
    setTimeout(() => {
      window.close();
    }, 500);
  } catch (error) {
    console.error('Error cancelling fact-check:', error);
    statusMessage.textContent = `Error: ${error.message}`;
    statusMessage.style.color = '#dc3545';
  }
}

/**
 * Update control button states based on current state
 */
function updateControls() {
  const hasAgents = agents.length > 0;
  const hasEnabledAgents = agents.some(a => a.enabled !== false);
  const isRunning = extensionState.status === 'RUNNING';

  // Run button: enabled if has enabled agents and not running
  runBtn.disabled = !hasEnabledAgents || isRunning;

  // Cancel button: visible only when running
  cancelBtn.style.display = isRunning ? 'block' : 'none';

  // Update status message based on state
  if (extensionState.status === 'RUNNING') {
    statusMessage.textContent = extensionState.currentStep || 'Processing...';
    statusMessage.style.color = '#667eea';
  } else if (extensionState.status === 'COMPLETE') {
    statusMessage.textContent = 'Fact-checking complete';
    statusMessage.style.color = '#28a745';
  } else if (extensionState.status === 'CANCELLED') {
    statusMessage.textContent = 'Fact-checking cancelled';
    statusMessage.style.color = '#ffc107';
  } else {
    statusMessage.textContent = '';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}


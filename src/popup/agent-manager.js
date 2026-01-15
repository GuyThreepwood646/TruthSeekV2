/**
 * TruthSeek AI Agent Management UI
 * Handles adding, configuring, and removing AI agents
 */

import { sendToBackground } from './messaging.js';
import { MessageType } from '../shared/message-types.js';
import { OpenAIProvider } from '../ai/providers/openai.js';
import { AnthropicProvider } from '../ai/providers/anthropic.js';
import { GoogleProvider } from '../ai/providers/google.js';
import { getModelsForProvider } from '../config/model-metadata.js';

/**
 * Show provider selection modal
 * @returns {Promise<string|null>} Selected provider ID or null if cancelled
 */
export async function showProviderSelection() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h2>Select AI Provider</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="provider-grid">
          <button class="provider-card" data-provider="openai">
            <div class="provider-icon">[AI]</div>
            <div class="provider-name">OpenAI</div>
            <div class="provider-desc">GPT-5.2 Pro, GPT-5.2, GPT-5 Mini</div>
            <div class="provider-auth">API Key</div>
          </button>
          
          <button class="provider-card" data-provider="anthropic">
            <div class="provider-icon">[AI]</div>
            <div class="provider-name">Anthropic</div>
            <div class="provider-desc">Claude Opus 4.5, Claude Sonnet 4.5</div>
            <div class="provider-auth">API Key</div>
          </button>
          
          <button class="provider-card" data-provider="google">
            <div class="provider-icon">[AI]</div>
            <div class="provider-name">Google</div>
            <div class="provider-desc">Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Pro</div>
            <div class="provider-auth">API Key</div>
          </button>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle provider selection
    const providerCards = modal.querySelectorAll('.provider-card');
    providerCards.forEach(card => {
      card.addEventListener('click', () => {
        const providerId = card.dataset.provider;
        document.body.removeChild(overlay);
        resolve(providerId);
      });
    });
    
    // Handle close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(null);
      }
    });
  });
}

/**
 * Show API key input modal
 * @param {string} providerId - Provider ID
 * @returns {Promise<string|null>} API key or null if cancelled
 */
export async function showApiKeyInput(providerId) {
  const providerNames = {
    openai: 'OpenAI',
    anthropic: 'Anthropic'
  };
  
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h2>${providerNames[providerId]} API Key</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="security-warning">
          <strong>Security Notice</strong>
          <p>Your API key will be encrypted and stored locally in your browser. It will never be sent to TruthSeek servers.</p>
          <p>Only enter your API key if you trust this extension.</p>
        </div>
        
        <div class="form-group">
          <label for="api-key-input">API Key</label>
          <input 
            type="password" 
            id="api-key-input" 
            class="form-control" 
            placeholder="sk-..." 
            autocomplete="off"
          />
          <small class="form-text">Your key will be encrypted before storage</small>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="save-btn">Save & Continue</button>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const input = modal.querySelector('#api-key-input');
    const saveBtn = modal.querySelector('#save-btn');
    const cancelBtn = modal.querySelector('#cancel-btn');
    const closeBtn = modal.querySelector('.modal-close');
    
    // Focus input
    setTimeout(() => input.focus(), 100);
    
    // Handle save
    saveBtn.addEventListener('click', () => {
      const apiKey = input.value.trim();
      if (!apiKey) {
        alert('Please enter an API key');
        return;
      }
      document.body.removeChild(overlay);
      resolve(apiKey);
    });
    
    // Handle enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
    
    // Handle cancel
    const handleCancel = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });
  });
}

/**
 * Show model selection modal
 * @param {string} providerId - Provider ID
 * @returns {Promise<string|null>} Selected model or null if cancelled
 */
export async function showModelSelection(providerId) {
  const models = getModelsForProvider(providerId);
  
  if (models.length === 0) {
    alert('No models available for this provider');
    return null;
  }
  
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h2>Select Model</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="model-list">
          ${models.map(m => `
            <button class="model-card" data-model="${m.model}">
              <div class="model-name">${m.displayName}</div>
              <div class="model-info">
                <span class="model-cutoff">Cutoff: ${m.knowledgeCutoff}</span>
                <span class="model-rank">Quality: ${m.qualityRank}/100</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle model selection
    const modelCards = modal.querySelectorAll('.model-card');
    modelCards.forEach(card => {
      card.addEventListener('click', () => {
        const model = card.dataset.model;
        document.body.removeChild(overlay);
        resolve(model);
      });
    });
    
    // Handle close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(null);
      }
    });
  });
}

/**
 * Add new AI agent
 * @returns {Promise<object|null>} Agent config or null if cancelled
 */
export async function addAgent() {
  try {
    // Step 1: Select provider
    const providerId = await showProviderSelection();
    if (!providerId) return null;
    
    // Step 2: Authenticate
    let provider;
    let agentConfig = {
      id: generateUUID(),
      providerId,
      model: null,
      encryptedCredential: null,
      qualityRank: 0,
      displayName: null,
      modelDisplayName: null,
      knowledgeCutoff: null,
      enabled: true // New agents are enabled by default
    };
    
    // API key authentication for all providers
    const apiKey = await showApiKeyInput(providerId);
    if (!apiKey) return null;
    
    // Select model
    const model = await showModelSelection(providerId);
    if (!model) return null;
    
    agentConfig.model = model;
    
    // Create provider instance and authenticate
    let ProviderClass;
    if (providerId === 'openai') {
      ProviderClass = OpenAIProvider;
    } else if (providerId === 'anthropic') {
      ProviderClass = AnthropicProvider;
    } else if (providerId === 'google') {
      ProviderClass = GoogleProvider;
    }
    
    provider = new ProviderClass(agentConfig);
    await provider.authenticate(apiKey);
    
    // Update config from provider
    agentConfig = provider.config;
    
    // Get provider info
    const providerInfo = provider.getProviderInfo();
    agentConfig.displayName = providerInfo.displayName;
    agentConfig.modelDisplayName = providerInfo.modelDisplayName;
    agentConfig.knowledgeCutoff = providerInfo.knowledgeCutoff;
    agentConfig.qualityRank = provider.getModelQualityRank();
    
    return agentConfig;
    
  } catch (error) {
    console.error('Error adding agent:', error);
    alert(`Failed to add agent: ${error.message}`);
    return null;
  }
}

/**
 * Remove agent
 * @param {string} agentId - Agent ID to remove
 * @returns {Promise<boolean>} True if removed
 */
export async function removeAgent(agentId) {
  if (!confirm('Are you sure you want to remove this agent? This will delete all stored credentials.')) {
    return false;
  }
  
  try {
    const result = await chrome.storage.local.get(['agents']);
    const agents = result.agents || [];
    
    // Find the agent to remove
    const agent = agents.find(a => a.id === agentId);
    
    if (agent) {
      // Securely delete encrypted credentials from storage
      const storageKey = `agent_credential_${agentId}`;
      await chrome.storage.local.remove([storageKey]);
    }
    
    // Remove from agents list
    const filtered = agents.filter(a => a.id !== agentId);
    await chrome.storage.local.set({ agents: filtered });
    
    return true;
  } catch (error) {
    console.error('Error removing agent:', error);
    alert(`Failed to remove agent: ${error.message}`);
    return false;
  }
}

/**
 * Generate UUID
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


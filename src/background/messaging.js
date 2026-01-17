/**
 * TruthSeek Background Messaging System
 * Central message router for background service worker
 */

import { MessageType } from '../shared/message-types.js';
import { createMessage, sanitizePayload, isValidMessage } from '../shared/message-utils.js';

// Handler registry
const handlers = new Map();

/**
 * Initialize background messaging system
 * Sets up message listeners
 */
export function initialize() {
  // Listen for messages from popup and content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });
  
  console.log('Background messaging initialized');
}

/**
 * Register a handler for a specific message type
 * @param {string} type - MessageType enum value
 * @param {Function} handler - Async function(payload, sender) => result
 */
export function registerHandler(type, handler) {
  if (!Object.values(MessageType).includes(type)) {
    console.error('Invalid message type:', type);
    return;
  }
  
  if (typeof handler !== 'function') {
    console.error('Handler must be a function');
    return;
  }
  
  handlers.set(type, handler);
  console.log('Registered handler for:', type);
}

/**
 * Handle incoming message
 * Routes to appropriate handler and sends response
 * @param {object} message - Message object
 * @param {object} sender - Chrome message sender info
 * @param {Function} sendResponse - Response callback
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    // Validate message structure
    if (!isValidMessage(message)) {
      console.error('Invalid message structure:', message);
      sendResponse({ error: 'Invalid message: missing or invalid type' });
      return;
    }
    
    // Sanitize payload
    message.payload = sanitizePayload(message.payload);
    
    // Get handler for message type
    const handler = handlers.get(message.type);
    
    if (!handler) {
      console.warn('No handler registered for message type:', message.type);
      sendResponse({ error: `Unknown message type: ${message.type}` });
      return;
    }
    
    // Execute handler
    console.log('Handling message:', message.type, 'from:', sender.tab?.id || 'popup');
    const result = await handler(message.payload, sender);
    
    // Send success response
    sendResponse({ success: true, data: result });
    
  } catch (error) {
    console.error('Error handling message:', message.type, error);
    sendResponse({ error: error.message });
  }
}

/**
 * Ensure content script is injected in tab
 * @param {number} tabId - Target tab ID
 * @returns {Promise<boolean>} True if content script is ready
 */
async function ensureContentScriptInjected(tabId) {
  try {
    // Get tab info to check URL
    const tab = await chrome.tabs.get(tabId);
    
    // Check if URL is restricted (chrome://, chrome-extension://, etc.)
    if (!tab.url || !/^https?:\/\//.test(tab.url)) {
      console.warn('Cannot inject content script into restricted URL:', tab.url);
      return false;
    }
    
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (error) {
    // Content script not loaded, inject it manually
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['dist/content.js']
      });
      
      // Also inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: [
          'src/content/styles.css',
          'src/content/modal.css',
          'src/content/progress-popup.css'
        ]
      });
      
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return false;
    }
  }
}

/**
 * Send message to a specific tab
 * @param {number} tabId - Target tab ID
 * @param {object} message - Message object
 * @param {object} options - Options for sending
 * @param {boolean} options.silent - If true, don't log warnings for expected errors (tab closed/navigated)
 * @returns {Promise<any>} Response from tab, or null if tab is closed/navigated
 */
export async function sendToTab(tabId, message, options = {}) {
  const { silent = false } = options;
  
  try {
    if (!message || typeof message !== 'object' || !message.type) {
      throw new Error('Invalid message: missing type');
    }
    
    const outboundMessage = isValidMessage(message)
      ? message
      : createMessage(message.type, message.payload, tabId);
    
    // Check if tab still exists before attempting to send message
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      // Tab doesn't exist (closed or invalid)
      if (!silent) {
        console.debug(`Tab ${tabId} no longer exists (closed or invalid)`);
      }
      return null;
    }
    
    // Ensure content script is loaded
    const isReady = await ensureContentScriptInjected(tabId);
    if (!isReady) {
      throw new Error('Cannot access this page. TruthSeek only works on regular web pages (http:// or https://)');
    }
    
    const response = await chrome.tabs.sendMessage(tabId, outboundMessage);
    return response;
  } catch (error) {
    // Check if it's a "message channel closed" error (tab closed/navigated)
    if (error.message && (
      error.message.includes('message channel closed') ||
      error.message.includes('Tab closed or navigated away') ||
      error.message.includes('Could not establish connection')
    )) {
      if (!silent) {
        console.debug(`Tab ${tabId} closed or navigated away during message send`);
      }
      return null; // Return null instead of throwing for expected errors
    }
    
    // Check if it's a "receiving end does not exist" error
    if (error.message && error.message.includes('Receiving end does not exist')) {
      if (!silent) {
        console.debug(`Content script not responding in tab ${tabId}`);
      }
      return null; // Return null for expected errors
    }
    
    // For unexpected errors, still log and throw
    console.error(`Failed to send message to tab ${tabId}:`, error.message);
    throw error;
  }
}

/**
 * Broadcast message to all tabs
 * @param {object} message - Message object
 * @returns {Promise<void>}
 */
export async function broadcast(message) {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id) {
        if (!tab.url || !/^https?:\/\//.test(tab.url)) {
          continue;
        }
        try {
          await sendToTab(tab.id, message, { silent: true });
        } catch (error) {
          // Tab may not have content script - continue silently
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting message:', error);
  }
}

/**
 * Send message to popup (if open)
 * @param {object} message - Message object
 * @returns {Promise<any>}
 */
export async function sendToPopup(message) {
  try {
    if (!message || typeof message !== 'object' || !message.type) {
      throw new Error('Invalid message: missing type');
    }
    
    const outboundMessage = isValidMessage(message)
      ? message
      : createMessage(message.type, message.payload, message.tabId ?? null);
    
    const response = await chrome.runtime.sendMessage(outboundMessage);
    return response;
  } catch (error) {
    // Popup may not be open - this is not an error
    console.log('Popup not available:', error.message);
    return null;
  }
}


/**
 * TruthSeek Popup Messaging System
 * Message handler for popup UI
 */

import { MessageType } from '../shared/message-types.js';
import { createMessage, isValidMessage } from '../shared/message-utils.js';

// Handler registry
const handlers = new Map();

/**
 * Initialize popup messaging system
 * Sets up message listeners
 */
export function initialize() {
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });
  
  console.log('Popup messaging initialized');
}

/**
 * Register a handler for a specific message type
 * @param {string} type - MessageType enum value
 * @param {Function} handler - Async function(payload) => result
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
  console.log('Registered popup handler for:', type);
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
      sendResponse({ error: 'Invalid message structure' });
      return;
    }
    
    // Get handler for message type
    const handler = handlers.get(message.type);
    
    if (!handler) {
      // Unknown message type - ignore silently
      return;
    }
    
    // Execute handler
    console.log('Popup handling message:', message.type);
    const result = await handler(message.payload);
    
    // Send success response
    sendResponse({ success: true, data: result });
    
  } catch (error) {
    console.error('Error handling message:', message.type, error);
    sendResponse({ error: error.message });
  }
}

/**
 * Send message to background script
 * @param {string} type - MessageType enum value
 * @param {any} payload - Message payload
 * @returns {Promise<any>} Response from background
 */
export async function sendToBackground(type, payload) {
  const message = createMessage(type, payload);
  
  try {
    const response = await chrome.runtime.sendMessage(message);
    
    if (response && response.error) {
      throw new Error(response.error);
    }
    
    return response?.data;
  } catch (error) {
    console.error('Error sending message to background:', error);
    throw error;
  }
}

/**
 * Send message to current tab's content script
 * @param {string} type - MessageType enum value
 * @param {any} payload - Message payload
 * @returns {Promise<any>} Response from content script
 */
export async function sendToContent(type, payload) {
  const message = createMessage(type, payload);
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, message);
    
    if (response && response.error) {
      throw new Error(response.error);
    }
    
    return response?.data;
  } catch (error) {
    console.error('Error sending message to content:', error);
    throw error;
  }
}


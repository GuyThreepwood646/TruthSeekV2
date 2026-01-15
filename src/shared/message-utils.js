/**
 * TruthSeek Message Utilities
 * Functions for creating and sanitizing messages
 */

import { MessageType } from './message-types.js';

/**
 * Create a standardized message object
 * @param {string} type - MessageType enum value
 * @param {any} payload - Message payload data
 * @param {number} [tabId] - Optional tab ID for tab-specific messages
 * @returns {object} Standardized message object
 */
export function createMessage(type, payload, tabId = null) {
  return {
    type,
    payload: sanitizePayload(payload),
    tabId,
    timestamp: Date.now()
  };
}

/**
 * Sanitize untrusted payload data
 * Removes script tags, event handlers, and dangerous content
 * @param {any} payload - Untrusted input
 * @returns {any} Sanitized payload
 */
export function sanitizePayload(payload) {
  // Handle null/undefined
  if (payload === null || payload === undefined) {
    return null;
  }
  
  // Handle strings - remove script tags and event handlers
  if (typeof payload === 'string') {
    let sanitized = payload;
    
    // Remove script tags
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized;
  }
  
  // Handle arrays - recursively sanitize each element
  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }
  
  // Handle objects - recursively sanitize each property
  if (typeof payload === 'object') {
    const sanitized = {};
    for (const key of Object.keys(payload)) {
      sanitized[key] = sanitizePayload(payload[key]);
    }
    return sanitized;
  }
  
  // Handle primitives (number, boolean) - pass through
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }
  
  // Unknown type - return null for safety
  return null;
}

/**
 * Validate that a message has required structure
 * @param {any} message - Message to validate
 * @returns {boolean} True if valid message structure
 */
export function isValidMessage(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }
  
  // Must have type field
  if (!message.type || typeof message.type !== 'string') {
    return false;
  }
  
  // Type must be a valid MessageType
  if (!Object.values(MessageType).includes(message.type)) {
    return false;
  }
  
  // Must have timestamp
  if (!message.timestamp || typeof message.timestamp !== 'number') {
    return false;
  }
  
  return true;
}


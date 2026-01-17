/**
 * TruthSeek Sentence Highlighter
 * Manages real-time highlighting of sentences containing facts
 */

import { MessageType } from '../shared/message-types.js';
import { createMessage } from '../shared/message-utils.js';

/**
 * Highlight state for each sentence
 * @typedef {Object} HighlightState
 * @property {string} sentenceId - Sentence identifier
 * @property {string} status - 'processing' | 'true' | 'false' | 'unverified'
 * @property {Element} element - DOM element containing the highlight
 */

// Track all active highlights
const activeHighlights = new Map();

/**
 * Initialize highlighter
 */
export function initializeHighlighter() {
  console.log('TruthSeek highlighter initialized');
  
  // Add click handler for highlights
  document.addEventListener('click', handleHighlightClick, true);
}

/**
 * Highlight a sentence by its XPath
 * @param {string} sentenceId - Sentence ID
 * @param {string} xpath - XPath to the text node
 * @param {string} status - Highlight status ('processing', 'true', 'false', 'unverified')
 */
export function highlightSentence(sentenceId, xpath, status = 'processing', text = null) {
  try {
    console.log(`[HIGHLIGHTER] Highlighting sentence ${sentenceId}:`, {
      xpath,
      status,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 100) || 'NO TEXT'
    });
    
    // Remove existing highlight if any
    removeHighlight(sentenceId);
    
    // Validate we have text to search for
    if (!text || text.trim().length === 0) {
      console.warn(`[HIGHLIGHTER] No text provided for ${sentenceId}, cannot highlight`);
      return;
    }
    
    // Find the parent element using XPath
    let parentElement = findNodeByXPath(xpath);
    
    // If XPath fails, try to find by text content
    if (!parentElement) {
      console.log(`[HIGHLIGHTER] XPath failed for ${sentenceId}, trying text search...`);
      parentElement = findElementByText(text);
    }
    
    if (!parentElement) {
      console.warn(`[HIGHLIGHTER] Could not find parent element for ${sentenceId}`);
      return;
    }
    
    // Ensure we have an element node
    if (parentElement.nodeType !== Node.ELEMENT_NODE) {
      parentElement = parentElement.parentElement;
    }
    
    if (!parentElement) {
      console.warn(`[HIGHLIGHTER] No valid parent element for ${sentenceId}`);
      return;
    }
    
    console.log(`[HIGHLIGHTER] Found parent element: <${parentElement.tagName.toLowerCase()}>`);
    
    // Create highlight wrapper
    const highlight = createHighlightElement(sentenceId, status);
    
    // Try to wrap the sentence within the parent element
    const success = wrapSentenceInElement(parentElement, text, highlight);
    
    if (success) {
      // Store in active highlights
      activeHighlights.set(sentenceId, {
        sentenceId,
        status,
        element: highlight,
        xpath
      });
      
      console.log(`[HIGHLIGHTER] ✓ Successfully highlighted sentence ${sentenceId} with status: ${status}`);
    } else {
      console.warn(`[HIGHLIGHTER] Failed to wrap sentence ${sentenceId}`);
    }
    
  } catch (error) {
    console.error(`[HIGHLIGHTER] Error highlighting sentence ${sentenceId}:`, error);
  }
}

/**
 * Update highlight color for a sentence
 * @param {string} sentenceId - Sentence ID
 * @param {string} status - New status
 */
export function updateHighlight(sentenceId, status) {
  const highlight = activeHighlights.get(sentenceId);
  
  if (!highlight) {
    console.warn(`No highlight found for sentence: ${sentenceId}`);
    return false;
  }
  
  // Remove old status class
  highlight.element.classList.remove('processing', 'true', 'false', 'unverified');
  
  // Add new status class
  highlight.element.classList.add(status);
  highlight.element.setAttribute('data-truthseek-status', status);
  
  // Update stored status
  highlight.status = status;
  
  console.log(`Updated highlight ${sentenceId} to status: ${status}`);
  return true;
}

/**
 * Remove highlight from a sentence
 * @param {string} sentenceId - Sentence ID
 */
export function removeHighlight(sentenceId) {
  const highlight = activeHighlights.get(sentenceId);
  
  if (!highlight) {
    return;
  }
  
  try {
    // Unwrap the text node
    const parent = highlight.element.parentNode;
    if (parent) {
      // Move all child nodes out of the highlight wrapper
      while (highlight.element.firstChild) {
        parent.insertBefore(highlight.element.firstChild, highlight.element);
      }
      // Remove the empty wrapper
      parent.removeChild(highlight.element);
      
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }
    
    activeHighlights.delete(sentenceId);
    
  } catch (error) {
    console.error(`Error removing highlight ${sentenceId}:`, error);
  }
}

/**
 * Remove all highlights
 */
export function clearAllHighlights() {
  const sentenceIds = Array.from(activeHighlights.keys());
  
  for (const sentenceId of sentenceIds) {
    removeHighlight(sentenceId);
  }
  
  console.log('Cleared all highlights');
}

/**
 * Create a highlight element
 * @param {string} sentenceId - Sentence ID
 * @param {string} status - Highlight status
 * @returns {HTMLSpanElement}
 * @private
 */
function createHighlightElement(sentenceId, status) {
  const span = document.createElement('span');
  span.className = `truthseek-highlight ${status}`;
  span.setAttribute('data-truthseek-id', sentenceId);
  span.setAttribute('data-truthseek-status', status);
  return span;
}

/**
 * Find an element by searching for text content
 * @param {string} text - Text to search for
 * @returns {Element|null}
 * @private
 */
function findElementByText(text) {
  const normalizedSearch = text.trim().replace(/\s+/g, ' ').toLowerCase();
  const minMatchLength = Math.min(50, Math.floor(normalizedSearch.length * 0.5));
  
  // Search in content container elements
  const containers = document.querySelectorAll('p, div, article, section, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, dd, dt');
  
  for (const element of containers) {
    const elementText = element.textContent?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
    if (elementText.includes(normalizedSearch) || 
        (normalizedSearch.includes(elementText) && elementText.length > minMatchLength)) {
      return element;
    }
  }
  
  return null;
}

/**
 * Wrap a sentence within a parent element (handles multi-node sentences with HTML elements)
 * @param {Element} parentElement - Parent container element
 * @param {string} sentenceText - Full sentence text to highlight
 * @param {HTMLElement} wrapper - Wrapper element
 * @returns {boolean} True if successfully wrapped
 * @private
 */
function wrapSentenceInElement(parentElement, sentenceText, wrapper) {
  try {
    console.log(`[HIGHLIGHTER] Wrapping sentence in <${parentElement.tagName.toLowerCase()}>`);
    
    // Get the complete text content of the parent
    const parentText = parentElement.textContent || '';
    const normalizedParentText = parentText.replace(/\s+/g, ' ').toLowerCase();
    const normalizedSentence = sentenceText.trim().replace(/\s+/g, ' ').toLowerCase();
    
    console.log(`[HIGHLIGHTER] Parent text length: ${parentText.length}, sentence length: ${sentenceText.length}`);
    
    // Check if parent contains the sentence
    if (!normalizedParentText.includes(normalizedSentence)) {
      console.warn(`[HIGHLIGHTER] Sentence not found in parent element`);
      return false;
    }
    
    // Find the sentence position in the parent's text content
    const sentenceStart = normalizedParentText.indexOf(normalizedSentence);
    const sentenceEnd = sentenceStart + normalizedSentence.length;
    
    console.log(`[HIGHLIGHTER] Sentence position in parent: ${sentenceStart} to ${sentenceEnd}`);
    
    // Find all text nodes in the parent element
    const walker = document.createTreeWalker(
      parentElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }
    
    console.log(`[HIGHLIGHTER] Found ${textNodes.length} text nodes in parent`);
    
    if (textNodes.length === 0) {
      return false;
    }
    
    // Build a map of character positions to text nodes
    let charPos = 0;
    const nodePositions = [];
    
    for (const textNode of textNodes) {
      const nodeText = textNode.textContent;
      const startPos = charPos;
      const endPos = charPos + nodeText.length;
      nodePositions.push({ 
        node: textNode, 
        start: startPos, 
        end: endPos,
        text: nodeText
      });
      charPos = endPos;
    }
    
    // Map normalized positions back to actual positions
    // We need to account for whitespace normalization
    let actualStart = -1;
    let actualEnd = -1;
    let normalizedPos = 0;
    
    for (let i = 0; i < parentText.length; i++) {
      const char = parentText[i];
      const prevChar = i > 0 ? parentText[i - 1] : '';
      const isWhitespace = /\s/.test(char);
      const prevIsWhitespace = i > 0 && /\s/.test(prevChar);
      
      // Skip collapsed whitespace in normalized text
      if (isWhitespace && prevIsWhitespace) {
        continue;
      }
      
      if (normalizedPos === sentenceStart && actualStart === -1) {
        actualStart = i;
      }
      
      if (normalizedPos === sentenceEnd - 1) {
        actualEnd = i + 1;
        break;
      }
      
      normalizedPos++;
    }
    
    if (actualStart === -1 || actualEnd === -1) {
      console.warn(`[HIGHLIGHTER] Could not map sentence positions: start=${actualStart}, end=${actualEnd}`);
      return false;
    }
    
    console.log(`[HIGHLIGHTER] Mapped to actual positions: ${actualStart} to ${actualEnd}`);
    
    // Find the text nodes that contain the sentence
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    for (const { node: textNode, start, end } of nodePositions) {
      if (startNode === null && actualStart >= start && actualStart < end) {
        startNode = textNode;
        startOffset = actualStart - start;
      }
      if (actualEnd > start && actualEnd <= end) {
        endNode = textNode;
        endOffset = actualEnd - start;
        break;
      }
    }
    
    if (!startNode || !endNode) {
      console.warn(`[HIGHLIGHTER] Could not find start/end nodes: start=${!!startNode}, end=${!!endNode}`);
      return false;
    }
    
    console.log(`[HIGHLIGHTER] Creating range from offset ${startOffset} to ${endOffset}`);
    
    // Create a Range to select the sentence
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    
    // Try to wrap the range
    try {
      range.surroundContents(wrapper);
      console.log(`[HIGHLIGHTER] Successfully wrapped using surroundContents`);
      return true;
    } catch (error) {
      // surroundContents fails if range spans element boundaries
      console.log(`[HIGHLIGHTER] surroundContents failed, trying manual wrap...`);
      return wrapRangeManually(range, wrapper);
    }
    
  } catch (error) {
    console.error(`[HIGHLIGHTER] Error wrapping sentence:`, error);
    return false;
  }
}

/**
 * Manually wrap a range that spans multiple nodes (including element nodes)
 * Uses extractContents to move nodes (preserves event handlers and structure)
 * @param {Range} range - Range to wrap
 * @param {HTMLElement} wrapper - Wrapper element
 * @returns {boolean} True if successful
 * @private
 */
function wrapRangeManually(range, wrapper) {
  try {
    // Extract contents (moves nodes from DOM, preserving structure)
    const contents = range.extractContents();
    
    // Insert wrapper at the original start position
    // The range is now collapsed at the start after extractContents
    range.insertNode(wrapper);
    
    // Move extracted contents into wrapper
    // This preserves all element structure (links, etc.) and event handlers
    wrapper.appendChild(contents);
    
    return true;
  } catch (error) {
    console.warn(`[HIGHLIGHTER] Error manually wrapping range:`, error);
    return false;
  }
}

/**
 * Find a DOM node by XPath
 * @param {string} xpath - XPath expression
 * @returns {Node|null}
 * @private
 */
function findNodeByXPath(xpath) {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    
    return result.singleNodeValue;
    
  } catch (error) {
    console.error('XPath evaluation error:', error);
    return null;
  }
}

/**
 * Handle click on highlighted sentence
 * @param {MouseEvent} event - Click event
 * @private
 */
function handleHighlightClick(event) {
  // Find if click was on a highlight
  const target = event.target instanceof Element ? event.target : null;
  const highlight = target ? target.closest('.truthseek-highlight') : null;
  
  if (!highlight) {
    return;
  }
  
  const sentenceId = highlight.getAttribute('data-truthseek-id');
  const status = highlight.getAttribute('data-truthseek-status');
  
  if (!sentenceId) {
    console.warn('[HIGHLIGHTER] Highlight clicked but no sentenceId found');
    return;
  }
  
  console.log(`[HIGHLIGHTER] Clicked highlight: sentenceId="${sentenceId}", status="${status}"`);
  
  // Get sentence text
  const sentenceText = highlight.textContent || '';
  console.log(`[HIGHLIGHTER] Sentence text (first 50 chars):`, sentenceText.substring(0, 50));
  
  // Request fact details from background script
  const message = createMessage(MessageType.GET_FACT_DETAILS, { sentenceId });
  console.log(`[HIGHLIGHTER] Sending GET_FACT_DETAILS message:`, message);
  
  chrome.runtime.sendMessage(message).then(response => {
    console.log(`[HIGHLIGHTER] Received response for sentence ${sentenceId}:`, response);
    
    // Extract facts from wrapped response structure
    // Response format: { success: true, data: { facts: [...] } } or { error: "..." }
    let facts = [];
    
    if (response) {
      if (response.error) {
        console.error(`[HIGHLIGHTER] Error getting fact details:`, response.error);
      } else if (response.success && response.data && response.data.facts) {
        facts = response.data.facts;
        console.log(`[HIGHLIGHTER] Found ${facts.length} facts for sentence ${sentenceId}`);
      } else if (response.facts) {
        // Fallback for direct response (shouldn't happen but handle gracefully)
        facts = response.facts;
        console.log(`[HIGHLIGHTER] Found ${facts.length} facts (direct response)`);
      } else {
        console.warn(`[HIGHLIGHTER] Unexpected response structure:`, response);
      }
    }
    
    // Import and open modal with facts
    import('./modal.js').then(({ openModalForSentence }) => {
      openModalForSentence(sentenceId, sentenceText, facts);
    });
  }).catch(error => {
    console.error('[HIGHLIGHTER] Error getting fact details:', error);
    // Still open modal to show error state
    import('./modal.js').then(({ openModalForSentence }) => {
      openModalForSentence(sentenceId, sentenceText, []);
    });
  });
  
  // Prevent default link behavior if clicking on a link
  if (event.target.tagName === 'A') {
    event.preventDefault();
    event.stopPropagation();
  }
}


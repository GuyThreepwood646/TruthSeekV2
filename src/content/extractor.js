/**
 * TruthSeek HTML Content Extractor
 * Extracts meaningful text content from web pages while preserving structure for DOM tracking
 */

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB
const EXCLUDED_TAGS = ['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'ASIDE', 'HEADER', 'NOSCRIPT', 'IFRAME', 'FORM'];
const CONTENT_CONTAINER_TAGS = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION'];

/**
 * Extract page content with sentence tracking
 * @returns {Promise<ExtractedContent>}
 */
export async function extractPageContent() {
  try {
    // Wait for document to be fully loaded
    if (document.readyState !== 'complete') {
      await new Promise(resolve => window.addEventListener('load', resolve));
    }
    
    // Additional delay for dynamic content (SPAs, lazy loading)
    await sleep(2000);
    
    const sentences = [];
    let totalCharacters = 0;
    let truncated = false;
    const processedElements = new Set(); // Track processed elements to avoid duplicates
    
    console.log('[EXTRACTOR] Starting parent-element-based extraction...');
    
    // Find all content container elements
    const contentElements = document.body.querySelectorAll(CONTENT_CONTAINER_TAGS.join(','));
    
    console.log(`[EXTRACTOR] Found ${contentElements.length} content elements to process`);
    
    for (const element of contentElements) {
      if (truncated) break;
      
      // Skip if already processed or excluded
      if (processedElements.has(element) || shouldExcludeElement(element)) {
        continue;
      }
      
      // Skip if element is a parent of an already processed element
      // (we want leaf content elements, not their parents)
      let hasProcessedChild = false;
      for (const processed of processedElements) {
        if (element.contains(processed)) {
          hasProcessedChild = true;
          break;
        }
      }
      
      if (hasProcessedChild) {
        continue;
      }
      
      // Get the complete text content (including text from child elements)
      const fullText = element.textContent?.trim() || '';
      
      if (fullText.length === 0) {
        continue;
      }
      
      // Split the full text into sentences
      const elementSentences = splitIntoSentences(fullText);
      
      if (elementSentences.length === 0) {
        continue;
      }
      
      // Generate XPath for the container element (not individual text nodes)
      const elementXPath = getXPath(element);
      
      // Create sentence objects
      for (const sentenceText of elementSentences) {
        // Check size limit
        if (totalCharacters + sentenceText.length > MAX_CONTENT_SIZE) {
          truncated = true;
          console.warn('[EXTRACTOR] Content truncated at 100KB limit');
          break;
        }
        
        const sanitized = sanitizeText(sentenceText);
        
        if (sanitized.length < 10) {
          continue; // Skip very short sentences
        }
        
        // Create sentence object with parent element context
        const sentence = {
          id: `s-${sentences.length.toString().padStart(4, '0')}`,
          text: sanitized,
          xpath: elementXPath, // XPath to parent element
          elementTag: element.tagName.toLowerCase()
        };
        
        sentences.push(sentence);
        totalCharacters += sanitized.length;
      }
      
      // Mark element as processed
      processedElements.add(element);
    }
    
    console.log(`[EXTRACTOR] Extracted ${sentences.length} sentences from ${processedElements.size} elements (${totalCharacters} characters)`);
    
    // Limit to first 20 sentences as before
    const limitedSentences = sentences.slice(0, 20);
    if (sentences.length > 20) {
      console.log(`[EXTRACTOR] Limited to first 20 sentences to prevent AI response truncation`);
    }
    
    return {
      sentences: limitedSentences,
      truncated: truncated || sentences.length > 20,
      totalCharacters
    };
    
  } catch (error) {
    console.error('[EXTRACTOR] Error extracting page content:', error);
    throw error;
  }
}

/**
 * Check if element should be excluded from extraction
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function shouldExcludeElement(element) {
  // Check if element itself is excluded
  if (EXCLUDED_TAGS.includes(element.tagName)) {
    return true;
  }
  
  // Check if element is hidden
  if (element.getAttribute('aria-hidden') === 'true') {
    return true;
  }
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }
  
  // Check if any parent is excluded
  let parent = element.parentElement;
  while (parent) {
    if (EXCLUDED_TAGS.includes(parent.tagName)) {
      return true;
    }
    
    if (parent.getAttribute('aria-hidden') === 'true') {
      return true;
    }
    
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return true;
    }
    
    parent = parent.parentElement;
  }
  
  return false;
}

/**
 * Split text into sentences
 * @param {string} text - Text block
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  // Use Intl.Segmenter if available (modern browsers)
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      const segments = Array.from(segmenter.segment(text));
      return segments
        .map(s => s.segment.trim())
        .filter(s => s.length > 10); // Minimum sentence length
    } catch (e) {
      // Fall through to regex method
    }
  }
  
  // Fallback: regex-based splitting
  // Handle common abbreviations to avoid false splits
  let normalized = text
    .replace(/Mr\./g, 'Mr')
    .replace(/Mrs\./g, 'Mrs')
    .replace(/Ms\./g, 'Ms')
    .replace(/Dr\./g, 'Dr')
    .replace(/Prof\./g, 'Prof')
    .replace(/vs\./g, 'vs')
    .replace(/etc\./g, 'etc')
    .replace(/e\.g\./g, 'eg')
    .replace(/i\.e\./g, 'ie')
    .replace(/Inc\./g, 'Inc')
    .replace(/Ltd\./g, 'Ltd')
    .replace(/Co\./g, 'Co');
  
  // Split on sentence boundaries
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 10); // Minimum sentence length
}

/**
 * Generate XPath for a node (element or text node)
 * @param {Node} node - DOM node
 * @returns {string}
 */
export function getXPath(node) {
  const parts = [];
  let current = node;
  
  while (current && current.nodeType !== Node.DOCUMENT_NODE) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tagName = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentNode?.children || [])
        .filter(el => el.tagName === current.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tagName}[${index}]`);
      } else {
        parts.unshift(tagName);
      }
      
      current = current.parentNode;
    } else if (current.nodeType === Node.TEXT_NODE) {
      const textNodes = Array.from(current.parentNode?.childNodes || [])
        .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
      
      if (textNodes.length > 1) {
        const index = textNodes.indexOf(current) + 1;
        parts.unshift(`text()[${index}]`);
      } else {
        parts.unshift('text()');
      }
      
      current = current.parentNode;
    } else {
      // Skip other node types
      current = current.parentNode;
    }
  }
  
  return '//' + parts.join('/');
}

/**
 * Sanitize text content
 * @param {string} text - Raw text
 * @returns {string}
 */
function sanitizeText(text) {
  return text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * TruthSeek URL Validator
 * Validates that source URLs are real, accessible, and contain relevant content
 * Prevents hallucinated, broken, or irrelevant links
 */

import { resolveGoogleGroundingUrl, isGoogleGroundingRedirect } from '../utils/url-resolver.js';

// Soft 404 indicators
const SOFT_404_PATTERNS = [
  /page\s+not\s+found/i,
  /404/i,
  /not\s+found/i,
  /this\s+page\s+(doesn't|does\s+not)\s+exist/i,
  /no\s+results\s+found/i,
  /content\s+(unavailable|not\s+available)/i,
  /page\s+(unavailable|not\s+available)/i,
  /error\s+404/i,
  /file\s+not\s+found/i,
  /the\s+page\s+you\s+(requested|are\s+looking\s+for)/i
];

// Maximum redirects allowed
const MAX_REDIRECTS = 3;

// Request timeout
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Validate a URL
 * @param {string} url - URL to validate
 * @param {string} factText - Fact text for relevance checking
 * @returns {Promise<{valid: boolean, url: string, reason?: string}>}
 */
export async function validateUrl(url, factText) {
  try {
    // Resolve Google Grounding redirect URLs first
    let resolvedUrl = url;
    if (isGoogleGroundingRedirect(url)) {
      console.log(`[URL_VALIDATOR] Resolving Google Grounding redirect: ${url.substring(0, 80)}...`);
      resolvedUrl = await resolveGoogleGroundingUrl(url);
      if (resolvedUrl !== url) {
        console.log(`[URL_VALIDATOR] Resolved to: ${resolvedUrl}`);
      }
    }
    
    // Basic URL format validation
    let parsedUrl;
    try {
      parsedUrl = new URL(resolvedUrl);
    } catch (error) {
      return {
        valid: false,
        url: resolvedUrl,
        reason: 'Invalid URL format'
      };
    }
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        url: resolvedUrl,
        reason: 'Only HTTP/HTTPS URLs allowed'
      };
    }
    
    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    let response;
    try {
      response = await fetch(resolvedUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'TruthSeek/1.0 (Fact Verification Bot)'
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return {
          valid: false,
          url: resolvedUrl,
          reason: 'Request timeout'
        };
      }
      
      return {
        valid: false,
        url: resolvedUrl,
        reason: `Network error: ${error.message}`
      };
    }
    
    clearTimeout(timeoutId);
    
    // Check HTTP status
    if (!response.ok) {
      return {
        valid: false,
        url: resolvedUrl,
        reason: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    // Check for excessive redirects
    // Note: fetch API doesn't expose redirect count directly
    // This is a simplified check
    const finalUrl = response.url;
    if (finalUrl !== resolvedUrl) {
      // URL was redirected
      const redirectCount = countRedirects(resolvedUrl, finalUrl);
      if (redirectCount > MAX_REDIRECTS) {
        return {
          valid: false,
          url: finalUrl,
          reason: `Too many redirects (>${MAX_REDIRECTS})`
        };
      }
    }
    
    // Fetch page content
    const contentType = response.headers.get('content-type') || '';
    
    // Only validate HTML pages
    if (!contentType.includes('text/html')) {
      // Non-HTML content (PDF, images, etc.) - accept but note
      return {
        valid: true,
        url: finalUrl,
        reason: 'Non-HTML content'
      };
    }
    
    // Get page text
    const html = await response.text();
    
    // Check for soft 404
    if (isSoft404(html)) {
      return {
        valid: false,
        url: finalUrl,
        reason: 'Soft 404 detected'
      };
    }
    
    // Check content relevance
    if (!isContentRelevant(html, factText)) {
      return {
        valid: false,
        url: finalUrl,
        reason: 'Content not relevant to fact'
      };
    }
    
    // All checks passed
    return {
      valid: true,
      url: finalUrl
    };
    
  } catch (error) {
    console.error('URL validation error:', error);
    return {
      valid: false,
      url: url,
      reason: `Validation error: ${error.message}`
    };
  }
}

/**
 * Check if page content indicates a soft 404
 * @param {string} html - Page HTML
 * @returns {boolean} True if soft 404 detected
 * @private
 */
function isSoft404(html) {
  // Convert to lowercase for case-insensitive matching
  const lowerHtml = html.toLowerCase();
  
  // Only check first 5000 chars for performance
  const checkText = lowerHtml.substring(0, 5000);
  
  for (const pattern of SOFT_404_PATTERNS) {
    if (pattern.test(checkText)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if page content is relevant to the fact
 * @param {string} html - Page HTML
 * @param {string} factText - Fact text
 * @returns {boolean} True if relevant
 * @private
 */
function isContentRelevant(html, factText) {
  if (!factText || factText.length < 10) {
    // Can't determine relevance without fact text
    return true;
  }
  
  // Extract text from HTML (simple approach)
  const text = extractText(html);
  const lowerText = text.toLowerCase();
  const lowerFact = factText.toLowerCase();
  
  // Extract key terms from fact (words longer than 3 chars)
  const keyTerms = lowerFact
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !/^(the|and|for|with|this|that|from|have|been|were|was|are)$/.test(word));
  
  if (keyTerms.length === 0) {
    return true; // Can't determine relevance
  }
  
  // Check how many key terms appear in content
  const matchCount = keyTerms.filter(term => lowerText.includes(term)).length;
  const matchRatio = matchCount / keyTerms.length;
  
  // Require at least 30% of key terms to be present
  return matchRatio >= 0.3;
}

/**
 * Extract text from HTML
 * @param {string} html - HTML content
 * @returns {string} Extracted text
 * @private
 */
function extractText(html) {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities (basic)
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Estimate redirect count (simplified)
 * @param {string} originalUrl - Original URL
 * @param {string} finalUrl - Final URL after redirects
 * @returns {number} Estimated redirect count
 * @private
 */
function countRedirects(originalUrl, finalUrl) {
  // This is a simplified estimation
  // In reality, we'd need to track each redirect
  if (originalUrl === finalUrl) {
    return 0;
  }
  
  // Assume 1 redirect if URLs differ
  return 1;
}

/**
 * Validate multiple URLs in batch
 * @param {Array<{url: string, factText: string}>} urlsToValidate - URLs to validate
 * @returns {Promise<Array<{url: string, valid: boolean, reason?: string}>>}
 */
export async function validateUrls(urlsToValidate) {
  const promises = urlsToValidate.map(({ url, factText }) => 
    validateUrl(url, factText)
  );
  
  return await Promise.all(promises);
}

/**
 * Filter sources to only valid URLs
 * @param {Source[]} sources - Sources with URLs
 * @param {string} factText - Fact text for relevance
 * @returns {Promise<Source[]>} Validated sources
 */
export async function filterValidSources(sources, factText) {
  if (!sources || sources.length === 0) {
    return [];
  }
  
  const validatedSources = [];
  
  for (const source of sources) {
    const validation = await validateUrl(source.url, factText);
    
    if (validation.valid) {
      validatedSources.push({
        ...source,
        url: validation.url, // Use final URL after redirects
        validated: true,
        validatedAt: Date.now()
      });
    } else {
      console.log(`Rejected URL ${source.url}: ${validation.reason}`);
    }
  }
  
  return validatedSources;
}


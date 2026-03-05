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
 * @param {string|null} factId - Optional fact ID for logging
 * @param {object|null} source - Optional source metadata (tier, domain)
 * @returns {Promise<{valid: boolean, url: string, reason?: string, readabilityHint?: string}>}
 */
export async function validateUrl(url, factText, factId = null, source = null) {
  try {
    const factSuffix = factId ? ` (${factId})` : '';
    
    // Resolve Google Grounding redirect URLs first
    let resolvedUrl = url;
    if (isGoogleGroundingRedirect(url)) {
      console.log(`[URL_VALIDATOR] Resolving Google Grounding redirect${factSuffix}: ${url.substring(0, 80)}...`);
      resolvedUrl = await resolveGoogleGroundingUrl(url, { factId });
      if (resolvedUrl !== url) {
        console.log(`[URL_VALIDATOR] Resolved${factSuffix} to: ${resolvedUrl}`);
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
    
    // Reject generic search result pages
    if (isSearchResultUrl(resolvedUrl)) {
      return {
        valid: false,
        url: resolvedUrl,
        reason: 'Search results pages are not valid evidence'
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
      const nonHtmlDecision = evaluateNonHtmlAcceptance(finalUrl, factText, source);
      if (!nonHtmlDecision.valid) {
        return {
          valid: false,
          url: finalUrl,
          reason: nonHtmlDecision.reason
        };
      }
      return {
        valid: true,
        url: finalUrl,
        reason: nonHtmlDecision.reason
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
    
    // Check content relevance with readability gating
    const relevance = evaluateHtmlRelevance(html, finalUrl, factText, source);
    if (!relevance.valid) {
      return {
        valid: false,
        url: finalUrl,
        reason: relevance.reason
      };
    }
    
    // All checks passed
    return {
      valid: true,
      url: finalUrl,
      ...(relevance.readabilityHint ? { readabilityHint: relevance.readabilityHint } : {})
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
 * Detect if URL is a generic search results page
 * @param {string} url - URL to check
 * @returns {boolean}
 * @private
 */
function isSearchResultUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.includes('google.') && path.startsWith('/search')) return true;
    if (host.includes('bing.com') && path.startsWith('/search')) return true;
    if (host.includes('search.yahoo.com') && path.startsWith('/search')) return true;
    if (host.includes('duckduckgo.com') && path.startsWith('/')) {
      return parsed.searchParams.has('q');
    }
    return false;
  } catch (error) {
    return false;
  }
}

function evaluateNonHtmlAcceptance(url, factText, source) {
  const tier = Number.isFinite(source?.tier) ? source.tier : null;
  const strongKeywords = getStrongKeywords(factText);
  const pathMatchCount = countKeywordMatchesInUrl(url, strongKeywords);
  const hasStrongPathMatch = pathMatchCount >= 1;
  
  // Require higher-tier domains or strong path matches for non-HTML content
  if (tier !== null && tier <= 2 && hasStrongPathMatch) {
    return { valid: true, reason: 'Non-HTML content (high-tier domain)' };
  }
  
  if (tier !== null && tier <= 2 && strongKeywords.length > 0 && pathMatchCount >= 1) {
    return { valid: true, reason: 'Non-HTML content (keyword match)' };
  }
  
  if (tier !== null && tier <= 3 && hasStrongPathMatch) {
    return { valid: true, reason: 'Non-HTML content (reputable domain)' };
  }
  
  return {
    valid: false,
    reason: 'Non-HTML content without strong relevance signals'
  };
}

function evaluateHtmlRelevance(html, url, factText, source) {
  const tier = Number.isFinite(source?.tier) ? source.tier : null;
  const { title, ogTitle, h1 } = extractTitles(html);
  const titleCandidate = (title || ogTitle || h1 || '').trim();
  const text = extractText(html);
  const wordCount = countWords(text);
  
  if (hasAccessGates(titleCandidate, text)) {
    return {
      valid: false,
      reason: 'Access gate or login required'
    };
  }
  
  const strongKeywords = getStrongKeywords(factText);
  const matchCount = countKeywordMatches(text, strongKeywords);
  const yearMatch = hasYearMatch(factText, text);
  const urlPathMatches = countKeywordMatchesInUrl(url, strongKeywords);
  
  // For thin/JS-rendered pages, rely on title and URL path signals
  if (wordCount < 120) {
    if (tier !== null && tier <= 2 && titleCandidate.length >= 10 && urlPathMatches >= 1) {
      return {
        valid: true,
        reason: 'Thin HTML content with strong signals',
        readabilityHint: 'needs-user-open'
      };
    }
    return {
      valid: false,
      reason: 'Content too thin to verify relevance'
    };
  }
  
  if (titleCandidate.length < 6) {
    return {
      valid: false,
      reason: 'Missing readable title'
    };
  }
  
  if (matchCount >= 2) {
    return { valid: true };
  }
  
  if (matchCount >= 1 && yearMatch) {
    return { valid: true };
  }
  
  if (tier !== null && tier <= 2 && urlPathMatches >= 2) {
    return { valid: true };
  }
  
  return {
    valid: false,
    reason: 'Content not relevant to fact'
  };
}

function extractTitles(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  
  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    ogTitle: ogTitleMatch ? ogTitleMatch[1].trim() : '',
    h1: h1Match ? h1Match[1].trim() : ''
  };
}

function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function hasAccessGates(titleText, bodyText) {
  const combined = `${titleText}\n${bodyText}`.toLowerCase();
  const gates = [
    'sign in',
    'log in',
    'subscribe',
    'subscription',
    'access denied',
    'enable cookies',
    'please enable javascript',
    'verify you are human',
    'captcha',
    'paywall'
  ];
  return gates.some(gate => combined.includes(gate));
}

function getStrongKeywords(factText) {
  if (!factText || typeof factText !== 'string') {
    return [];
  }
  const stopwords = new Set([
    'the','and','for','with','this','that','from','have','been','were','was','are',
    'about','into','onto','over','under','between','after','before','during','than',
    'then','they','them','their','there','what','when','where','which','while','who',
    'whom','why','will','would','could','should','may','might','can','cannot','not',
    'but','also','such','some','more','most','other','its','it','is','as','of','to',
    'in','on','by','at','an','a'
  ]);
  return factText
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 4)
    .filter(token => !stopwords.has(token.toLowerCase()));
}

function countKeywordMatches(text, keywords) {
  if (!text || !keywords || keywords.length === 0) {
    return 0;
  }
  const lowered = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    return count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
}

function hasYearMatch(factText, contentText) {
  const factYears = (factText.match(/\b(19|20)\d{2}\b/g) || []);
  if (factYears.length === 0) {
    return false;
  }
  return factYears.some(year => contentText.includes(year));
}

function countKeywordMatchesInUrl(url, keywords) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname + parsed.search).toLowerCase();
    return keywords.reduce((count, keyword) => {
      return count + (path.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);
  } catch (error) {
    return 0;
  }
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
  const promises = urlsToValidate.map((item) => {
    if (!item) {
      return validateUrl('', '', null, null);
    }
    return validateUrl(item.url, item.factText, item.factId || null, item.source || null);
  });
  
  return await Promise.all(promises);
}

/**
 * Filter sources to only valid URLs
 * @param {Source[]} sources - Sources with URLs
 * @param {string} factText - Fact text for relevance
 * @param {string|null} factId - Optional fact ID for logging
 * @returns {Promise<Source[]>} Validated sources
 */
export async function filterValidSources(sources, factText, factId = null) {
  if (!sources || sources.length === 0) {
    return [];
  }
  
  const validatedSources = [];
  
  for (const source of sources) {
    const validation = await validateUrl(source.url, factText, factId, source);
    
    if (validation.valid) {
      validatedSources.push({
        ...source,
        url: validation.url, // Use final URL after redirects
        validated: true,
        validatedAt: Date.now(),
        ...(validation.readabilityHint ? { readabilityHint: validation.readabilityHint } : {})
      });
    } else {
      const factSuffix = factId ? ` (${factId})` : '';
      console.log(`Rejected URL${factSuffix} ${source.url}: ${validation.reason}`);
    }
  }
  
  return validatedSources;
}


/**
 * TruthSeek Grounding Validator
 * Ensures AI responses are grounded in provided sources
 */

/**
 * Validate that AI response is grounded in provided sources
 * @param {Object} response - AI verification response
 * @param {string[]} providedUrls - URLs that were provided to AI
 * @returns {{valid: boolean, issues: string[]}} Validation result
 */
export function validateGrounding(response, providedUrls) {
  const issues = [];
  
  // Extract cited URLs from response
  const citedUrls = extractCitedUrls(response);
  
  // Check each cited URL was in provided set
  for (const url of citedUrls) {
    // Normalize URLs for comparison (remove trailing slashes, fragments)
    const normalizedCited = normalizeUrl(url);
    const isProvided = providedUrls.some(providedUrl => 
      normalizeUrl(providedUrl) === normalizedCited
    );
    
    if (!isProvided) {
      issues.push(`Cited URL not in search results: ${url}`);
    }
  }
  
  // Check reasoning references sources
  if (response.reasoning && !referencesSource(response.reasoning)) {
    issues.push('Reasoning does not reference any sources');
  }
  
  // Check for training data leakage indicators
  if (response.reasoning) {
    const leakageIndicators = detectTrainingDataLeakage(response.reasoning);
    if (leakageIndicators.length > 0) {
      issues.push(...leakageIndicators);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues: issues
  };
}

/**
 * Extract cited URLs from AI response
 * @param {Object} response - AI response object
 * @returns {string[]} Array of cited URLs
 */
function extractCitedUrls(response) {
  const urls = [];
  
  // Extract from citedSources field
  if (response.citedSources && Array.isArray(response.citedSources)) {
    for (const source of response.citedSources) {
      if (source.url) {
        urls.push(source.url);
      }
    }
  }
  
  // Extract from sources field (alternative structure)
  if (response.sources && Array.isArray(response.sources)) {
    for (const source of response.sources) {
      if (source.url) {
        urls.push(source.url);
      }
    }
  }
  
  // Also extract URLs from reasoning text
  if (response.reasoning && typeof response.reasoning === 'string') {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const matches = response.reasoning.match(urlPattern) || [];
    urls.push(...matches);
  }
  
  // Return unique URLs
  return [...new Set(urls)];
}

/**
 * Normalize URL for comparison
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, fragment, and common tracking params
    let normalized = parsed.origin + parsed.pathname;
    normalized = normalized.replace(/\/$/, ''); // Remove trailing slash
    return normalized.toLowerCase();
  } catch (error) {
    // If URL parsing fails, return lowercase original
    return url.toLowerCase();
  }
}

/**
 * Check if reasoning text references sources
 * @param {string} reasoning - Reasoning text
 * @returns {boolean} True if sources are referenced
 */
function referencesSource(reasoning) {
  const sourceIndicators = [
    'according to',
    'source',
    'states that',
    'reports',
    'found that',
    'indicates',
    'confirms',
    'shows',
    'cites',
    'references',
    'based on',
    'from',
    'per',
    'as reported'
  ];
  
  const lowered = reasoning.toLowerCase();
  return sourceIndicators.some(ind => lowered.includes(ind));
}

/**
 * Detect potential training data leakage in reasoning
 * @param {string} reasoning - Reasoning text
 * @returns {string[]} Array of leakage indicators found
 */
function detectTrainingDataLeakage(reasoning) {
  const indicators = [];
  const lowered = reasoning.toLowerCase();
  
  // Phrases suggesting knowledge not from sources
  const leakagePhrases = [
    'i know that',
    'it is well known',
    'as everyone knows',
    'based on my knowledge',
    'from my training',
    'i learned that',
    'common knowledge',
    'it is obvious',
    'clearly',
    'obviously',
    'as we all know',
    'in my experience',
    'from what i know'
  ];
  
  for (const phrase of leakagePhrases) {
    if (lowered.includes(phrase)) {
      indicators.push(`Possible training data usage: "${phrase}"`);
    }
  }
  
  return indicators;
}

/**
 * Validate that all sources in response have citations
 * @param {Object} response - AI response
 * @returns {{valid: boolean, uncitedSources: string[]}} Validation result
 */
export function validateSourceCitations(response) {
  const uncitedSources = [];
  
  if (!response.sources || !Array.isArray(response.sources)) {
    return { valid: true, uncitedSources: [] };
  }
  
  for (const source of response.sources) {
    // Check if source has a quote or is referenced in reasoning
    const hasQuote = source.quote && source.quote.length > 0;
    const isReferenced = response.reasoning && 
                        response.reasoning.includes(source.url);
    
    if (!hasQuote && !isReferenced) {
      uncitedSources.push(source.url);
    }
  }
  
  return {
    valid: uncitedSources.length === 0,
    uncitedSources: uncitedSources
  };
}

/**
 * Get grounding quality score (0-100)
 * @param {Object} response - AI response
 * @param {string[]} providedUrls - Provided URLs
 * @returns {number} Quality score
 */
export function getGroundingQualityScore(response, providedUrls) {
  let score = 100;
  
  const validation = validateGrounding(response, providedUrls);
  
  // Deduct points for each issue
  for (const issue of validation.issues) {
    if (issue.includes('not in search results')) {
      score -= 30; // Major issue - citing non-provided URL
    } else if (issue.includes('does not reference')) {
      score -= 20; // Significant issue - no source references
    } else if (issue.includes('training data')) {
      score -= 10; // Minor issue - possible leakage
    }
  }
  
  return Math.max(0, score);
}



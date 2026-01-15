/**
 * TruthSeek Recency Handler
 * Handles facts affected by model knowledge cutoffs
 */

/**
 * Check if fact has recency issues due to knowledge cutoff
 * @param {Fact} fact - Fact being verified
 * @param {ProviderInfo} providerInfo - AI provider info with cutoff date
 * @param {Source[]} searchResults - Sources found during verification
 * @returns {{hasIssue: boolean, message: string|null}} Recency check result
 */
export function checkRecencyIssues(fact, providerInfo, searchResults) {
  const cutoffDate = providerInfo.knowledgeCutoffDate;
  const currentYear = new Date().getFullYear();
  const cutoffYear = cutoffDate.getFullYear();
  
  // Extract years from fact
  const factYears = extractYears(fact.originalText);
  
  // Check for post-cutoff references
  const hasPostCutoffYear = factYears.some(y => y > cutoffYear);
  
  // Check for current-position indicators
  const hasCurrentIndicator = /\b(current|currently|presently|now|today|as of)\b/i.test(fact.originalText);
  
  // Check for role/position indicators
  const hasRoleIndicator = /\b(president|secretary|ceo|chairman|chairwoman|director|minister|leader|governor|mayor|senator|representative)\b/i.test(fact.originalText);
  
  // Determine if recency is a concern
  const needsCurrentSources = hasPostCutoffYear || (hasCurrentIndicator && hasRoleIndicator);
  
  if (!needsCurrentSources) {
    return { hasIssue: false, message: null };
  }
  
  // Check if we have current sources
  const hasCurrentSources = searchResults.some(source => {
    const sourceYear = extractSourceYear(source);
    return sourceYear >= currentYear - 1; // Sources from last year or current year
  });
  
  if (hasCurrentSources) {
    return { hasIssue: false, message: null };
  }
  
  // Generate user-friendly message
  const message = `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${providerInfo.knowledgeCutoff}). We could not find sufficient current sources to verify it.`;
  
  return { hasIssue: true, message: message };
}

/**
 * Extract year numbers from text
 * @param {string} text - Text to search
 * @returns {number[]} Array of year numbers
 */
export function extractYears(text) {
  // Match years from 1900-2099
  const matches = text.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/g) || [];
  return matches.map(m => parseInt(m, 10));
}

/**
 * Extract year from source (URL or snippet)
 * @param {Source} source - Source object
 * @returns {number} Year number or 0 if not found
 */
function extractSourceYear(source) {
  // Try to extract year from URL
  const urlYears = extractYears(source.url);
  if (urlYears.length > 0) {
    return Math.max(...urlYears);
  }
  
  // Try to extract from snippet
  if (source.snippet) {
    const snippetYears = extractYears(source.snippet);
    if (snippetYears.length > 0) {
      return Math.max(...snippetYears);
    }
  }
  
  // Try to extract from title
  if (source.title) {
    const titleYears = extractYears(source.title);
    if (titleYears.length > 0) {
      return Math.max(...titleYears);
    }
  }
  
  return 0; // No year found
}

/**
 * Check if fact is about a current event/position
 * @param {string} factText - Fact text
 * @returns {boolean} True if about current event
 */
export function isCurrentEventFact(factText) {
  const currentIndicators = [
    'current', 'currently', 'presently', 'now', 'today',
    'as of', 'recent', 'latest', 'ongoing'
  ];
  
  const lowered = factText.toLowerCase();
  return currentIndicators.some(ind => lowered.includes(ind));
}

/**
 * Check if fact references post-cutoff timeframe
 * @param {string} factText - Fact text
 * @param {Date} cutoffDate - Model's knowledge cutoff date
 * @returns {boolean} True if references post-cutoff period
 */
export function referencesPostCutoffPeriod(factText, cutoffDate) {
  const cutoffYear = cutoffDate.getFullYear();
  const factYears = extractYears(factText);
  
  return factYears.some(year => year > cutoffYear);
}

/**
 * Get recency requirement level for a fact
 * @param {Fact} fact - Fact to analyze
 * @param {ProviderInfo} providerInfo - Provider info
 * @returns {string} 'none' | 'preferred' | 'required'
 */
export function getRecencyRequirement(fact, providerInfo) {
  const cutoffDate = providerInfo.knowledgeCutoffDate;
  
  // Required: Fact explicitly references post-cutoff period
  if (referencesPostCutoffPeriod(fact.originalText, cutoffDate)) {
    return 'required';
  }
  
  // Required: Fact is about current position/role
  if (isCurrentEventFact(fact.originalText) && 
      /\b(president|secretary|ceo|chairman|director|minister|leader)\b/i.test(fact.originalText)) {
    return 'required';
  }
  
  // Preferred: Fact contains current indicators
  if (isCurrentEventFact(fact.originalText)) {
    return 'preferred';
  }
  
  // None: Historical or timeless fact
  return 'none';
}

/**
 * Format knowledge cutoff date for display
 * @param {string} cutoffString - Cutoff date string (e.g., "October 2023")
 * @returns {string} Formatted date
 */
export function formatCutoffDate(cutoffString) {
  // Already in readable format
  return cutoffString;
}

/**
 * Generate detailed recency message
 * @param {Fact} fact - Fact with recency issue
 * @param {ProviderInfo} providerInfo - Provider info
 * @param {Source[]} sources - Available sources
 * @returns {string} Detailed message
 */
export function generateRecencyMessage(fact, providerInfo, sources) {
  const requirement = getRecencyRequirement(fact, providerInfo);
  const cutoff = formatCutoffDate(providerInfo.knowledgeCutoff);
  
  if (requirement === 'required') {
    if (sources.length === 0) {
      return `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${cutoff}). No sources were found to verify it.`;
    } else {
      return `This fact relates to events after ${providerInfo.modelDisplayName}'s knowledge cutoff (${cutoff}). The sources found may be outdated.`;
    }
  } else if (requirement === 'preferred') {
    return `This fact may reference current information. ${providerInfo.modelDisplayName}'s knowledge cutoff is ${cutoff}.`;
  }
  
  return null;
}



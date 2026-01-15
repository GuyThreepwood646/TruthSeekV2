/**
 * TruthSeek Source Credibility Tiering
 * Assigns credibility tiers (1-4) to sources based on domain and category
 */

import { sourceTiers } from '../config/source-tiers.js';

/**
 * Assign tier to a source based on domain and category
 * @param {string} domain - Source domain (e.g., "cdc.gov")
 * @param {string} category - Fact category
 * @returns {number} Tier (1-4, where 1 is highest credibility)
 */
export function assignSourceTier(domain, category) {
  if (!domain) {
    return 4; // Unknown sources default to lowest tier
  }
  
  // Normalize domain (remove www., lowercase)
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // Check category-specific overrides first
  if (category && sourceTiers.categoryOverrides[category]) {
    const categoryTier = findMatchingTier(normalizedDomain, sourceTiers.categoryOverrides[category]);
    if (categoryTier !== null) {
      return categoryTier;
    }
  }
  
  // Check global defaults
  const globalTier = findMatchingTier(normalizedDomain, sourceTiers.globalDefaults);
  if (globalTier !== null) {
    return globalTier;
  }
  
  // Default to Tier 4 (unknown)
  return 4;
}

/**
 * Find matching tier from tier list
 * @param {string} domain - Normalized domain
 * @param {Array} tierList - List of tier mappings
 * @returns {number|null} Tier or null if no match
 * @private
 */
function findMatchingTier(domain, tierList) {
  for (const mapping of tierList) {
    if (domainMatches(domain, mapping.pattern)) {
      return mapping.tier;
    }
  }
  return null;
}

/**
 * Check if domain matches pattern
 * @param {string} domain - Domain to check
 * @param {string} pattern - Pattern to match against
 * @returns {boolean} True if matches
 * @private
 */
function domainMatches(domain, pattern) {
  // Normalize pattern
  const normalizedPattern = pattern.toLowerCase().replace(/^www\./, '');
  
  // Handle wildcard patterns (*.example.com)
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.substring(1); // Remove *
    return domain.endsWith(suffix);
  }
  
  // Exact match
  if (domain === normalizedPattern) {
    return true;
  }
  
  // Subdomain match (e.g., "subdomain.example.com" matches "example.com")
  if (domain.endsWith('.' + normalizedPattern)) {
    return true;
  }
  
  return false;
}

/**
 * Assign tiers to array of sources
 * @param {Source[]} sources - Sources to tier
 * @param {string} category - Fact category
 * @returns {Source[]} Sources with tiers assigned
 */
export function assignTiersToSources(sources, category) {
  if (!sources || !Array.isArray(sources)) {
    return [];
  }
  
  return sources.map(source => ({
    ...source,
    tier: assignSourceTier(source.domain, category)
  }));
}

/**
 * Get tier label for display
 * @param {number} tier - Tier number (1-4)
 * @returns {string} Human-readable tier label
 */
export function getTierLabel(tier) {
  const labels = {
    1: 'Authoritative',
    2: 'Reputable',
    3: 'General',
    4: 'Unverified'
  };
  return labels[tier] || 'Unknown';
}

/**
 * Get tier description
 * @param {number} tier - Tier number (1-4)
 * @returns {string} Description of tier
 */
export function getTierDescription(tier) {
  const descriptions = {
    1: 'Government agencies, academic institutions, peer-reviewed journals, official statistics',
    2: 'Major news outlets, established organizations, verified experts',
    3: 'General news, encyclopedias, reputable blogs',
    4: 'Forums, social media, unknown sources'
  };
  return descriptions[tier] || 'Unknown source type';
}

/**
 * Filter sources by minimum tier
 * @param {Source[]} sources - Sources to filter
 * @param {number} minTier - Minimum tier (inclusive)
 * @returns {Source[]} Filtered sources
 */
export function filterSourcesByTier(sources, minTier) {
  if (!sources || !Array.isArray(sources)) {
    return [];
  }
  
  return sources.filter(source => source.tier <= minTier);
}

/**
 * Get tier statistics for sources
 * @param {Source[]} sources - Sources to analyze
 * @returns {Object} Statistics by tier
 */
export function getTierStats(sources) {
  const stats = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
    tier4: 0,
    total: sources.length
  };
  
  for (const source of sources) {
    const tierKey = `tier${source.tier}`;
    if (stats.hasOwnProperty(tierKey)) {
      stats[tierKey]++;
    }
  }
  
  return stats;
}

/**
 * Check if sources meet quality threshold
 * @param {Source[]} sources - Sources to check
 * @param {number} minTier1Count - Minimum Tier 1 sources required
 * @returns {boolean} True if threshold met
 */
export function meetsQualityThreshold(sources, minTier1Count = 1) {
  const tier1Count = sources.filter(s => s.tier === 1).length;
  return tier1Count >= minTier1Count;
}


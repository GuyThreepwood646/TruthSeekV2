/**
 * TruthSeek Confidence Scoring
 * Calculates confidence scores with Tier 1 fast-track and evidence caps
 */

// Tier weights for confidence calculation
const TIER_WEIGHTS = {
  supporting: { 1: 20, 2: 15, 3: 10, 4: 5 },
  refuting: { 1: 25, 2: 18, 3: 12, 4: 5 }
};

// Confidence thresholds for categorization
const CONFIDENCE_THRESHOLDS = {
  low: 60,
  medium: 85
};

// Maximum confidence when evidence is missing or unverified
const UNVERIFIED_CAP = 70;

/**
 * Calculate confidence score based on verdict, AI confidence, and sources
 * @param {string} verdict - 'TRUE' | 'FALSE' | 'UNVERIFIED'
 * @param {number} aiConfidence - AI's confidence (0-1)
 * @param {Source[]} supportingSources - Sources supporting the fact
 * @param {Source[]} refutingSources - Sources refuting the fact
 * @param {boolean} hasVerifiedUrls - Whether any URLs were validated
 * @returns {{score: number, category: string}} Confidence score and category
 */
export function calculateConfidence(
  verdict,
  aiConfidence,
  supportingSources = [],
  refutingSources = [],
  hasVerifiedUrls = false
) {
  const normalizedConfidence = Number.isFinite(aiConfidence) ? aiConfidence : 0;
  const clampedConfidence = Math.max(0, Math.min(1, normalizedConfidence));
  
  // === TIER 1 FAST-TRACK CHECK ===
  if (verdict === 'TRUE' && clampedConfidence >= 0.8) {
    const tier1Supporting = supportingSources.filter(s => s.tier === 1);
    const tier1to3Refuting = refutingSources.filter(s => s.tier <= 3);
    
    // Fast-track if no credible refutation and Tier 1 support exists
    if (tier1to3Refuting.length === 0 && tier1Supporting.length > 0) {
      if (tier1Supporting.length >= 2) {
        return { score: 100, category: 'very-high' };
      }
      if (tier1Supporting.length === 1) {
        return { score: 90, category: 'very-high' };
      }
    }
  }
  
  // === STANDARD CALCULATION ===
  let score = 50; // Base score
  
  // Add AI confidence component (0-30 points)
  score += clampedConfidence * 30;
  
  // Add source evidence component
  const sourceScore = calculateSourceScore(supportingSources, refutingSources);
  score += sourceScore;
  
  // Apply evidence cap if no verified URLs
  if (!hasVerifiedUrls && score > UNVERIFIED_CAP) {
    score = UNVERIFIED_CAP;
  }
  
  // Cap confidence for unverified verdicts
  if (verdict === 'UNVERIFIED' && score > UNVERIFIED_CAP) {
    score = UNVERIFIED_CAP;
  }
  
  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));
  
  // Categorize
  const category = categorizeScore(score);
  
  return { score: Math.round(score), category };
}

/**
 * Calculate score contribution from sources
 * @param {Source[]} supportingSources - Supporting sources
 * @param {Source[]} refutingSources - Refuting sources
 * @returns {number} Score contribution (-50 to +50)
 * @private
 */
function calculateSourceScore(supportingSources, refutingSources) {
  let score = 0;
  
  // Add points for supporting sources (up to 3 sources)
  for (let i = 0; i < Math.min(3, supportingSources.length); i++) {
    const source = supportingSources[i];
    const weight = TIER_WEIGHTS.supporting[source.tier] || 0;
    score += weight;
  }
  
  // Subtract points for refuting sources (up to 3 sources)
  for (let i = 0; i < Math.min(3, refutingSources.length); i++) {
    const source = refutingSources[i];
    const weight = TIER_WEIGHTS.refuting[source.tier] || 0;
    score -= weight;
  }
  
  return score;
}

/**
 * Categorize confidence score
 * @param {number} score - Score 0-100
 * @returns {string} Category: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
 */
export function categorizeScore(score) {
  if (score >= 90) return 'very-high';
  if (score > CONFIDENCE_THRESHOLDS.medium) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.low) return 'medium';
  if (score >= 30) return 'low';
  return 'very-low';
}

/**
 * Calculate simple confidence without sources (for models without web search)
 * @param {string} verdict - 'TRUE' | 'FALSE' | 'UNVERIFIED'
 * @param {number} aiConfidence - AI's confidence (0-1)
 * @param {boolean} needsWebSearch - Whether fact requires current information
 * @returns {{score: number, category: string}}
 */
export function calculateSimpleConfidence(verdict, aiConfidence, needsWebSearch = false) {
  if (verdict === 'UNVERIFIED' || needsWebSearch) {
    return { score: 0, category: 'very-low' };
  }
  
  // Base confidence on AI only, with cap at 85 (no external evidence)
  const normalizedConfidence = Number.isFinite(aiConfidence) ? aiConfidence : 0;
  const clampedConfidence = Math.max(0, Math.min(1, normalizedConfidence));
  let score = clampedConfidence * UNVERIFIED_CAP;
  
  // Clamp to 0-85
  score = Math.max(0, Math.min(UNVERIFIED_CAP, score));
  
  const category = categorizeScore(score);
  
  return { score: Math.round(score), category };
}

/**
 * Get confidence level description
 * @param {string} category - Confidence category
 * @returns {string} Human-readable description
 */
export function getConfidenceDescription(category) {
  const descriptions = {
    'very-high': 'Very High - Multiple authoritative sources confirm this',
    'high': 'High - Reliable sources support this with minimal contradictions',
    'medium': 'Medium - Some evidence supports this, but gaps or conflicts exist',
    'low': 'Low - Limited or weak evidence available',
    'very-low': 'Very Low - Insufficient or conflicting evidence'
  };
  
  return descriptions[category] || 'Unknown confidence level';
}

/**
 * Get confidence color for UI
 * @param {string} category - Confidence category
 * @returns {string} Color name
 */
export function getConfidenceColor(category) {
  const colors = {
    'very-high': 'green',
    'high': 'green',
    'medium': 'yellow',
    'low': 'orange',
    'very-low': 'red'
  };
  
  return colors[category] || 'gray';
}


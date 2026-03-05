/**
 * TruthSeek Categorization Validator
 * Validates and corrects fact category assignments
 */

import { CATEGORIES, VALID_CATEGORIES } from '../config/categories.js';

import { validateCategoryAssignment } from './fact-validator.js';

const CATEGORY_REASSIGN_THRESHOLD = 0.45;
const CATEGORY_REASSIGN_DELTA = 0.15;

/**
 * Validate and correct categories for all facts
 * @param {Fact[]} facts - Deduplicated facts
 * @returns {Fact[]} Facts with validated/corrected categories
 */
export function validateAndCorrectCategories(facts) {
  if (!facts || facts.length === 0) {
    return [];
  }
  
  const validated = [];
  let correctionCount = 0;
  let reassignmentCount = 0;
  
  for (const fact of facts) {
    if (VALID_CATEGORIES.includes(fact.category)) {
      // Category is valid, but may need correction
      const assessment = validateCategoryAssignment(fact);
      if (assessment.suggestion && shouldReassignCategory(assessment)) {
        const updated = {
          ...fact,
          category: assessment.suggestion
        };
        validated.push(updated);
        reassignmentCount++;
        console.log(`[CATEGORIZATION] Reassigned fact ${fact.id} to ${assessment.suggestion}: ${assessment.reason || 'heuristic mismatch'}`);
      } else {
        validated.push(fact);
      }
    } else {
      // Invalid or missing category - attempt re-categorization
      console.warn(`[CATEGORIZATION] Invalid category "${fact.category}" for fact: ${fact.id}`);
      const corrected = recategorize(fact);
      validated.push(corrected);
      correctionCount++;
    }
  }
  
  if (correctionCount > 0) {
    console.log(`[CATEGORIZATION] Re-categorized ${correctionCount} facts with invalid categories`);
  }
  
  if (reassignmentCount > 0) {
    console.log(`[CATEGORIZATION] Reassigned ${reassignmentCount} facts based on category validation`);
  }
  
  return validated;
}

/**
 * Re-categorize a fact using keyword-based heuristics
 * @param {Fact} fact - Fact with invalid/missing category
 * @returns {Fact} Fact with corrected category
 */
function recategorize(fact) {
  // Combine original and searchable text for analysis
  const text = `${fact.originalText} ${fact.searchableText}`.toLowerCase();
  
  // Check for category indicators in priority order
  
  // STATISTICAL_QUANTITATIVE - numerical claims
  if (containsAny(text, ['percent', '%', 'million', 'billion', 'trillion', 'number', 'rate', 'average', 'approximately', 'roughly'])) {
    fact.category = 'STATISTICAL_QUANTITATIVE';
  }
  // LEGAL_REGULATORY - legal/regulatory content
  else if (containsAny(text, ['law', 'regulation', 'court', 'legal', 'ruling', 'statute', 'act', 'legislation', 'compliance', 'mandate'])) {
    fact.category = 'LEGAL_REGULATORY';
  }
  // MEDICAL_BIOLOGICAL - health/medical content
  else if (containsAny(text, [
    'disease', 'treatment', 'symptom', 'patient', 'drug', 'medical', 'health', 'diagnosis', 'therapy', 'medication',
    'abortion', 'miscarriage', 'pregnancy', 'reproductive', 'pharmaceutical'
  ])) {
    fact.category = 'MEDICAL_BIOLOGICAL';
  }
  // SCIENTIFIC_TECHNICAL - research/technical content
  else if (containsAny(text, ['study', 'research', 'experiment', 'theory', 'hypothesis', 'scientific', 'technical', 'analysis', 'findings'])) {
    fact.category = 'SCIENTIFIC_TECHNICAL';
  }
  // HISTORICAL_EVENT - historical references
  else if (containsAny(text, ['war', 'founded', 'century', 'ancient', 'historical', 'battle', 'revolution', 'independence', 'established'])) {
    fact.category = 'HISTORICAL_EVENT';
  }
  // GEOPOLITICAL_SOCIAL - political/social content
  else if (containsAny(text, ['country', 'government', 'political', 'population', 'nation', 'state', 'democracy', 'election', 'policy'])) {
    fact.category = 'GEOPOLITICAL_SOCIAL';
  }
  // ATTRIBUTION_QUOTE - attributed statements
  else if (containsAny(text, ['said', 'stated', 'according to', 'quote', 'claimed', 'announced', 'declared', 'mentioned'])) {
    fact.category = 'ATTRIBUTION_QUOTE';
  }
  // CAUSAL_RELATIONAL - cause-effect relationships
  else if (containsAny(text, ['causes', 'leads to', 'results in', 'because', 'effect', 'due to', 'consequently', 'therefore'])) {
    fact.category = 'CAUSAL_RELATIONAL';
  }
  // DEFINITIONAL_ATTRIBUTE - default fallback
  else {
    fact.category = 'DEFINITIONAL_ATTRIBUTE';
  }
  
  console.log(`[CATEGORIZATION] Re-categorized fact ${fact.id} as ${fact.category}`);
  return fact;
}

/**
 * Check if text contains any of the specified keywords
 * @param {string} text - Text to search (should be lowercase)
 * @param {string[]} keywords - Keywords to find
 * @returns {boolean} True if any keyword found
 */
function containsAny(text, keywords) {
  return keywords.some(kw => text.includes(kw));
}

/**
 * Get category statistics for a set of facts
 * @param {Fact[]} facts - Facts to analyze
 * @returns {Object} Category counts
 */
export function getCategoryStatistics(facts) {
  const stats = {};
  
  for (const category of VALID_CATEGORIES) {
    stats[category] = 0;
  }
  
  for (const fact of facts) {
    if (stats[fact.category] !== undefined) {
      stats[fact.category]++;
    } else {
      stats['UNKNOWN'] = (stats['UNKNOWN'] || 0) + 1;
    }
  }
  
  return stats;
}

/**
 * Validate a single category value
 * @param {string} category - Category to validate
 * @returns {boolean} True if valid
 */
export function isValidCategory(category) {
  return VALID_CATEGORIES.includes(category);
}

function shouldReassignCategory(assessment) {
  if (!assessment || !assessment.suggestion) {
    return false;
  }
  
  let suggestionScore = 0;
  let currentScore = 0;
  
  if (Number.isFinite(assessment.suggestionScore)) {
    suggestionScore = assessment.suggestionScore;
  }
  
  if (Number.isFinite(assessment.confidence)) {
    currentScore = assessment.confidence;
  }
  
  if (suggestionScore < CATEGORY_REASSIGN_THRESHOLD) {
    return false;
  }
  
  return (suggestionScore - currentScore) >= CATEGORY_REASSIGN_DELTA;
}



/**
 * TruthSeek Fact Validator
 * Validates fact structure, categories, and content quality
 */

import { VALID_CATEGORIES, CATEGORIES } from '../config/categories.js';

/**
 * Validate and sanitize a batch of facts
 * @param {Fact[]} facts - Facts to validate
 * @param {Sentence[]} sentences - Source sentences for context
 * @returns {ValidationResult} Validation results with valid facts and errors
 */
export function validateFacts(facts, sentences = []) {
  const validFacts = [];
  const errors = [];
  const sentenceMap = buildSentenceMap(sentences);
  
  console.log(`Validating ${facts.length} facts...`);
  
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    const validation = validateSingleFact(fact, i, sentenceMap);
    
    if (validation.isValid) {
      validFacts.push(validation.fact);
    } else {
      errors.push({
        index: i,
        factId: fact.id || `unknown-${i}`,
        errors: validation.errors,
        fact: fact
      });
    }
  }
  
  console.log(`Validation complete: ${validFacts.length} valid, ${errors.length} invalid`);
  
  return {
    validFacts,
    errors,
    invalidFacts: errors,
    totalProcessed: facts.length,
    validCount: validFacts.length,
    errorCount: errors.length
  };
}

/**
 * Validate a single fact
 * @param {Fact} fact - Fact to validate
 * @param {number} index - Index for error reporting
 * @param {Map<string, Sentence>} sentenceMap - Map of sentenceId to sentence
 * @returns {object} Validation result
 * @private
 */
function validateSingleFact(fact, index, sentenceMap) {
  const errors = [];
  const sentence = sentenceMap.get(fact.sentenceId);
  
  // AC3.5.1: Verify category is one of the 9 predefined categories
  if (!fact.category) {
    errors.push('Missing category field');
  } else if (!VALID_CATEGORIES.includes(fact.category)) {
    errors.push(`Invalid category: "${fact.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  
  // AC3.5.2: Validate required fields exist and are non-empty
  const requiredFields = ['originalText', 'searchableText', 'sentenceId'];
  
  for (const field of requiredFields) {
    if (!fact[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof fact[field] !== 'string') {
      errors.push(`Field ${field} must be a string, got ${typeof fact[field]}`);
    } else if (fact[field].trim().length === 0) {
      errors.push(`Field ${field} cannot be empty`);
    }
  }
  
  if (sentence && isMetadataSentence(sentence.text)) {
    errors.push('Fact appears to come from article metadata');
  }
  
  // AC3.5.3: Check text length constraints (min 10 chars, max 500 chars)
  if (fact.originalText && typeof fact.originalText === 'string') {
    const length = fact.originalText.trim().length;
    if (length < 10) {
      errors.push(`originalText too short (${length} chars, minimum 10)`);
    } else if (length > 500) {
      errors.push(`originalText too long (${length} chars, maximum 500)`);
    }
  }
  
  if (fact.searchableText && typeof fact.searchableText === 'string') {
    const length = fact.searchableText.trim().length;
    if (length < 10) {
      errors.push(`searchableText too short (${length} chars, minimum 10)`);
    } else if (length > 500) {
      errors.push(`searchableText too long (${length} chars, maximum 500)`);
    }
  }
  
  // AC3.5.4: Validate sentenceId format (s-NNNN)
  if (fact.sentenceId && typeof fact.sentenceId === 'string') {
    if (!/^s-\d{4}$/.test(fact.sentenceId)) {
      errors.push(`Invalid sentenceId format: "${fact.sentenceId}". Expected format: s-NNNN (e.g., s-0001)`);
    }
  }
  
  // AC3.5.5: Check for XSS/injection attempts in text fields
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];
  
  const textFields = ['originalText', 'searchableText'];
  for (const field of textFields) {
    if (fact[field] && typeof fact[field] === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(fact[field])) {
          errors.push(`Potential XSS detected in ${field}`);
          break;
        }
      }
    }
  }
  
  // If there are errors, return invalid
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      fact: null
    };
  }
  
  // AC3.5.6: Sanitize and normalize valid facts
  const enrichedFact = applyContextEnrichment(fact, sentenceMap);
  const sanitizedFact = sanitizeFact(enrichedFact);
  
  return {
    isValid: true,
    errors: [],
    fact: sanitizedFact
  };
}

function buildSentenceMap(sentences) {
  const map = new Map();
  if (!Array.isArray(sentences)) {
    return map;
  }
  for (const sentence of sentences) {
    if (sentence && sentence.id) {
      map.set(sentence.id, sentence);
    }
  }
  return map;
}

function isMetadataSentence(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return true;
  }
  
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('updated ') || lower.startsWith('published ')) {
    return true;
  }
  if (lower.startsWith('by ') && trimmed.length < 120) {
    return true;
  }
  if (/\bap photo\b/i.test(trimmed)) {
    return true;
  }
  if (/\bread more\b/i.test(trimmed)) {
    return true;
  }
  
  return false;
}

function applyContextEnrichment(fact, sentenceMap) {
  if (!fact || typeof fact !== 'object' || !sentenceMap || sentenceMap.size === 0) {
    return fact;
  }
  
  const currentSentence = sentenceMap.get(fact.sentenceId);
  if (!currentSentence || !currentSentence.text) {
    return fact;
  }
  
  let searchableText = fact.searchableText || '';
  const enrichedRestrictions = enrichRestrictionsContext(currentSentence.text, searchableText, sentenceMap, fact.sentenceId);
  
  if (enrichedRestrictions && enrichedRestrictions !== searchableText) {
    return {
      ...fact,
      searchableText: enrichedRestrictions
    };
  }
  
  return fact;
}

function enrichRestrictionsContext(currentText, searchableText, sentenceMap, sentenceId) {
  if (!currentText || !searchableText) {
    return null;
  }
  
  const lowerCurrent = currentText.toLowerCase();
  const lowerSearch = searchableText.toLowerCase();
  if (!lowerCurrent.includes('restrictions') || lowerSearch.includes('restrictions on') || lowerSearch.includes('restrictions to')) {
    return null;
  }
  
  const context = findRecentRestrictionTarget(sentenceMap, sentenceId);
  if (!context) {
    return null;
  }
  
  if (/restrictions\b/i.test(searchableText)) {
    return searchableText.replace(/restrictions\b/i, `restrictions ${context}`);
  }
  
  return null;
}

function findRecentRestrictionTarget(sentenceMap, sentenceId) {
  const index = parseSentenceIndex(sentenceId);
  if (index === null) {
    return null;
  }
  
  for (let offset = 1; offset <= 2; offset++) {
    const previousId = `s-${String(index - offset).padStart(4, '0')}`;
    const previous = sentenceMap.get(previousId);
    if (!previous || !previous.text) {
      continue;
    }
    
    const match = previous.text.match(/\brestrictions?\s+(on|to|of|for)\s+([^.;:]+)/i);
    if (match && match[1] && match[2]) {
      const target = match[2].trim();
      if (target.length > 3) {
        return `${match[1]} ${target}`;
      }
    }
  }
  
  return null;
}

function parseSentenceIndex(sentenceId) {
  if (!sentenceId || typeof sentenceId !== 'string') {
    return null;
  }
  
  const match = sentenceId.match(/^s-(\d{4})$/);
  if (!match) {
    return null;
  }
  
  return Number.parseInt(match[1], 10);
}

/**
 * Sanitize and normalize a fact
 * @param {Fact} fact - Fact to sanitize
 * @returns {Fact} Sanitized fact
 * @private
 */
function sanitizeFact(fact) {
  return {
    id: fact.id,
    originalText: sanitizeText(fact.originalText),
    searchableText: sanitizeText(fact.searchableText),
    category: fact.category,
    sentenceId: fact.sentenceId,
    agentId: fact.agentId,
    agentRank: fact.agentRank || 0,
    provenance: Array.isArray(fact.provenance) ? fact.provenance : [fact.agentId],
    // Preserve any additional metadata
    ...(fact.xpath && { xpath: fact.xpath }),
    ...(fact.timestamp && { timestamp: fact.timestamp })
  };
}

/**
 * Sanitize text content
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 * @private
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove potential HTML tags
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate category assignment quality
 * Checks if the fact text is appropriate for its assigned category
 * @param {Fact} fact - Fact to validate
 * @returns {object} Category validation result
 */
export function validateCategoryAssignment(fact) {
  if (!fact.category || !VALID_CATEGORIES.includes(fact.category)) {
    return {
      isValid: false,
      confidence: 0,
      suggestion: null,
      reason: 'Invalid or missing category'
    };
  }
  
  const text = (fact.searchableText || fact.originalText || '').toLowerCase();
  
  // Heuristic patterns for each category
  const categoryPatterns = {
    HISTORICAL_EVENT: [
      /\b(in|during|since|until|from|between)\s+\d{4}/i,
      /\b(war|battle|revolution|founded|established|discovered|invented)\b/i,
      /\b(century|decade|era|period|age)\b/i
    ],
    STATISTICAL_QUANTITATIVE: [
      /\b\d+(\.\d+)?\s*(percent|%|million|billion|thousand|meters|km|kg|tons)\b/i,
      /\b(approximately|about|around|nearly|over|under)\s+\d+/i,
      /\b(average|median|total|sum|count|rate)\b/i
    ],
    DEFINITIONAL_ATTRIBUTE: [
      /\b(is|are|was|were|located|situated|composed of|made of|consists of)\b/i,
      /\b(capital|largest|smallest|tallest|longest)\b/i,
      /\b(known as|called|named|referred to as)\b/i
    ],
    SCIENTIFIC_TECHNICAL: [
      /\b(research|study|experiment|theory|hypothesis|formula|equation)\b/i,
      /\b(chemical|physical|biological|molecular|atomic)\b/i,
      /\b(technology|algorithm|protocol|specification)\b/i
    ],
    MEDICAL_BIOLOGICAL: [
      /\b(disease|symptom|treatment|diagnosis|medication|drug|therapy)\b/i,
      /\b(patient|clinical|medical|health|healthcare)\b/i,
      /\b(virus|bacteria|infection|immune|genetic)\b/i
    ],
    LEGAL_REGULATORY: [
      /\b(law|regulation|statute|code|act|amendment|ruling|court)\b/i,
      /\b(legal|illegal|prohibited|required|mandated|compliance)\b/i,
      /\b(supreme court|congress|parliament|legislature)\b/i
    ],
    GEOPOLITICAL_SOCIAL: [
      /\b(country|nation|state|government|political|election|policy)\b/i,
      /\b(population|demographic|census|immigration|migration)\b/i,
      /\b(border|territory|region|international|diplomatic)\b/i
    ],
    ATTRIBUTION_QUOTE: [
      /\b(said|stated|claimed|announced|declared|according to)\b/i,
      /\b(quote|quotation|statement|remarks|speech)\b/i,
      /["'].*["']/
    ],
    CAUSAL_RELATIONAL: [
      /\b(cause|caused|effect|result|lead to|due to|because of)\b/i,
      /\b(correlation|relationship|association|linked to|connected to)\b/i,
      /\b(increase|decrease|impact|influence|affect)\b/i
    ]
  };
  
  const patterns = categoryPatterns[fact.category] || [];
  let matchCount = 0;
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matchCount++;
    }
  }
  
  // Calculate confidence based on pattern matches
  const confidence = patterns.length > 0 ? matchCount / patterns.length : 0.5;
  
  // Check if another category might be a better fit
  let bestAlternative = null;
  let bestAlternativeScore = confidence;
  
  for (const [category, catPatterns] of Object.entries(categoryPatterns)) {
    if (category === fact.category) continue;
    
    let altMatchCount = 0;
    for (const pattern of catPatterns) {
      if (pattern.test(text)) {
        altMatchCount++;
      }
    }
    
    const altScore = catPatterns.length > 0 ? altMatchCount / catPatterns.length : 0;
    
    if (altScore > bestAlternativeScore) {
      bestAlternativeScore = altScore;
      bestAlternative = category;
    }
  }
  
  return {
    isValid: confidence >= 0.3 || !bestAlternative,
    confidence,
    suggestion: bestAlternative,
    reason: bestAlternative 
      ? `Text patterns suggest ${bestAlternative} (confidence: ${bestAlternativeScore.toFixed(2)}) over ${fact.category} (confidence: ${confidence.toFixed(2)})`
      : null
  };
}

/**
 * Get validation statistics
 * @param {ValidationResult} validationResult - Validation result
 * @returns {object} Statistics
 */
export function getValidationStats(validationResult) {
  const { totalProcessed, validCount, errorCount, errors } = validationResult;
  
  // Group errors by type
  const errorsByType = {};
  for (const error of errors) {
    for (const errorMsg of error.errors) {
      const type = errorMsg.split(':')[0] || 'Other';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    }
  }
  
  return {
    totalProcessed,
    validCount,
    errorCount,
    validationRate: totalProcessed > 0 ? ((validCount / totalProcessed) * 100).toFixed(1) + '%' : '0%',
    errorsByType
  };
}


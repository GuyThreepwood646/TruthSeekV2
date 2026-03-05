/**
 * TruthSeek Fact Category Definitions
 * 9-category taxonomy for fact classification
 */

export const CATEGORIES = {
  HISTORICAL_EVENT: {
    name: 'HISTORICAL_EVENT',
    description: 'Events that occurred at specific points in time (wars, discoveries, founding dates, historical milestones)'
  },
  
  STATISTICAL_QUANTITATIVE: {
    name: 'STATISTICAL_QUANTITATIVE',
    description: 'Numerical claims, percentages, measurements, counts, statistics, quantities'
  },
  
  DEFINITIONAL_ATTRIBUTE: {
    name: 'DEFINITIONAL_ATTRIBUTE',
    description: 'General attributes or properties of entities when no specialized domain applies (location, composition, characteristics)'
  },
  
  SCIENTIFIC_TECHNICAL: {
    name: 'SCIENTIFIC_TECHNICAL',
    description: 'Scientific facts, technical specifications, research findings, scientific principles'
  },
  
  MEDICAL_BIOLOGICAL: {
    name: 'MEDICAL_BIOLOGICAL',
    description: 'Health-related facts, medical information, drugs, treatments, diseases, reproductive health'
  },
  
  LEGAL_REGULATORY: {
    name: 'LEGAL_REGULATORY',
    description: 'Laws, regulations, legal rulings, compliance requirements, legal precedents'
  },
  
  GEOPOLITICAL_SOCIAL: {
    name: 'GEOPOLITICAL_SOCIAL',
    description: 'Political boundaries, demographics, social structures, international relations, governance'
  },
  
  ATTRIBUTION_QUOTE: {
    name: 'ATTRIBUTION_QUOTE',
    description: 'Statements attributed to specific people or organizations, quotes, claims with attribution'
  },
  
  CAUSAL_RELATIONAL: {
    name: 'CAUSAL_RELATIONAL',
    description: 'Cause-and-effect relationships, correlations, dependencies, consequences'
  }
};

/**
 * Array of valid category names
 */
export const VALID_CATEGORIES = Object.keys(CATEGORIES);

/**
 * Get category description
 * @param {string} category - Category name
 * @returns {string|null}
 */
export function getCategoryDescription(category) {
  return CATEGORIES[category]?.description || null;
}

/**
 * Check if category is valid
 * @param {string} category - Category name
 * @returns {boolean}
 */
export function isValidCategory(category) {
  return VALID_CATEGORIES.includes(category);
}


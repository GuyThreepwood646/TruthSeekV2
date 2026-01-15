/**
 * TruthSeek Search Strategies
 * Category-specific search query optimization (static strategies)
 */

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Build optimized search query based on fact category
 * @param {string} searchableText - Fact's searchable text
 * @param {string} category - Fact category
 * @param {boolean} isRefuting - Whether to add refuting qualifiers
 * @returns {string} Optimized search query
 */
export function buildSearchQuery(searchableText, category, isRefuting = false) {
  let baseQuery = searchableText;
  
  // Apply category-specific enhancements
  switch (category) {
    case 'MEDICAL_BIOLOGICAL':
      baseQuery = `${baseQuery} site:nih.gov OR site:cdc.gov OR site:pubmed.ncbi.nlm.nih.gov OR site:mayoclinic.org`;
      break;
    
    case 'LEGAL_REGULATORY':
      baseQuery = `${baseQuery} site:*.gov OR "court ruling" OR "legal" OR "regulation"`;
      break;
    
    case 'STATISTICAL_QUANTITATIVE':
      baseQuery = `${baseQuery} "official statistics" OR site:census.gov OR site:bls.gov OR "data"`;
      break;
    
    case 'SCIENTIFIC_TECHNICAL':
      baseQuery = `${baseQuery} "peer-reviewed" OR "journal" OR "study" OR site:*.edu`;
      break;
    
    case 'HISTORICAL_EVENT':
      // Determine if past historical or current event
      if (isCurrentEvent(searchableText)) {
        baseQuery = `${baseQuery} ${CURRENT_YEAR} OR ${CURRENT_YEAR - 1} current recent`;
      } else {
        const years = extractYears(searchableText);
        if (years.length > 0) {
          baseQuery = `${baseQuery} ${years.join(' ')}`;
        }
      }
      break;
    
    case 'GEOPOLITICAL_SOCIAL':
      // Check for current positions/roles
      if (containsCurrentIndicator(searchableText)) {
        baseQuery = `${baseQuery} ${CURRENT_YEAR} current`;
      }
      break;
    
    default:
      // Use searchable text as-is for other categories
      break;
  }
  
  // Add refuting qualifiers if needed
  if (isRefuting) {
    baseQuery = `${baseQuery} false OR debunked OR incorrect OR "not true" OR misleading`;
  }
  
  return baseQuery;
}

/**
 * Check if text references a current event
 * @param {string} text - Searchable text
 * @returns {boolean} True if current event
 */
function isCurrentEvent(text) {
  const currentIndicators = ['current', 'now', 'today', 'presently', 'currently', 'recent'];
  const lowered = text.toLowerCase();
  
  // Check for current indicators
  if (currentIndicators.some(ind => lowered.includes(ind))) {
    return true;
  }
  
  // Check for recent years (within last 2 years)
  const years = extractYears(text);
  if (years.some(y => y >= CURRENT_YEAR - 2)) {
    return true;
  }
  
  return false;
}

/**
 * Extract year numbers from text
 * @param {string} text - Text to extract years from
 * @returns {number[]} Array of year numbers
 */
export function extractYears(text) {
  // Match years from 1000-2099
  const matches = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || [];
  return matches.map(m => parseInt(m, 10));
}

/**
 * Check if text contains current position/role indicators
 * @param {string} text - Text to check
 * @returns {boolean} True if contains indicators
 */
function containsCurrentIndicator(text) {
  const indicators = [
    'president', 'secretary', 'ceo', 'chairman', 'chairwoman',
    'director', 'leader', 'head of', 'minister', 'prime minister',
    'governor', 'mayor', 'senator', 'representative'
  ];
  const lowered = text.toLowerCase();
  return indicators.some(ind => lowered.includes(ind));
}

/**
 * Get search strategy description for a category
 * @param {string} category - Fact category
 * @returns {string} Strategy description
 */
export function getStrategyDescription(category) {
  const descriptions = {
    'MEDICAL_BIOLOGICAL': 'Prioritizing medical authorities (NIH, CDC, PubMed, Mayo Clinic)',
    'LEGAL_REGULATORY': 'Prioritizing government and legal sources',
    'STATISTICAL_QUANTITATIVE': 'Prioritizing official statistics and data sources',
    'SCIENTIFIC_TECHNICAL': 'Prioritizing peer-reviewed journals and academic sources',
    'HISTORICAL_EVENT': 'Including relevant time period and recency indicators',
    'GEOPOLITICAL_SOCIAL': 'Including current year for position/role verification',
    'DEFINITIONAL_ATTRIBUTE': 'Using standard search without category-specific filters',
    'ATTRIBUTION_QUOTE': 'Using standard search without category-specific filters',
    'CAUSAL_RELATIONAL': 'Using standard search without category-specific filters'
  };
  
  return descriptions[category] || 'Using standard search strategy';
}



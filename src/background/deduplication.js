/**
 * TruthSeek Fact Deduplication Engine
 * Removes duplicate and semantically equivalent facts using model-quality tiebreaking
 */

import { getAgentRank } from '../config/model-rankings.js';

/**
 * Deduplicate facts from multiple agents
 * @param {RawExtractionResults[]} rawResults - Extraction results from all agents
 * @returns {Promise<Fact[]>} Deduplicated facts with provenance
 */
export async function deduplicate(rawResults) {
  console.log('Starting deduplication...');
  
  // Step 1: Flatten all facts and add agent rank
  const allFacts = [];
  
  for (const result of rawResults) {
    if (!result.success || !result.facts) {
      continue;
    }
    
    const agentRank = await getAgentRank(result.agentId);
    
    for (const fact of result.facts) {
      allFacts.push({
        ...fact,
        agentId: result.agentId,
        agentRank: agentRank,
        provenance: [result.agentId] // Initial provenance
      });
    }
  }
  
  console.log(`Deduplicating ${allFacts.length} facts from ${rawResults.length} agents`);
  
  if (allFacts.length === 0) {
    return [];
  }
  
  // Step 2: Group by exact normalized text match
  const exactGroups = groupByExactMatch(allFacts);
  console.log(`After exact matching: ${exactGroups.length} groups`);
  
  // Step 3: Find semantic matches across groups
  const semanticGroups = findSemanticMatches(exactGroups);
  console.log(`After semantic matching: ${semanticGroups.length} groups`);
  
  // Step 4: Select best version from each group
  const deduplicated = [];
  
  for (const group of semanticGroups) {
    const best = selectBestVersion(group);
    
    // Merge provenance from all facts in group
    best.provenance = [...new Set(group.map(f => f.agentId))];
    
    deduplicated.push(best);
  }
  
  // Step 5: Assign new sequential IDs
  for (let i = 0; i < deduplicated.length; i++) {
    deduplicated[i].id = `f-${i.toString().padStart(4, '0')}`;
  }
  
  console.log(`Deduplication complete: ${deduplicated.length} unique facts`);
  
  return deduplicated;
}

/**
 * Group facts by exact normalized text match
 * @param {Fact[]} facts - All facts
 * @returns {Fact[][]} Array of fact groups
 */
function groupByExactMatch(facts) {
  const groups = new Map();
  
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    const normalized = normalizeText(fact.searchableText || fact.originalText || '');
    const key = normalized || `missing-text-${i}`;
    
    if (groups.has(key)) {
      groups.get(key).push(fact);
    } else {
      groups.set(key, [fact]);
    }
  }
  
  return Array.from(groups.values());
}

/**
 * Normalize text for comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Find semantic matches across exact match groups
 * @param {Fact[][]} exactGroups - Groups from exact matching
 * @returns {Fact[][]} Merged groups including semantic matches
 */
function findSemanticMatches(exactGroups) {
  const finalGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < exactGroups.length; i++) {
    if (processed.has(i)) {
      continue;
    }
    
    const currentGroup = [...exactGroups[i]];
    processed.add(i);
    
    // Compare with remaining groups
    for (let j = i + 1; j < exactGroups.length; j++) {
      if (processed.has(j)) {
        continue;
      }
      
      // Compare representative facts from each group
      const similarity = calculateSimilarity(
        currentGroup[0].searchableText,
        exactGroups[j][0].searchableText
      );
      
      // Threshold for semantic equivalence
      if (similarity >= 0.9) {
        // Merge groups
        currentGroup.push(...exactGroups[j]);
        processed.add(j);
      }
    }
    
    finalGroups.push(currentGroup);
  }
  
  return finalGroups;
}

/**
 * Calculate similarity between two texts using Jaccard similarity
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score 0-1
 */
function calculateSimilarity(text1, text2) {
  // Tokenize into words
  const words1 = new Set(normalizeText(text1).split(' ').filter(w => w.length > 0));
  const words2 = new Set(normalizeText(text2).split(' ').filter(w => w.length > 0));
  
  if (words1.size === 0 && words2.size === 0) {
    return 1.0; // Both empty
  }
  
  if (words1.size === 0 || words2.size === 0) {
    return 0.0; // One empty
  }
  
  // Calculate Jaccard similarity: intersection / union
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Select best version from a group of duplicate facts
 * Uses model quality ranking for tiebreaking
 * @param {Fact[]} candidates - Candidate facts
 * @returns {Fact} Best version
 */
function selectBestVersion(candidates) {
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  // Sort by agent rank (descending - higher is better)
  const sorted = [...candidates].sort((a, b) => b.agentRank - a.agentRank);
  
  // Get top rank
  const topRank = sorted[0].agentRank;
  
  // Get all candidates with top rank
  const topCandidates = sorted.filter(f => f.agentRank === topRank);
  
  if (topCandidates.length === 1) {
    return topCandidates[0];
  }
  
  // Tiebreak: prefer longer searchableText (more specific/complete)
  const byLength = topCandidates.sort((a, b) => {
    const aLength = (a.searchableText || a.originalText || '').length;
    const bLength = (b.searchableText || b.originalText || '').length;
    return bLength - aLength;
  });
  
  return byLength[0];
}

/**
 * Get deduplication statistics
 * @param {RawExtractionResults[]} rawResults - Raw results
 * @param {Fact[]} deduplicated - Deduplicated results
 * @returns {object} Statistics
 */
export function getDeduplicationStats(rawResults, deduplicated) {
  const totalFacts = rawResults.reduce((sum, r) => sum + (r.facts?.length || 0), 0);
  const uniqueFacts = deduplicated.length;
  const duplicatesRemoved = totalFacts - uniqueFacts;
  const deduplicationRate = totalFacts > 0 ? (duplicatesRemoved / totalFacts * 100).toFixed(1) : 0;
  
  return {
    totalFacts,
    uniqueFacts,
    duplicatesRemoved,
    deduplicationRate: `${deduplicationRate}%`
  };
}


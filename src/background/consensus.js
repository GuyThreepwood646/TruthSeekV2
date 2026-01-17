/**
 * TruthSeek Consensus Algorithm
 * Aggregates verification results from multiple AI agents using majority voting
 * and disagreement detection
 */

/**
 * Aggregate verification results from multiple agents for a single fact
 * @param {Object[]} agentResults - Array of verification results from different agents
 * @returns {Object} Aggregated result with consensus verdict and confidence
 */
export function aggregateResults(agentResults) {
  if (!agentResults || agentResults.length === 0) {
    throw new Error('No results to aggregate');
  }
  
  const eligibleResults = agentResults.filter(result => !isExcludedFromAggregate(result));
  
  if (eligibleResults.length === 0) {
    const fallbackReasoning = agentResults[0]?.reasoning || 'No evidence or model knowledge available.';
    
    return {
      factId: agentResults[0].factId,
      aggregateVerdict: 'UNVERIFIED',
      aggregateConfidence: 0,
      aggregateConfidenceCategory: 'very-low',
      agentResults,
      hasDisagreement: false,
      disagreementNote: null,
      disagreementType: null,
      needsReVerification: false,
      reasoning: fallbackReasoning,
      sources: [],
      noModelKnowledge: true
    };
  }
  
  // Single eligible agent - no aggregation needed
  if (eligibleResults.length === 1) {
    const result = eligibleResults[0];
    return {
      factId: result.factId || agentResults[0].factId,
      aggregateVerdict: result.verdict,
      aggregateConfidence: result.confidence,
      aggregateConfidenceCategory: result.confidenceCategory || categorizeConfidence(result.confidence),
      agentResults: agentResults,
      hasDisagreement: false,
      disagreementNote: null,
      disagreementType: null,
      needsReVerification: false,
      reasoning: result.reasoning,
      sources: result.sources || [],
      noModelKnowledge: result.noModelKnowledge === true
    };
  }
  
  // Count verdicts
  const verdictCounts = {
    TRUE: eligibleResults.filter(r => r.verdict === 'TRUE').length,
    FALSE: eligibleResults.filter(r => r.verdict === 'FALSE').length,
    UNVERIFIED: eligibleResults.filter(r => r.verdict === 'UNVERIFIED').length
  };
  
  // Check for strong disagreement (TRUE vs FALSE)
  const hasStrongDisagreement = verdictCounts.TRUE > 0 && verdictCounts.FALSE > 0;
  
  // Determine disagreement type and whether re-verification is recommended
  const disagreementAnalysis = analyzeDisagreement(verdictCounts, hasStrongDisagreement, eligibleResults);
  
  // Determine aggregate verdict
  const aggregateVerdict = determineAggregateVerdict(verdictCounts, hasStrongDisagreement);
  
  // Calculate aggregate confidence
  const confidences = eligibleResults.map(r => r.confidence);
  let baseConfidence = average(confidences);
  
  // Apply disagreement penalty
  let aggregateConfidence;
  let disagreementNote = null;
  
  if (hasStrongDisagreement) {
    // AC8.4.2: Disagreement lowers aggregate confidence score
    aggregateConfidence = Math.max(0, baseConfidence - 20);
    disagreementNote = "Agents strongly disagree: some found TRUE, others FALSE";
  } else if (verdictCounts.UNVERIFIED > 0 && (verdictCounts.TRUE > 0 || verdictCounts.FALSE > 0)) {
    aggregateConfidence = Math.max(0, baseConfidence - 10);
    disagreementNote = "Some agents could not verify this fact";
  } else {
    aggregateConfidence = baseConfidence;
  }
  
  // Aggregate reasoning from all agents
  const reasoning = aggregateReasoning(eligibleResults, aggregateVerdict);
  
  // Collect all unique sources
  const allSources = collectUniqueSources(eligibleResults);
  
  return {
    factId: agentResults[0].factId,
    aggregateVerdict,
    aggregateConfidence: Math.round(aggregateConfidence),
    aggregateConfidenceCategory: categorizeConfidence(aggregateConfidence),
    agentResults,
    hasDisagreement: hasStrongDisagreement || (disagreementNote !== null),
    disagreementNote,
    disagreementType: disagreementAnalysis.type,
    needsReVerification: disagreementAnalysis.needsReVerification,
    suggestedSearchTerms: disagreementAnalysis.suggestedSearchTerms,
    reasoning,
    sources: allSources,
    noModelKnowledge: false
  };
}

/**
 * Check if a result should be excluded from aggregation
 * @param {Object} result - Agent result
 * @returns {boolean}
 * @private
 */
function isExcludedFromAggregate(result) {
  return result?.noModelKnowledge === true &&
    result?.verdict === 'UNVERIFIED' &&
    Number(result?.confidence) === 0;
}

/**
 * Analyze disagreement patterns and determine if re-verification is recommended
 * AC8.4.4: Option to re-run verification with additional search terms when disagreement detected
 * @param {Object} verdictCounts - Count of each verdict type
 * @param {boolean} hasStrongDisagreement - Whether TRUE and FALSE both exist
 * @param {Object[]} agentResults - All agent results
 * @returns {Object} Disagreement analysis
 * @private
 */
function analyzeDisagreement(verdictCounts, hasStrongDisagreement, agentResults) {
  const analysis = {
    type: null,
    needsReVerification: false,
    suggestedSearchTerms: []
  };
  
  // Strong disagreement (TRUE vs FALSE)
  if (hasStrongDisagreement) {
    analysis.type = 'strong';
    analysis.needsReVerification = true;
    
    // Suggest additional search terms to resolve disagreement
    // Look for common themes in disagreeing agents' reasoning
    const trueAgents = agentResults.filter(r => r.verdict === 'TRUE');
    const falseAgents = agentResults.filter(r => r.verdict === 'FALSE');
    
    // Suggest broader search terms
    analysis.suggestedSearchTerms = [
      'fact check',
      'debunked',
      'verified',
      'latest update',
      'correction'
    ];
    
    // If confidence is low on both sides, suggest more specific searches
    const avgTrueConfidence = average(trueAgents.map(a => a.confidence));
    const avgFalseConfidence = average(falseAgents.map(a => a.confidence));
    
    if (avgTrueConfidence < 70 && avgFalseConfidence < 70) {
      analysis.suggestedSearchTerms.push('primary source', 'official statement');
    }
    
    return analysis;
  }
  
  // Partial disagreement (some UNVERIFIED)
  if (verdictCounts.UNVERIFIED > 0 && (verdictCounts.TRUE > 0 || verdictCounts.FALSE > 0)) {
    analysis.type = 'partial';
    
    // Only recommend re-verification if multiple agents couldn't verify
    if (verdictCounts.UNVERIFIED >= 2) {
      analysis.needsReVerification = true;
      analysis.suggestedSearchTerms = [
        'recent news',
        'latest information',
        'updated'
      ];
    }
    
    return analysis;
  }
  
  // Weak disagreement (all same verdict but low confidence variance)
  const confidences = agentResults.map(r => r.confidence);
  const confidenceVariance = calculateVariance(confidences);
  
  if (confidenceVariance > 400) { // High variance (e.g., 50% and 90%)
    analysis.type = 'weak';
    analysis.needsReVerification = false; // Optional, not critical
    analysis.suggestedSearchTerms = ['additional sources'];
    return analysis;
  }
  
  // No significant disagreement
  return analysis;
}

/**
 * Calculate variance of an array of numbers
 * @param {number[]} numbers - Array of numbers
 * @returns {number} Variance
 * @private
 */
function calculateVariance(numbers) {
  if (!numbers || numbers.length === 0) {
    return 0;
  }
  
  const avg = average(numbers);
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
  return average(squaredDiffs);
}

/**
 * Determine aggregate verdict using majority voting
 * @param {Object} verdictCounts - Count of each verdict type
 * @param {boolean} hasStrongDisagreement - Whether TRUE and FALSE both exist
 * @returns {string} Aggregate verdict: 'TRUE' | 'FALSE' | 'UNVERIFIED'
 * @private
 */
function determineAggregateVerdict(verdictCounts, hasStrongDisagreement) {
  // Strong disagreement always results in UNVERIFIED
  if (hasStrongDisagreement) {
    return 'UNVERIFIED';
  }
  
  // Majority vote
  const total = verdictCounts.TRUE + verdictCounts.FALSE + verdictCounts.UNVERIFIED;
  
  if (verdictCounts.TRUE > total / 2) {
    return 'TRUE';
  }
  if (verdictCounts.FALSE > total / 2) {
    return 'FALSE';
  }
  
  // No clear majority - return most common verdict
  if (verdictCounts.TRUE >= verdictCounts.FALSE && verdictCounts.TRUE >= verdictCounts.UNVERIFIED) {
    return 'TRUE';
  }
  if (verdictCounts.FALSE >= verdictCounts.TRUE && verdictCounts.FALSE >= verdictCounts.UNVERIFIED) {
    return 'FALSE';
  }
  
  // Default to UNVERIFIED
  return 'UNVERIFIED';
}

/**
 * Calculate average of numbers
 * @param {number[]} numbers - Array of numbers
 * @returns {number} Average
 * @private
 */
function average(numbers) {
  if (!numbers || numbers.length === 0) {
    return 0;
  }
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Categorize confidence score
 * @param {number} confidence - Confidence score 0-100
 * @returns {string} Category: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
 * @private
 */
function categorizeConfidence(confidence) {
  if (confidence >= 90) return 'very-high';
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 25) return 'low';
  return 'very-low';
}

/**
 * Aggregate reasoning from multiple agents
 * @param {Object[]} agentResults - Agent verification results
 * @param {string} aggregateVerdict - The consensus verdict
 * @returns {string} Combined reasoning
 * @private
 */
function aggregateReasoning(agentResults, aggregateVerdict) {
  // Filter results matching the aggregate verdict
  const matchingResults = agentResults.filter(r => r.verdict === aggregateVerdict);
  
  if (matchingResults.length === 0) {
    // No matching results (strong disagreement case)
    return "Agents could not reach consensus. Results are conflicting.";
  }
  
  if (matchingResults.length === 1) {
    return matchingResults[0].reasoning;
  }
  
  // Multiple matching results - combine reasoning
  // Take the most detailed reasoning (longest)
  const sortedByLength = matchingResults.sort((a, b) => 
    (b.reasoning?.length || 0) - (a.reasoning?.length || 0)
  );
  
  return sortedByLength[0].reasoning || "Multiple agents agree on this verdict.";
}

/**
 * Collect unique sources from all agent results
 * @param {Object[]} agentResults - Agent verification results
 * @returns {Object[]} Array of unique sources
 * @private
 */
function collectUniqueSources(agentResults) {
  const sourceMap = new Map();
  
  for (const result of agentResults) {
    if (result.sources && Array.isArray(result.sources)) {
      for (const source of result.sources) {
        if (source.url) {
          // Use URL as unique key
          if (!sourceMap.has(source.url)) {
            sourceMap.set(source.url, source);
          }
        }
      }
    }
  }
  
  return Array.from(sourceMap.values());
}

/**
 * Aggregate all fact verification results
 * @param {Object[]} factResults - Array of fact verification results
 * @returns {Object[]} Array of aggregated results
 */
export function aggregateAllFacts(factResults) {
  return factResults.map(factResult => {
    try {
      return aggregateResults(factResult.agentResults);
    } catch (error) {
      console.error(`Error aggregating fact ${factResult.factId}:`, error);
      return {
        factId: factResult.factId,
        aggregateVerdict: 'UNVERIFIED',
        aggregateConfidence: 0,
        aggregateConfidenceCategory: 'very-low',
        agentResults: factResult.agentResults || [],
        hasDisagreement: true,
        disagreementNote: 'Aggregation failed: ' + error.message,
        reasoning: 'Unable to aggregate results',
        sources: []
      };
    }
  });
}

/**
 * Get consensus statistics
 * @param {Object[]} aggregatedResults - Aggregated verification results
 * @returns {Object} Statistics
 */
export function getConsensusStats(aggregatedResults) {
  const stats = {
    totalFacts: aggregatedResults.length,
    verdictCounts: {
      TRUE: 0,
      FALSE: 0,
      UNVERIFIED: 0
    },
    disagreementCount: 0,
    strongDisagreementCount: 0,
    needsReVerificationCount: 0,
    averageConfidence: 0,
    confidenceDistribution: {
      'very-high': 0,
      'high': 0,
      'medium': 0,
      'low': 0,
      'very-low': 0
    }
  };
  
  let totalConfidence = 0;
  
  for (const result of aggregatedResults) {
    stats.verdictCounts[result.aggregateVerdict]++;
    
    if (result.hasDisagreement) {
      stats.disagreementCount++;
    }
    
    if (result.disagreementType === 'strong') {
      stats.strongDisagreementCount++;
    }
    
    if (result.needsReVerification) {
      stats.needsReVerificationCount++;
    }
    
    totalConfidence += result.aggregateConfidence;
    stats.confidenceDistribution[result.aggregateConfidenceCategory]++;
  }
  
  stats.averageConfidence = aggregatedResults.length > 0
    ? Math.round(totalConfidence / aggregatedResults.length)
    : 0;
  
  return stats;
}

/**
 * Export alias for compatibility with orchestrator
 */
export const aggregateVerificationResults = aggregateResults;


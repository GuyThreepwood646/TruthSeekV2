/**
 * TruthSeek Model Quality Rankings
 * Used for deduplication tiebreaking when multiple agents extract the same fact
 * 
 * Higher rank = better quality/more recent model
 * Rankings consider: model size, recency, and capabilities
 */

import { MODEL_METADATA } from './model-metadata.js';

/**
 * Get quality rank for a specific agent
 * @param {string} agentId - Agent configuration ID
 * @returns {Promise<number>} Quality rank (0 if not found)
 */
export async function getAgentRank(agentId) {
  try {
    // Load agent config from storage
    const result = await chrome.storage.local.get(['agents']);
    const agents = result.agents || [];
    
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      console.warn(`Agent not found: ${agentId}`);
      return 0;
    }
    
    // Return stored quality rank (set during agent creation)
    if (agent.qualityRank) {
      return agent.qualityRank;
    }
    
    // Fallback: lookup from model metadata
    const metadata = MODEL_METADATA[agent.model];
    return metadata?.qualityRank || 0;
    
  } catch (error) {
    console.error('Error getting agent rank:', error);
    return 0;
  }
}

/**
 * Get quality rank for a model
 * @param {string} model - Model identifier
 * @returns {number} Quality rank (0 if not found)
 */
export function getModelRank(model) {
  const metadata = MODEL_METADATA[model];
  return metadata?.qualityRank || 0;
}

/**
 * Compare two agents by quality rank
 * @param {string} agentId1 - First agent ID
 * @param {string} agentId2 - Second agent ID
 * @returns {Promise<number>} Negative if agent1 better, positive if agent2 better, 0 if equal
 */
export async function compareAgentRanks(agentId1, agentId2) {
  const rank1 = await getAgentRank(agentId1);
  const rank2 = await getAgentRank(agentId2);
  return rank2 - rank1; // Higher rank is better
}


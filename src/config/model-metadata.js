/**
 * TruthSeek Model Metadata Configuration
 * Knowledge cutoff dates and quality rankings for all supported models
 */

/**
 * Model metadata including knowledge cutoff and quality ranking
 * Quality rank is used for deduplication tiebreaking (higher = better)
 * 
 * Ranking criteria:
 * - Newer models rank higher than older models
 * - Larger/more capable models rank higher than smaller models
 * - Same model family: latest > previous versions
 */
export const MODEL_METADATA = {
  // OpenAI Models (GPT-5 Series - December 2025)
  'gpt-5.2-pro': {
    providerId: 'openai',
    model: 'gpt-5.2-pro',
    displayName: 'GPT-5.2 Pro',
    knowledgeCutoff: 'October 2025',
    knowledgeCutoffDate: new Date('2025-10-01'),
    qualityRank: 100
  },
  'gpt-5.2': {
    providerId: 'openai',
    model: 'gpt-5.2',
    displayName: 'GPT-5.2',
    knowledgeCutoff: 'October 2025',
    knowledgeCutoffDate: new Date('2025-10-01'),
    qualityRank: 98
  },
  'gpt-5.1': {
    providerId: 'openai',
    model: 'gpt-5.1',
    displayName: 'GPT-5.1',
    knowledgeCutoff: 'August 2025',
    knowledgeCutoffDate: new Date('2025-08-01'),
    qualityRank: 96
  },
  'gpt-5-mini': {
    providerId: 'openai',
    model: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    knowledgeCutoff: 'August 2025',
    knowledgeCutoffDate: new Date('2025-08-01'),
    qualityRank: 94
  },
  'gpt-5-nano': {
    providerId: 'openai',
    model: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    knowledgeCutoff: 'August 2025',
    knowledgeCutoffDate: new Date('2025-08-01'),
    qualityRank: 92
  },
  
  // OpenAI Models (GPT-4 Series - Legacy)
  'gpt-4.1': {
    providerId: 'openai',
    model: 'gpt-4.1',
    displayName: 'GPT-4.1',
    knowledgeCutoff: 'April 2025',
    knowledgeCutoffDate: new Date('2025-04-01'),
    qualityRank: 90
  },
  'o1': {
    providerId: 'openai',
    model: 'o1',
    displayName: 'o1',
    knowledgeCutoff: 'October 2023',
    knowledgeCutoffDate: new Date('2023-10-01'),
    qualityRank: 88
  },
  'o1-mini': {
    providerId: 'openai',
    model: 'o1-mini',
    displayName: 'o1-mini',
    knowledgeCutoff: 'October 2023',
    knowledgeCutoffDate: new Date('2023-10-01'),
    qualityRank: 86
  },
  'gpt-4o': {
    providerId: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    knowledgeCutoff: 'October 2023',
    knowledgeCutoffDate: new Date('2023-10-01'),
    qualityRank: 84
  },
  'gpt-4o-mini': {
    providerId: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    knowledgeCutoff: 'October 2023',
    knowledgeCutoffDate: new Date('2023-10-01'),
    qualityRank: 80
  },
  'gpt-4-turbo': {
    providerId: 'openai',
    model: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    knowledgeCutoff: 'December 2023',
    knowledgeCutoffDate: new Date('2023-12-01'),
    qualityRank: 78
  },
  'gpt-4': {
    providerId: 'openai',
    model: 'gpt-4',
    displayName: 'GPT-4',
    knowledgeCutoff: 'September 2021',
    knowledgeCutoffDate: new Date('2021-09-01'),
    qualityRank: 75
  },
  'gpt-3.5-turbo': {
    providerId: 'openai',
    model: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    knowledgeCutoff: 'September 2021',
    knowledgeCutoffDate: new Date('2021-09-01'),
    qualityRank: 70
  },
  
  // Anthropic Models (Claude 4.5 Series - December 2025)
  'claude-opus-4-5': {
    providerId: 'anthropic',
    model: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    knowledgeCutoff: 'September 2025',
    knowledgeCutoffDate: new Date('2025-09-01'),
    qualityRank: 100
  },
  'claude-sonnet-4-5': {
    providerId: 'anthropic',
    model: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    knowledgeCutoff: 'September 2025',
    knowledgeCutoffDate: new Date('2025-09-01'),
    qualityRank: 99
  },
  'claude-haiku-4-5': {
    providerId: 'anthropic',
    model: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    knowledgeCutoff: 'September 2025',
    knowledgeCutoffDate: new Date('2025-09-01'),
    qualityRank: 97
  },
  
  // Anthropic Models (Claude 4 Series - Legacy)
  'claude-opus-4-1': {
    providerId: 'anthropic',
    model: 'claude-opus-4-1',
    displayName: 'Claude Opus 4.1',
    knowledgeCutoff: 'June 2025',
    knowledgeCutoffDate: new Date('2025-06-01'),
    qualityRank: 95
  },
  'claude-sonnet-4': {
    providerId: 'anthropic',
    model: 'claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    knowledgeCutoff: 'June 2025',
    knowledgeCutoffDate: new Date('2025-06-01'),
    qualityRank: 93
  },
  
  // Anthropic Models (Claude 3.5 Series - Legacy)
  'claude-3-5-sonnet-20241022': {
    providerId: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet (Oct 2024)',
    knowledgeCutoff: 'April 2024',
    knowledgeCutoffDate: new Date('2024-04-01'),
    qualityRank: 91
  },
  'claude-3-5-sonnet-20240620': {
    providerId: 'anthropic',
    model: 'claude-3-5-sonnet-20240620',
    displayName: 'Claude 3.5 Sonnet (Jun 2024)',
    knowledgeCutoff: 'April 2024',
    knowledgeCutoffDate: new Date('2024-04-01'),
    qualityRank: 89
  },
  'claude-3-5-haiku-20241022': {
    providerId: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    knowledgeCutoff: 'July 2024',
    knowledgeCutoffDate: new Date('2024-07-01'),
    qualityRank: 87
  },
  'claude-3-opus-20240229': {
    providerId: 'anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    knowledgeCutoff: 'August 2023',
    knowledgeCutoffDate: new Date('2023-08-01'),
    qualityRank: 85
  },
  'claude-3-sonnet-20240229': {
    providerId: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    displayName: 'Claude 3 Sonnet',
    knowledgeCutoff: 'August 2023',
    knowledgeCutoffDate: new Date('2023-08-01'),
    qualityRank: 82
  },
  'claude-3-haiku-20240307': {
    providerId: 'anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    knowledgeCutoff: 'August 2023',
    knowledgeCutoffDate: new Date('2023-08-01'),
    qualityRank: 80
  },
  
  // Google Gemini Models (Gemini 3 Series - December 2025)
  'gemini-3-pro': {
    providerId: 'google',
    model: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    knowledgeCutoff: 'November 2025',
    knowledgeCutoffDate: new Date('2025-11-01'),
    qualityRank: 100
  },
  'gemini-3-flash': {
    providerId: 'google',
    model: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    knowledgeCutoff: 'November 2025',
    knowledgeCutoffDate: new Date('2025-11-01'),
    qualityRank: 99
  },
  
  // Google Gemini Models (Gemini 2.5 Series)
  'gemini-2.5-pro': {
    providerId: 'google',
    model: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    knowledgeCutoff: 'October 2025',
    knowledgeCutoffDate: new Date('2025-10-01'),
    qualityRank: 98
  },
  'gemini-2.5-flash': {
    providerId: 'google',
    model: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    knowledgeCutoff: 'October 2025',
    knowledgeCutoffDate: new Date('2025-10-01'),
    qualityRank: 97
  },
  'gemini-2.5-flash-lite': {
    providerId: 'google',
    model: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    knowledgeCutoff: 'October 2025',
    knowledgeCutoffDate: new Date('2025-10-01'),
    qualityRank: 95
  },
  
  // Google Gemini Models (Gemini 2.0 Series - Legacy)
  'gemini-2.0-flash': {
    providerId: 'google',
    model: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    knowledgeCutoff: 'August 2024',
    knowledgeCutoffDate: new Date('2024-08-01'),
    qualityRank: 93
  },
  'gemini-2.0-flash-lite': {
    providerId: 'google',
    model: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash-Lite',
    knowledgeCutoff: 'August 2024',
    knowledgeCutoffDate: new Date('2024-08-01'),
    qualityRank: 90
  }
};

/**
 * Get metadata for a specific model
 * @param {string} model - Model identifier
 * @returns {Object|null} Model metadata or null if not found
 */
export function getModelMetadata(model) {
  return MODEL_METADATA[model] || null;
}

/**
 * Get all models for a specific provider
 * @param {string} providerId - Provider ID ('openai' | 'anthropic' | 'google')
 * @returns {Object[]} Array of model metadata objects
 */
export function getModelsForProvider(providerId) {
  return Object.values(MODEL_METADATA).filter(m => m.providerId === providerId);
}

/**
 * Get quality rank for a model (for deduplication tiebreaking)
 * @param {string} model - Model identifier
 * @returns {number} Quality rank (0 if not found)
 */
export function getModelQualityRank(model) {
  const metadata = MODEL_METADATA[model];
  return metadata ? metadata.qualityRank : 0;
}


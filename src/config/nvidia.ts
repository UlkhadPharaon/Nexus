export const NVIDIA_CONFIG = {
  baseURL: import.meta.env.VITE_NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: import.meta.env.VITE_NVIDIA_API_KEY,
  models: {
    'mistral-small': {
      id: 'mistralai/mistral-small-4-119b-2603',
      displayName: 'Mistral Small 4',
      description: 'Modèle standard — équilibré et performant',
      maxTokens: 16384,
      temperature: 0.8,
      topP: 0.95,
      badge: 'Standard',
      badgeColor: 'blue',
    },
    'nemotron-nano': {
      id: 'nvidia/nemotron-3-super-120b-a12b',
      displayName: 'Nemotron 3 Super',
      description: 'Mode Créatif — moins de limites, plus d\'imagination',
      maxTokens: 16384,
      temperature: 1.0,
      topP: 0.98,
      badge: 'Créatif',
      badgeColor: 'purple',
    },
  },
};

export type ModelKey = keyof typeof NVIDIA_CONFIG.models;

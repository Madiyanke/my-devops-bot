export type ProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'xai'
  | 'perplexity'
  | 'ollama'
  | 'custom';

/** Protocole d'API : la plupart des fournisseurs sont compatibles OpenAI. */
export type ProviderKind = 'openai' | 'gemini' | 'anthropic';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  /** Variables d'environnement reconnues côté serveur. */
  envKeys: string[];
  keyHint: string;
  keyUrl?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    // Alias maintenu par Google vers le modèle « flash » courant.
    defaultModel: 'gemini-flash-latest',
    requiresKey: true,
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    requiresKey: true,
    envKeys: ['OPENAI_API_KEY', 'OPEN_AI_KEY'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-5-5',
    requiresKey: true,
    envKeys: ['ANTHROPIC_API_KEY'],
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    requiresKey: true,
    envKeys: ['MISTRAL_API_KEY'],
    keyHint: '32 caractères',
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresKey: true,
    envKeys: ['GROQ_API_KEY'],
    keyHint: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    requiresKey: true,
    envKeys: ['OPENROUTER_API_KEY'],
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresKey: true,
    envKeys: ['DEEPSEEK_API_KEY'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  xai: {
    id: 'xai',
    label: 'xAI Grok',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    requiresKey: true,
    envKeys: ['XAI_API_KEY'],
    keyHint: 'xai-…',
    keyUrl: 'https://console.x.ai',
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    requiresKey: true,
    envKeys: ['PERPLEXITY_API_KEY'],
    keyHint: 'pplx-…',
    keyUrl: 'https://www.perplexity.ai/settings/api',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    requiresKey: false,
    envKeys: [],
    keyHint: 'aucune clé',
  },
  custom: {
    id: 'custom',
    label: 'Compatible OpenAI (URL personnalisée)',
    kind: 'openai',
    baseUrl: '',
    defaultModel: '',
    requiresKey: false,
    envKeys: [],
    keyHint: 'selon le service',
  },
};

/** Ordre de préférence quand plusieurs clés sont présentes côté serveur. */
export const SERVER_PRIORITY: ProviderId[] = [
  'gemini',
  'anthropic',
  'openai',
  'mistral',
  'groq',
  'openrouter',
  'deepseek',
  'xai',
  'perplexity',
];

export function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(PROVIDERS, value);
}

/** Devine le fournisseur à partir du préfixe de la clé. */
export function detectProvider(apiKey: string): ProviderId | null {
  const key = apiKey.trim();
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('xai-')) return 'xai';
  if (key.startsWith('pplx-')) return 'perplexity';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

/** Modèles de raisonnement OpenAI : n'acceptent pas de température personnalisée. */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model);
}

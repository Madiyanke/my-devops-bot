/** Détection du fournisseur à partir du préfixe de la clé (miroir du backend). */
export function detectProvider(apiKey: string): string | null {
  const key = apiKey.trim();
  if (!key) return null;
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('xai-')) return 'xai';
  if (key.startsWith('pplx-')) return 'perplexity';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

export function maskKey(apiKey: string): string {
  const key = apiKey.trim();
  return key.length <= 10 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

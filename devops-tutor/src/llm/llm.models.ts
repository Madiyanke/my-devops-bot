import type { ProviderId } from './llm.catalog';

/**
 * Choix automatique d'un modèle de remplacement quand le modèle par défaut
 * a été retiré par le fournisseur (les noms changent souvent).
 */

/** Modèle explicitement recommandé dans le message d'erreur du fournisseur. */
export function suggestedModel(message: string): string | null {
  const match = /\buse\s+(?:models\/)?([a-z][\w.-]*\d[\w.-]*)/i.exec(message);
  return match ? match[1].replace(/[.,;]+$/, '') : null;
}

/** Variantes spécialisées à éviter pour un usage conversationnel. */
const SPECIALIZED =
  /(preview|exp|experimental|image|tts|audio|live|embed|vision|lite|nano|omni|thinking|search|realtime|transcribe|robotics|computer|gemma|learnlm|aqa|instruct|codex|\d{4}-\d{2}|\d{3,}$)/i;

/** Compare des identifiants par numéro de version (le plus récent d'abord). */
function versionOf(id: string): number[] {
  return (id.match(/\d+(?:\.\d+)*/)?.[0] ?? '0').split('.').map(Number);
}
function byVersionDesc(a: string, b: string): number {
  const va = versionOf(a);
  const vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (vb[i] ?? 0) - (va[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.length - b.length; // à version égale : le nom le plus simple
}

const PREFERENCES: Partial<Record<ProviderId, RegExp[]>> = {
  // Les modèles « flash » ont un quota gratuit et sont rapides.
  gemini: [
    /^gemini-flash-latest$/,
    /^gemini-\d+(\.\d+)?-flash$/,
    /^gemini-.*flash/,
    /^gemini-/,
  ],
  openai: [/^gpt-[\d.]+-mini$/, /^gpt-[\d.]+o?$/, /^gpt-/],
  anthropic: [/^claude-sonnet-/, /^claude-/],
  mistral: [/^mistral-(large|medium)-latest$/, /^mistral-/],
  groq: [/^llama-[\d.]+-70b/, /^llama-/],
};

/** Sélectionne le meilleur modèle généraliste disponible. */
export function pickBestModel(
  provider: ProviderId,
  models: string[],
): string | null {
  const general = models.filter((m) => !SPECIALIZED.test(m));
  for (const pattern of PREFERENCES[provider] ?? []) {
    const candidates = general
      .filter((m) => pattern.test(m))
      .sort(byVersionDesc);
    if (candidates.length > 0) return candidates[0];
  }
  return general.sort(byVersionDesc)[0] ?? models[0] ?? null;
}

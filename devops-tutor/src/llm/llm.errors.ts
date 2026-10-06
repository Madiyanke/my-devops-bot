import type { Response } from 'undici';
import { truncate } from '../common/text';

export type LlmErrorCode =
  | 'no_key'
  | 'unknown_provider'
  | 'missing_key'
  | 'missing_model'
  | 'base_url_forbidden'
  | 'invalid_key'
  | 'model_not_found'
  | 'rate_limited'
  | 'provider_down'
  | 'provider_error'
  | 'timeout'
  | 'network';

const HTTP_STATUS: Record<LlmErrorCode, number> = {
  no_key: 503,
  unknown_provider: 400,
  missing_key: 400,
  missing_model: 400,
  base_url_forbidden: 400,
  invalid_key: 401,
  model_not_found: 400,
  rate_limited: 429,
  provider_down: 502,
  provider_error: 502,
  timeout: 504,
  network: 502,
};

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

interface ProviderErrorBody {
  error?: { message?: string } | string;
  message?: string;
}

function providerMessage(raw: string): string {
  try {
    let body = JSON.parse(raw) as ProviderErrorBody | ProviderErrorBody[];
    if (Array.isArray(body)) body = body[0] ?? {};
    const message =
      typeof body.error === 'string'
        ? body.error
        : (body.error?.message ?? body.message);
    if (message) return message;
  } catch {
    // corps non JSON : on garde le texte brut
  }
  return raw;
}

/** Traduit une réponse HTTP d'erreur d'un fournisseur en message clair. */
export async function errorFromResponse(
  res: Response,
  label: string,
  model: string,
): Promise<LlmError> {
  const raw = await res.text().catch(() => '');
  const detail = truncate(
    providerMessage(raw).replace(/\s+/g, ' ').trim(),
    300,
  );
  const suffix = detail ? ` — ${detail}` : '';
  const status = res.status;

  if (status === 401 || status === 403 || /api key not valid/i.test(detail)) {
    return new LlmError(
      'invalid_key',
      `Clé API refusée par ${label} (HTTP ${status})${suffix}`,
    );
  }
  if (status === 404) {
    return new LlmError(
      'model_not_found',
      `Modèle « ${model} » introuvable chez ${label}. Choisissez un modèle disponible dans ⚙ Paramètres.${suffix}`,
    );
  }
  if (status === 429) {
    return new LlmError(
      'rate_limited',
      `Quota ou limite de débit atteint chez ${label}${suffix}`,
    );
  }
  if (status >= 500) {
    return new LlmError(
      'provider_down',
      `${label} est indisponible (HTTP ${status})${suffix}`,
    );
  }
  return new LlmError(
    'provider_error',
    `Erreur ${label} (HTTP ${status})${suffix}`,
  );
}

/** Normalise les erreurs réseau / timeout levées par fetch. */
export function toLlmError(error: unknown, label: string): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new LlmError('timeout', `${label} n'a pas répondu à temps.`);
  }
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : String(error);
  return new LlmError(
    'network',
    `Impossible de joindre ${label} : ${truncate(cause, 200)}`,
  );
}

export function httpStatusFor(code: string): number {
  return HTTP_STATUS[code as LlmErrorCode] ?? 500;
}

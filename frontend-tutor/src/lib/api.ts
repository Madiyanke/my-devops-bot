import type { Depth, LlmOverride, ServerConfig, TutorEvent } from './types';

const API_URL: string = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(message || `Erreur serveur (${res.status})`, res.status, data.code);
  }
  return data as T;
}

export async function fetchConfig(): Promise<ServerConfig> {
  const res = await fetch(`${API_URL}/tutor/config`);
  if (!res.ok) throw new ApiError(`Backend indisponible (${res.status})`, res.status);
  return (await res.json()) as ServerConfig;
}

export function testLlm(llm?: LlmOverride) {
  return postJson<{ providerLabel: string; model: string; latencyMs: number }>('/tutor/llm/test', { llm });
}

export function listModels(llm?: LlmOverride) {
  return postJson<{ models: string[] }>('/tutor/llm/models', { llm });
}

/** Découpe un flux Server-Sent Events en évènements JSON. */
export function createSseParser(onEvent: (event: TutorEvent) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer = (buffer + chunk).replace(/\r\n/g, '\n');
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      try {
        onEvent(JSON.parse(data) as TutorEvent);
      } catch {
        // évènement incomplet ou invalide : ignoré
      }
    }
  };
}

export interface AskPayload {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  depth: Depth;
  llm?: LlmOverride;
}

/** Pose une question et reçoit les étapes, les sources et la réponse en temps réel. */
export async function streamAsk(
  payload: AskPayload,
  onEvent: (event: TutorEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/tutor/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(message || `Erreur serveur (${res.status})`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parse = createSseParser(onEvent);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parse(decoder.decode(value, { stream: true }));
  }
  parse('\n\n');
}

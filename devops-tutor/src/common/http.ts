import {
  EnvHttpProxyAgent,
  fetch,
  type Dispatcher,
  type Response,
} from 'undici';

export const USER_AGENT =
  'Mozilla/5.0 (compatible; DevOpsMentor/2.0; +educational research assistant)';

const PROXY_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
let proxyDispatcher: Dispatcher | undefined;

/** Utilise le proxy d'entreprise (HTTPS_PROXY / NO_PROXY) uniquement s'il est défini. */
function dispatcher(): Dispatcher | undefined {
  if (!PROXY_VARS.some((name) => process.env[name])) return undefined;
  proxyDispatcher ??= new EnvHttpProxyAgent();
  return proxyDispatcher;
}

export interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function httpFetch(
  url: string,
  options: HttpOptions = {},
): Promise<Response> {
  const { timeoutMs = 15_000, signal, headers, ...init } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
    ...init,
    headers: { 'user-agent': USER_AGENT, ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    dispatcher: dispatcher(),
  });
}

/** Extrait le champ `data:` d'un évènement Server-Sent Events brut. */
export function parseSseEvent(raw: string): string | null {
  const lines = raw.split('\n').filter((line) => line.startsWith('data:'));
  if (lines.length === 0) return null;
  return lines.map((line) => line.slice(5).replace(/^ /, '')).join('\n');
}

/** Lit un flux SSE et renvoie le contenu `data:` de chaque évènement. */
export async function* readSseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = (await reader.read()) as {
        done: boolean;
        value?: Uint8Array;
      };
      if (done || !value) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        '\n',
      );
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const data = parseSseEvent(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (data !== null) yield data;
      }
    }
    const tail = parseSseEvent(buffer.trim());
    if (tail !== null) yield tail;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

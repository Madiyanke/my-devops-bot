import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { LlmError } from './llm.errors';
import { LlmService } from './llm.service';

/** Faux fournisseurs : reproduisent le format SSE de chaque API. */
const FIXTURES: Record<string, string[]> = {
  '/gemini/models/gemini-test:streamGenerateContent': [
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: 'Réflexion', thought: true }] } },
      ],
    }),
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Bonjour ' }] } }],
    }),
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Gemini' }] } }],
    }),
  ],
  '/openai/chat/completions': [
    JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }),
    JSON.stringify({ choices: [{ delta: { content: 'Bonjour ' } }] }),
    JSON.stringify({ choices: [{ delta: { content: 'OpenAI' } }] }),
    '[DONE]',
  ],
  '/anthropic/messages': [
    JSON.stringify({ type: 'message_start' }),
    JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Bonjour ' },
    }),
    JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Claude' },
    }),
    JSON.stringify({ type: 'message_stop' }),
  ],
};

describe('LlmService.stream (protocoles)', () => {
  let server: Server;
  let base: string;
  const requests: {
    url: string;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        requests.push({ url: req.url ?? '', headers: req.headers, body });
        const path = (req.url ?? '').split('?')[0];
        if (path.startsWith('/fail')) {
          res.writeHead(429, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'quota exceeded' } }));
          return;
        }
        const events = FIXTURES[path];
        if (!events) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const data of events)
          res.write(`event: x\r\ndata: ${data}\r\n\r\n`);
        res.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const serviceFor = (provider: string, path: string, model: string) =>
    new LlmService({
      get: (key: string) =>
        ({
          LLM_PROVIDER: provider,
          LLM_API_KEY: 'test-key',
          LLM_BASE_URL: `${base}${path}`,
          LLM_MODEL: model,
        })[key],
    } as unknown as ConfigService);

  const ask = {
    system: 'sys',
    messages: [{ role: 'user' as const, content: 'Salut' }],
  };

  it('Gemini : ignore les pensées et envoie la clé en en-tête', async () => {
    const llm = serviceFor('gemini', '/gemini', 'gemini-test');
    expect(await llm.complete(llm.resolve(), ask)).toBe('Bonjour Gemini');
    const req = requests.at(-1)!;
    expect(req.headers['x-goog-api-key']).toBe('test-key');
    expect(req.url).toContain('alt=sse');
    expect(JSON.parse(req.body)).toMatchObject({
      systemInstruction: { parts: [{ text: 'sys' }] },
    });
  });

  it('OpenAI-compatible : agrège les deltas jusqu’à [DONE]', async () => {
    const llm = serviceFor('openai', '/openai', 'gpt-test');
    expect(await llm.complete(llm.resolve(), ask)).toBe('Bonjour OpenAI');
    expect(requests.at(-1)!.headers.authorization).toBe('Bearer test-key');
  });

  it('Anthropic : lit les content_block_delta', async () => {
    const llm = serviceFor('anthropic', '/anthropic', 'claude-test');
    expect(await llm.complete(llm.resolve(), ask)).toBe('Bonjour Claude');
    const req = requests.at(-1)!;
    expect(req.headers['x-api-key']).toBe('test-key');
    expect(req.headers['anthropic-version']).toBeDefined();
  });

  it('traduit les erreurs HTTP en messages clairs', async () => {
    const llm = serviceFor('openai', '/fail', 'gpt-test');
    const error = await llm
      .complete(llm.resolve(), ask)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ code: 'rate_limited' });
    expect((error as LlmError).message).toContain('quota exceeded');
  });

  it('signale un modèle introuvable', async () => {
    const llm = serviceFor('openai', '/unknown', 'gpt-test');
    await expect(llm.complete(llm.resolve(), ask)).rejects.toMatchObject({
      code: 'model_not_found',
    });
  });
});

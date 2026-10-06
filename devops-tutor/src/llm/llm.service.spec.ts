import { ConfigService } from '@nestjs/config';
import { detectProvider } from './llm.catalog';
import { LlmError } from './llm.errors';
import { LlmService } from './llm.service';

const serviceWith = (env: Record<string, string>) =>
  new LlmService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);

describe('detectProvider', () => {
  it.each([
    ['AIzaSyExample', 'gemini'],
    ['sk-ant-api03-xxx', 'anthropic'],
    ['sk-or-v1-xxx', 'openrouter'],
    ['gsk_xxx', 'groq'],
    ['xai-xxx', 'xai'],
    ['pplx-xxx', 'perplexity'],
    ['sk-proj-xxx', 'openai'],
    ['  sk-xxx  ', 'openai'],
  ])('%s → %s', (key, provider) => {
    expect(detectProvider(key)).toBe(provider);
  });

  it('renvoie null pour une clé sans préfixe connu', () => {
    expect(detectProvider('abcdef0123456789')).toBeNull();
  });
});

describe('LlmService.resolve', () => {
  it('utilise la clé Gemini du serveur par défaut', () => {
    const cfg = serviceWith({ GEMINI_API_KEY: 'AIzaServer' }).resolve();
    expect(cfg).toMatchObject({
      provider: 'gemini',
      apiKey: 'AIzaServer',
      model: 'gemini-2.5-flash',
      source: 'server',
    });
  });

  it('ignore les placeholders non substitués', () => {
    const service = serviceWith({ OPENAI_API_KEY: '${OPENAI_API_KEY}' });
    expect(service.serverConfig()).toBeNull();
    expect(() => service.resolve()).toThrow(LlmError);
  });

  it('privilégie la clé fournie par le client et détecte son fournisseur', () => {
    const cfg = serviceWith({ GEMINI_API_KEY: 'AIzaServer' }).resolve({
      apiKey: 'sk-ant-client',
    });
    expect(cfg).toMatchObject({
      provider: 'anthropic',
      apiKey: 'sk-ant-client',
      source: 'client',
    });
  });

  it('respecte LLM_PROVIDER / LLM_MODEL / LLM_API_KEY', () => {
    const cfg = serviceWith({
      LLM_PROVIDER: 'mistral',
      LLM_API_KEY: 'mistral-key',
      LLM_MODEL: 'mistral-small-latest',
    }).resolve();
    expect(cfg).toMatchObject({
      provider: 'mistral',
      model: 'mistral-small-latest',
      baseUrl: 'https://api.mistral.ai/v1',
    });
  });

  it('exige un fournisseur explicite si la clé est inconnue', () => {
    expect(() => serviceWith({}).resolve({ apiKey: 'opaque-key' })).toThrow(
      /fournisseur/,
    );
  });

  it('refuse une URL personnalisée sauf si ALLOW_CUSTOM_BASE_URL=true', () => {
    const override = {
      provider: 'ollama',
      baseUrl: 'http://ollama:11434/v1',
      model: 'llama3.1',
    };
    expect(() => serviceWith({}).resolve(override)).toThrow(LlmError);
    const cfg = serviceWith({ ALLOW_CUSTOM_BASE_URL: 'true' }).resolve(
      override,
    );
    expect(cfg.baseUrl).toBe('http://ollama:11434/v1');
  });

  it('permet de changer seulement le modèle de la config serveur', () => {
    const cfg = serviceWith({ GEMINI_API_KEY: 'AIzaServer' }).resolve({
      model: 'gemini-2.5-pro',
    });
    expect(cfg).toMatchObject({ provider: 'gemini', model: 'gemini-2.5-pro' });
  });
});

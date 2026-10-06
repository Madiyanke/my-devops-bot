import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'undici';
import { httpFetch, readSseData } from '../common/http';
import {
  PROVIDERS,
  SERVER_PRIORITY,
  detectProvider,
  isProviderId,
  isReasoningModel,
  type ProviderId,
} from './llm.catalog';
import { LlmError, errorFromResponse, toLlmError } from './llm.errors';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmOverride {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface LlmConfig {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  baseUrl: string;
  source: 'server' | 'client';
}

export interface LlmRequest {
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface OpenAiChunk {
  choices?: { delta?: { content?: string | null } }[];
  error?: { message?: string };
}
interface GeminiChunk {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}
interface AnthropicEvent {
  type?: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
}
interface ModelList {
  data?: { id: string }[];
  models?: { name: string; supportedGenerationMethods?: string[] }[];
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService) {}

  /** Lit une variable d'env en ignorant les placeholders non substitués (${VAR}). */
  private env(key: string): string | undefined {
    const value = this.config.get<string>(key)?.trim();
    return value && !value.includes('${') ? value : undefined;
  }

  private firstEnv(keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.env(key);
      if (value) return value;
    }
    return undefined;
  }

  get allowCustomBaseUrl(): boolean {
    return this.env('ALLOW_CUSTOM_BASE_URL') === 'true';
  }

  /** Configuration définie côté serveur (variables d'environnement), si présente. */
  serverConfig(): LlmConfig | null {
    const explicit = this.env('LLM_PROVIDER');
    const genericKey = this.env('LLM_API_KEY');
    let provider: ProviderId | null = null;
    let apiKey: string | undefined;

    if (explicit && isProviderId(explicit)) {
      provider = explicit;
      apiKey = genericKey ?? this.firstEnv(PROVIDERS[explicit].envKeys);
    } else if (genericKey) {
      provider = detectProvider(genericKey);
      apiKey = genericKey;
    }
    if (!provider) {
      for (const id of SERVER_PRIORITY) {
        const key = this.firstEnv(PROVIDERS[id].envKeys);
        if (key) {
          provider = id;
          apiKey = key;
          break;
        }
      }
    }
    if (!provider) return null;

    const info = PROVIDERS[provider];
    const baseUrl = this.env('LLM_BASE_URL') ?? info.baseUrl;
    const model = this.env('LLM_MODEL') ?? info.defaultModel;
    if ((info.requiresKey && !apiKey) || !baseUrl || !model) return null;
    return {
      provider,
      apiKey,
      model,
      baseUrl: trimSlash(baseUrl),
      source: 'server',
    };
  }

  /** Choisit la configuration : clé fournie par l'utilisateur, sinon celle du serveur. */
  resolve(override?: LlmOverride): LlmConfig {
    const apiKey = override?.apiKey?.trim() || undefined;
    const model = override?.model?.trim() || undefined;
    const baseUrl = override?.baseUrl?.trim() || undefined;
    const wanted =
      override?.provider && override.provider !== 'auto'
        ? override.provider
        : undefined;

    if (!apiKey && !wanted) {
      const server = this.serverConfig();
      if (!server) {
        throw new LlmError(
          'no_key',
          'Aucune IA configurée : ajoutez votre clé API dans ⚙ Paramètres, ou définissez GEMINI_API_KEY (ou LLM_API_KEY) côté serveur.',
        );
      }
      return { ...server, model: model ?? server.model };
    }

    const provider = wanted ?? detectProvider(apiKey ?? '');
    if (!provider || !isProviderId(provider)) {
      throw new LlmError(
        'unknown_provider',
        'Impossible de reconnaître le fournisseur à partir de cette clé : sélectionnez-le dans ⚙ Paramètres.',
      );
    }
    const info = PROVIDERS[provider];

    if (info.requiresKey && !apiKey) {
      const server = this.serverConfig();
      if (server?.provider === provider) {
        return { ...server, model: model ?? server.model };
      }
      throw new LlmError(
        'missing_key',
        `Aucune clé API fournie pour ${info.label}.`,
      );
    }
    if (baseUrl && !this.allowCustomBaseUrl) {
      throw new LlmError(
        'base_url_forbidden',
        "Les URL d'API personnalisées sont désactivées sur ce serveur (ALLOW_CUSTOM_BASE_URL=true pour les autoriser).",
      );
    }
    const finalBaseUrl = baseUrl ?? info.baseUrl;
    const finalModel = model ?? info.defaultModel;
    if (!finalBaseUrl) {
      throw new LlmError(
        'missing_model',
        `Indiquez l'URL de l'API pour ${info.label}.`,
      );
    }
    if (!finalModel) {
      throw new LlmError(
        'missing_model',
        `Indiquez le nom du modèle pour ${info.label}.`,
      );
    }
    return {
      provider,
      apiKey,
      model: finalModel,
      baseUrl: trimSlash(finalBaseUrl),
      source: 'client',
    };
  }

  label(cfg: LlmConfig): string {
    return PROVIDERS[cfg.provider].label;
  }

  /** Génère la réponse morceau par morceau, quel que soit le fournisseur. */
  async *stream(cfg: LlmConfig, req: LlmRequest): AsyncGenerator<string> {
    const label = this.label(cfg);
    let res: Response;
    try {
      res = await this.send(cfg, req);
    } catch (error) {
      throw toLlmError(error, label);
    }
    if (!res.ok) throw await errorFromResponse(res, label, cfg.model);

    try {
      for await (const data of readSseData(res)) {
        const text = this.parseChunk(cfg, data, label);
        if (text) yield text;
      }
    } catch (error) {
      throw toLlmError(error, label);
    }
  }

  async complete(cfg: LlmConfig, req: LlmRequest): Promise<string> {
    let text = '';
    for await (const chunk of this.stream(cfg, req)) text += chunk;
    return text;
  }

  async listModels(cfg: LlmConfig): Promise<string[]> {
    const info = PROVIDERS[cfg.provider];
    let url = `${cfg.baseUrl}/models`;
    const headers: Record<string, string> = {};
    if (info.kind === 'gemini') {
      url += '?pageSize=200';
      headers['x-goog-api-key'] = cfg.apiKey ?? '';
    } else if (info.kind === 'anthropic') {
      url += '?limit=100';
      Object.assign(headers, this.anthropicHeaders(cfg));
    } else if (cfg.apiKey) {
      headers.authorization = `Bearer ${cfg.apiKey}`;
    }

    let res: Response;
    try {
      res = await httpFetch(url, { headers, timeoutMs: 15_000 });
    } catch (error) {
      throw toLlmError(error, info.label);
    }
    if (!res.ok) throw await errorFromResponse(res, info.label, cfg.model);
    const body = (await res.json()) as ModelList;

    const ids =
      info.kind === 'gemini'
        ? (body.models ?? [])
            .filter((m) =>
              m.supportedGenerationMethods?.includes('generateContent'),
            )
            .map((m) => m.name.replace(/^models\//, ''))
        : (body.data ?? [])
            .map((m) => m.id)
            .filter(
              (id) =>
                !/(embed|tts|whisper|dall-e|davinci|babbage|moderation|image|audio|realtime|transcribe|search-preview)/i.test(
                  id,
                ),
            );
    return [...new Set(ids)].sort();
  }

  private anthropicHeaders(cfg: LlmConfig): Record<string, string> {
    return {
      'x-api-key': cfg.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    };
  }

  private send(cfg: LlmConfig, req: LlmRequest): Promise<Response> {
    const info = PROVIDERS[cfg.provider];
    const timeoutMs = req.timeoutMs ?? 180_000;
    const common = { method: 'POST' as const, timeoutMs, signal: req.signal };

    if (info.kind === 'gemini') {
      const model = cfg.model.replace(/^models\//, '');
      return httpFetch(
        `${cfg.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          ...common,
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': cfg.apiKey ?? '',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: req.temperature,
              ...(req.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        },
      );
    }

    if (info.kind === 'anthropic') {
      return httpFetch(`${cfg.baseUrl}/messages`, {
        ...common,
        headers: {
          'content-type': 'application/json',
          ...this.anthropicHeaders(cfg),
        },
        body: JSON.stringify({
          model: cfg.model,
          system: req.system,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 8192,
          temperature: req.temperature,
          stream: true,
        }),
      });
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
    if (cfg.provider === 'openrouter') headers['x-title'] = 'DevOps Mentor';

    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      stream: true,
    };
    if (req.temperature !== undefined && !isReasoningModel(cfg.model)) {
      body.temperature = req.temperature;
    }
    if (req.json && cfg.provider === 'openai') {
      body.response_format = { type: 'json_object' };
    }
    return httpFetch(`${cfg.baseUrl}/chat/completions`, {
      ...common,
      headers,
      body: JSON.stringify(body),
    });
  }

  private parseChunk(cfg: LlmConfig, data: string, label: string): string {
    if (data === '[DONE]') return '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return '';
    }
    const kind = PROVIDERS[cfg.provider].kind;

    if (kind === 'gemini') {
      const chunk = parsed as GeminiChunk;
      if (chunk.error?.message) {
        throw new LlmError(
          'provider_error',
          `${label} : ${chunk.error.message}`,
        );
      }
      if (chunk.promptFeedback?.blockReason) {
        throw new LlmError(
          'provider_error',
          `${label} a bloqué la requête (${chunk.promptFeedback.blockReason}).`,
        );
      }
      return (chunk.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('');
    }

    if (kind === 'anthropic') {
      const event = parsed as AnthropicEvent;
      if (event.type === 'error') {
        throw new LlmError(
          event.error?.message?.includes('overloaded')
            ? 'provider_down'
            : 'provider_error',
          `${label} : ${event.error?.message ?? 'erreur inconnue'}`,
        );
      }
      return event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
        ? (event.delta.text ?? '')
        : '';
    }

    const chunk = parsed as OpenAiChunk;
    if (chunk.error?.message) {
      throw new LlmError('provider_error', `${label} : ${chunk.error.message}`);
    }
    return chunk.choices?.[0]?.delta?.content ?? '';
  }
}

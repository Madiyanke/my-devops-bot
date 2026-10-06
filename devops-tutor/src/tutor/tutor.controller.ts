import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PROVIDERS } from '../llm/llm.catalog';
import { LlmError, httpStatusFor } from '../llm/llm.errors';
import { LlmService } from '../llm/llm.service';
import { ResearchService } from '../research/research.service';
import { AskDto, LlmCheckDto } from './tutor.dto';
import {
  TutorService,
  type PublicSource,
  type TutorEvent,
} from './tutor.service';

const toHttp = (error: unknown): unknown =>
  error instanceof LlmError
    ? new HttpException(
        {
          statusCode: error.httpStatus,
          code: error.code,
          message: error.message,
        },
        error.httpStatus,
      )
    : error;

@Controller('tutor')
export class TutorController {
  constructor(
    private readonly tutor: TutorService,
    private readonly llm: LlmService,
    private readonly research: ResearchService,
  ) {}

  /** Capacités du serveur (jamais les clés elles-mêmes). */
  @Get('config')
  config() {
    const server = this.llm.serverConfig();
    return {
      server: server
        ? {
            provider: server.provider,
            providerLabel: PROVIDERS[server.provider].label,
            model: server.model,
          }
        : null,
      providers: Object.values(PROVIDERS).map((p) => ({
        id: p.id,
        label: p.label,
        defaultModel: p.defaultModel,
        requiresKey: p.requiresKey,
        keyHint: p.keyHint,
        keyUrl: p.keyUrl ?? null,
        needsBaseUrl: p.id === 'custom' || p.id === 'ollama',
      })),
      search: this.research
        .enabledProviders()
        .map((p) => ({ id: p.id, label: p.label, kind: p.kind })),
      allowCustomBaseUrl: this.llm.allowCustomBaseUrl,
    };
  }

  /** Réponse en streaming (Server-Sent Events) : étapes, sources puis texte. */
  @Post('ask/stream')
  async askStream(@Body() dto: AskDto, @Res() res: Response): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
    const send = (event: TutorEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.tutor.run(dto, send, controller.signal);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  /** Variante non streamée (compatibilité / intégrations). */
  @Post('ask')
  @HttpCode(200)
  async ask(@Body() dto: AskDto) {
    let answer = '';
    let sources: PublicSource[] = [];
    let meta: Extract<TutorEvent, { type: 'meta' }> | undefined;
    let failure: Extract<TutorEvent, { type: 'error' }> | undefined;

    await this.tutor.run(
      dto,
      (event) => {
        if (event.type === 'token') answer += event.text;
        else if (event.type === 'sources') sources = event.sources;
        else if (event.type === 'meta') meta = event;
        else if (event.type === 'error') failure = event;
      },
      new AbortController().signal,
    );

    if (failure) {
      const status = httpStatusFor(failure.code);
      throw new HttpException(
        { statusCode: status, code: failure.code, message: failure.message },
        status,
      );
    }
    return {
      tutor_response: answer,
      sources,
      provider: meta?.provider,
      model: meta?.model,
    };
  }

  /** Vérifie qu'une clé / un modèle fonctionne réellement. */
  @Post('llm/test')
  @HttpCode(200)
  async test(@Body() dto: LlmCheckDto) {
    try {
      const cfg = this.llm.resolve(dto.llm);
      const started = Date.now();
      const reply = await this.llm.complete(cfg, {
        system: 'Tu réponds uniquement par le mot OK.',
        messages: [{ role: 'user', content: 'Test de connexion.' }],
        maxTokens: 16,
        timeoutMs: 30_000,
      });
      return {
        ok: true,
        provider: cfg.provider,
        providerLabel: PROVIDERS[cfg.provider].label,
        model: cfg.model,
        latencyMs: Date.now() - started,
        reply: reply.trim().slice(0, 40),
      };
    } catch (error) {
      throw toHttp(error);
    }
  }

  /** Liste les modèles disponibles pour la clé fournie. */
  @Post('llm/models')
  @HttpCode(200)
  async models(@Body() dto: LlmCheckDto) {
    try {
      const cfg = this.llm.resolve(dto.llm);
      return { provider: cfg.provider, models: await this.llm.listModels(cfg) };
    } catch (error) {
      throw toHttp(error);
    }
  }
}

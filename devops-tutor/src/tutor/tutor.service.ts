import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Histogram } from 'prom-client';
import { LlmError } from '../llm/llm.errors';
import {
  LlmService,
  type ChatMessage,
  type LlmConfig,
} from '../llm/llm.service';
import {
  ResearchService,
  type Depth,
  type Source,
} from '../research/research.service';
import {
  MENTOR_SYSTEM_PROMPT,
  answerPrompt,
  parsePlan,
  planPrompt,
  type ResearchPlan,
} from './prompts';
import type { AskDto } from './tutor.dto';

export type StepId = 'plan' | 'search' | 'read' | 'answer';

export interface PublicSource extends Omit<Source, 'excerpt'> {
  chars: number;
}

export type TutorEvent =
  | {
      type: 'meta';
      provider: string;
      providerLabel: string;
      model: string;
      depth: Depth;
    }
  | {
      type: 'step';
      id: StepId;
      status: 'running' | 'done' | 'skipped' | 'error';
      detail?: string;
      ms?: number;
    }
  | { type: 'plan'; topic: string; level: string; queries: string[] }
  | { type: 'sources'; sources: PublicSource[] }
  | { type: 'token'; text: string }
  | { type: 'done'; ms: number }
  | { type: 'error'; code: string; message: string };

const QUERY_COUNT: Record<Depth, number> = { standard: 3, deep: 5 };
const HISTORY_LIMIT = 8;

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly research: ResearchService,
    @InjectMetric('tutor_questions_total')
    private readonly questions: Counter<string>,
    @InjectMetric('tutor_answer_duration_seconds')
    private readonly duration: Histogram<string>,
  ) {}

  /** Pipeline complet : planification → recherche → lecture → synthèse sourcée. */
  async run(
    dto: AskDto,
    emit: (event: TutorEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const started = Date.now();
    const depth: Depth = dto.depth ?? 'standard';
    const today = new Date().toISOString().slice(0, 10);
    const question = dto.message.trim();
    const history: ChatMessage[] = (dto.history ?? [])
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    let cfg: LlmConfig | undefined;
    let step: StepId = 'plan';

    try {
      cfg = this.llm.resolve(dto.llm);
      const announce = (c: LlmConfig) =>
        emit({
          type: 'meta',
          provider: c.provider,
          providerLabel: this.llm.label(c),
          model: c.model,
          depth,
        });
      announce(cfg);
      const initialModel = cfg.model;

      // 1. Planification des recherches
      let t = Date.now();
      emit({ type: 'step', id: 'plan', status: 'running' });
      const plan = await this.plan(
        cfg,
        question,
        history,
        depth,
        today,
        signal,
      );
      emit({
        type: 'plan',
        topic: plan.topic,
        level: plan.level,
        queries: plan.queries,
      });
      emit({
        type: 'step',
        id: 'plan',
        status: 'done',
        ms: Date.now() - t,
        detail: plan.needsResearch
          ? `${plan.queries.length} requête(s) · niveau ${plan.level}`
          : 'Aucune recherche nécessaire',
      });
      // Le modèle par défaut a pu être remplacé automatiquement pendant la planification.
      if (cfg.model !== initialModel) announce(cfg);

      // 2. Recherche + 3. Lecture
      let sources: Source[] = [];
      if (plan.needsResearch) {
        step = 'search';
        t = Date.now();
        emit({ type: 'step', id: 'search', status: 'running' });
        const outcome = await this.research.search(plan.queries, depth, signal);
        emit({
          type: 'step',
          id: 'search',
          status: outcome.candidates.length > 0 ? 'done' : 'error',
          ms: Date.now() - t,
          detail:
            outcome.candidates.length > 0
              ? `${outcome.candidates.length} résultats · ${outcome.engines.join(', ')}`
              : `Aucun résultat${outcome.failures.length ? ` (${outcome.failures[0]})` : ''}`,
        });

        step = 'read';
        t = Date.now();
        emit({ type: 'step', id: 'read', status: 'running' });
        sources = await this.research.read(
          outcome.candidates,
          `${question} ${plan.queries.join(' ')}`,
          depth,
          signal,
        );
        const official = sources.filter((s) => s.trust === 'official').length;
        emit({
          type: 'step',
          id: 'read',
          status: sources.length > 0 ? 'done' : 'error',
          ms: Date.now() - t,
          detail:
            sources.length > 0
              ? `${sources.length} pages analysées · ${official} doc(s) officielle(s)`
              : 'Aucune page exploitable',
        });
        emit({
          type: 'sources',
          sources: sources.map(({ excerpt, ...s }) => ({
            ...s,
            chars: excerpt.length,
          })),
        });
      } else {
        emit({ type: 'step', id: 'search', status: 'skipped' });
        emit({ type: 'step', id: 'read', status: 'skipped' });
      }

      // 4. Synthèse pédagogique en streaming
      step = 'answer';
      t = Date.now();
      emit({ type: 'step', id: 'answer', status: 'running' });
      const messages: ChatMessage[] = [
        ...history,
        {
          role: 'user',
          content: answerPrompt(
            question,
            plan,
            sources,
            plan.needsResearch,
            today,
          ),
        },
      ];
      let chars = 0;
      for await (const text of this.llm.stream(cfg, {
        system: MENTOR_SYSTEM_PROMPT,
        messages,
        temperature: 0.3,
        signal,
      })) {
        chars += text.length;
        emit({ type: 'token', text });
      }
      if (chars === 0) {
        throw new LlmError(
          'provider_error',
          `${this.llm.label(cfg)} a renvoyé une réponse vide.`,
        );
      }
      emit({ type: 'step', id: 'answer', status: 'done', ms: Date.now() - t });
      emit({ type: 'done', ms: Date.now() - started });
      this.record(cfg, 'success', started);
    } catch (error) {
      if (signal.aborted) {
        if (cfg) this.record(cfg, 'aborted', started);
        return;
      }
      const code = error instanceof LlmError ? error.code : 'internal';
      const message =
        error instanceof LlmError
          ? error.message
          : 'Erreur interne inattendue. Consultez les logs du serveur.';
      if (!(error instanceof LlmError)) this.logger.error(error);
      else this.logger.warn(`[${code}] ${message}`);
      emit({ type: 'step', id: step, status: 'error' });
      emit({ type: 'error', code, message });
      if (cfg) this.record(cfg, code, started);
    }
  }

  private async plan(
    cfg: LlmConfig,
    question: string,
    history: ChatMessage[],
    depth: Depth,
    today: string,
    signal: AbortSignal,
  ): Promise<ResearchPlan> {
    const count = QUERY_COUNT[depth];
    const prompt = planPrompt(question, history, count, today);
    try {
      const raw = await this.llm.complete(cfg, {
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        temperature: 0,
        json: true,
        timeoutMs: 45_000,
        signal,
      });
      return parsePlan(raw, question, count);
    } catch (error) {
      // Clé invalide, quota… : inutile de continuer, l'erreur est remontée telle quelle.
      if (error instanceof LlmError && error.code !== 'timeout') throw error;
      if (signal.aborted) throw error;
      this.logger.warn(
        'Planification indisponible, repli sur la question brute.',
      );
      return parsePlan('', question, count);
    }
  }

  private record(cfg: LlmConfig, outcome: string, started: number): void {
    this.questions.inc({ provider: cfg.provider, outcome });
    if (outcome === 'success') {
      this.duration.observe(
        { provider: cfg.provider },
        (Date.now() - started) / 1000,
      );
    }
  }
}

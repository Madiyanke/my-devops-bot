import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'undici';
import { httpFetch } from '../common/http';
import { hostnameOf, keywords, truncate } from '../common/text';
import { extractReadableText, selectRelevant } from './html-extract';
import {
  SEARCH_PROVIDERS,
  type SearchContext,
  type SearchProvider,
  type SearchResult,
} from './search.providers';
import {
  isBlocked,
  isSafePublicUrl,
  trustLevel,
  type TrustLevel,
} from './trusted-domains';

export type Depth = 'standard' | 'deep';

export interface Candidate extends SearchResult {
  score: number;
  trust: TrustLevel;
  hits: number;
}

export interface Source {
  id: number;
  title: string;
  url: string;
  domain: string;
  provider: string;
  trust: TrustLevel;
  snippet: string;
  /** Passages pertinents réellement lus, transmis à l'IA. */
  excerpt: string;
}

export interface SearchOutcome {
  candidates: Candidate[];
  engines: string[];
  failures: string[];
}

const LIMITS = {
  standard: { perQuery: 6, toRead: 8, keep: 6, chars: 2800, webEngines: 1 },
  deep: { perQuery: 8, toRead: 14, keep: 10, chars: 4000, webEngines: 2 },
} as const;

const MAX_PAGE_BYTES = 1_500_000;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|source$)/.test(key)) u.searchParams.delete(key);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(private readonly config: ConfigService) {}

  private readonly env = (key: string): string | undefined => {
    const value = this.config.get<string>(key)?.trim();
    return value && !value.includes('${') ? value : undefined;
  };

  enabledProviders(): SearchProvider[] {
    return SEARCH_PROVIDERS.filter((p) => p.enabled(this.env));
  }

  /** Interroge les moteurs en parallèle, fusionne, déduplique et classe les résultats. */
  async search(
    queries: string[],
    depth: Depth,
    signal?: AbortSignal,
  ): Promise<SearchOutcome> {
    const limits = LIMITS[depth];
    const ctx: SearchContext = {
      env: this.env,
      signal,
      count: limits.perQuery,
      deep: depth === 'deep',
    };
    const providers = this.enabledProviders();
    const web = providers.filter((p) => p.kind === 'web');
    const knowledge = providers.filter((p) => p.kind === 'knowledge');
    const engines = new Set<string>();
    const failures: string[] = [];

    const run = async (provider: SearchProvider, query: string) => {
      try {
        const results = await provider.search(query, ctx);
        if (results.length > 0) engines.add(provider.label);
        return results;
      } catch (error) {
        if (signal?.aborted) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${provider.label} : ${reason}`);
        this.logger.warn(`Recherche ${provider.label} échouée : ${reason}`);
        return [];
      }
    };

    // Pour chaque requête : les moteurs web par ordre de préférence, avec repli.
    const runWeb = async (query: string) => {
      const collected: SearchResult[] = [];
      let successes = 0;
      for (const provider of web) {
        const results = await run(provider, query);
        collected.push(...results);
        if (results.length > 0 && ++successes >= limits.webEngines) break;
      }
      return collected;
    };

    const tasks: Promise<SearchResult[]>[] = queries.map((q) => runWeb(q));
    // Les bases de connaissances préfèrent des requêtes courtes (mots-clés).
    const short = (q: string) => keywords(q).slice(0, 5).join(' ') || q;
    for (const provider of knowledge) {
      tasks.push(run(provider, short(queries[0])));
      if (depth === 'deep' && queries[1]) {
        tasks.push(run(provider, short(queries[1])));
      }
    }
    const batches = await Promise.all(tasks);

    const weights = new Map(SEARCH_PROVIDERS.map((p) => [p.id, p.weight]));
    const merged = new Map<string, Candidate>();
    for (const result of batches.flat()) {
      if (!isSafePublicUrl(result.url) || isBlocked(result.url)) continue;
      const key = normalizeUrl(result.url);
      const existing = merged.get(key);
      if (existing) {
        existing.hits += 1;
        existing.score += 1.5;
        if (!existing.content && result.content)
          existing.content = result.content;
        continue;
      }
      const trust = trustLevel(result.url);
      merged.set(key, {
        ...result,
        trust,
        hits: 1,
        score:
          (weights.get(result.provider) ?? 1) +
          Math.max(0, 2 - result.rank * 0.25) +
          (trust === 'official' ? 4 : trust === 'reputable' ? 1.5 : 0) -
          // Documentation archivée d'une ancienne version (ex. v1-30.docs.kubernetes.io)
          (/^v\d+[-.]\d+\./.test(hostnameOf(result.url)) ? 4 : 0),
      });
    }

    const candidates = [...merged.values()].sort((a, b) => b.score - a.score);
    return { candidates, engines: [...engines], failures };
  }

  /** Lit les meilleures pages et en extrait les passages utiles à la question. */
  async read(
    candidates: Candidate[],
    question: string,
    depth: Depth,
    signal?: AbortSignal,
  ): Promise<Source[]> {
    const limits = LIMITS[depth];
    const terms = keywords(question);

    // Diversité : au plus 2 pages par domaine.
    const perDomain = new Map<string, number>();
    const selected = candidates.filter((c) => {
      const domain = hostnameOf(c.url);
      const count = perDomain.get(domain) ?? 0;
      if (count >= 2) return false;
      perDomain.set(domain, count + 1);
      return true;
    });

    const pages = await Promise.all(
      selected.slice(0, limits.toRead).map(async (candidate) => {
        const text = await this.fetchText(candidate, signal).catch(
          (error: unknown) => {
            if (signal?.aborted) throw error;
            return '';
          },
        );
        const body = text || candidate.content || '';
        const excerpt = body ? selectRelevant(body, terms, limits.chars) : '';
        return { candidate, excerpt };
      }),
    );

    return pages
      .filter(({ excerpt }) => excerpt.length >= 150)
      .slice(0, limits.keep)
      .map(({ candidate, excerpt }, index) => ({
        id: index + 1,
        title: truncate(candidate.title || hostnameOf(candidate.url), 160),
        url: candidate.url,
        domain: hostnameOf(candidate.url),
        provider: candidate.provider,
        trust: candidate.trust,
        snippet: truncate(candidate.snippet, 280),
        excerpt,
      }));
  }

  private async fetchText(
    candidate: Candidate,
    signal?: AbortSignal,
  ): Promise<string> {
    if (candidate.questionId) {
      return this.fetchStackOverflowAnswers(candidate.questionId, signal);
    }
    const res = await httpFetch(candidate.url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        'accept-language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      timeoutMs: 10_000,
      signal,
    });
    if (!res.ok || !isSafePublicUrl(res.url || candidate.url)) {
      await res.body?.cancel();
      return '';
    }
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/(html|plain|markdown)|xhtml/.test(type)) {
      await res.body?.cancel();
      return '';
    }
    const html = await this.readLimited(res.body);
    return type.includes('html') ? extractReadableText(html).text : html;
  }

  private async readLimited(body: Response['body']): Promise<string> {
    if (!body) return '';
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = (await reader.read()) as {
        done: boolean;
        value?: Uint8Array;
      };
      if (done || !value) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes > MAX_PAGE_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return html;
  }

  /** Les réponses Stack Overflow les mieux notées, via l'API officielle. */
  private async fetchStackOverflowAnswers(
    questionId: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const key = this.env('STACKEXCHANGE_KEY');
    const url =
      `https://api.stackexchange.com/2.3/questions/${questionId}/answers` +
      '?order=desc&sort=votes&site=stackoverflow&filter=withbody&pagesize=2' +
      (key ? `&key=${encodeURIComponent(key)}` : '');
    const res = await httpFetch(url, { timeoutMs: 10_000, signal });
    if (!res.ok) return '';
    const data = (await res.json()) as {
      items?: { body: string; score: number; is_accepted: boolean }[];
    };
    return (data.items ?? [])
      .map(
        (a) =>
          `## Réponse ${a.is_accepted ? 'acceptée' : 'populaire'} (score ${a.score})\n\n` +
          extractReadableText(`<main>${a.body}</main>`).text,
      )
      .join('\n\n');
  }
}

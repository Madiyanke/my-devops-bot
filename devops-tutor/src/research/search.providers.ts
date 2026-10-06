import { httpFetch } from '../common/http';
import { decodeEntities, hostnameOf, stripTags } from '../common/text';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  /** Position dans les résultats du moteur (0 = premier). */
  rank: number;
  /** Contenu déjà fourni par le moteur (Tavily), utile si la page est illisible. */
  content?: string;
  questionId?: number;
}

export interface SearchContext {
  env: (key: string) => string | undefined;
  signal?: AbortSignal;
  count: number;
  deep: boolean;
}

export interface SearchProvider {
  id: string;
  label: string;
  /** web : moteur généraliste ; knowledge : base de connaissances spécialisée. */
  kind: 'web' | 'knowledge';
  /** Poids de confiance du moteur dans le classement. */
  weight: number;
  enabled(env: SearchContext['env']): boolean;
  search(query: string, ctx: SearchContext): Promise<SearchResult[]>;
}

async function getJson<T>(
  url: string,
  ctx: SearchContext,
  init: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<T> {
  const res = await httpFetch(url, {
    ...init,
    headers: { accept: 'application/json', ...init.headers },
    timeoutMs: 12_000,
    signal: ctx.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Tavily : moteur conçu pour les agents IA (1 000 requêtes/mois gratuites). */
const tavily: SearchProvider = {
  id: 'tavily',
  label: 'Tavily',
  kind: 'web',
  weight: 3,
  enabled: (env) => !!env('TAVILY_API_KEY'),
  async search(query, ctx) {
    const body = await getJson<{
      results?: { title: string; url: string; content?: string }[];
    }>('https://api.tavily.com/search', ctx, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ctx.env('TAVILY_API_KEY')}`,
      },
      body: JSON.stringify({
        query,
        search_depth: ctx.deep ? 'advanced' : 'basic',
        max_results: ctx.count,
      }),
    });
    return (body.results ?? []).map((r, rank) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ?? '',
      content: r.content,
      provider: 'tavily',
      rank,
    }));
  },
};

/** Brave Search API (offre gratuite avec clé). */
const brave: SearchProvider = {
  id: 'brave',
  label: 'Brave Search',
  kind: 'web',
  weight: 2.5,
  enabled: (env) => !!env('BRAVE_API_KEY'),
  async search(query, ctx) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${ctx.count}`;
    const body = await getJson<{
      web?: {
        results?: { title: string; url: string; description?: string }[];
      };
    }>(url, ctx, {
      headers: { 'x-subscription-token': ctx.env('BRAVE_API_KEY') ?? '' },
    });
    return (body.web?.results ?? []).map((r, rank) => ({
      title: stripTags(r.title),
      url: r.url,
      snippet: stripTags(r.description ?? ''),
      provider: 'brave',
      rank,
    }));
  },
};

/** SearXNG auto-hébergé : méta-moteur libre, sans clé. */
const searxng: SearchProvider = {
  id: 'searxng',
  label: 'SearXNG',
  kind: 'web',
  weight: 2.5,
  enabled: (env) => !!env('SEARXNG_URL'),
  async search(query, ctx) {
    const base = (ctx.env('SEARXNG_URL') ?? '').replace(/\/+$/, '');
    const body = await getJson<{
      results?: { title: string; url: string; content?: string }[];
    }>(
      `${base}/search?q=${encodeURIComponent(query)}&format=json&safesearch=0`,
      ctx,
    );
    return (body.results ?? []).slice(0, ctx.count).map((r, rank) => ({
      title: stripTags(r.title),
      url: r.url,
      snippet: stripTags(r.content ?? ''),
      provider: 'searxng',
      rank,
    }));
  },
};

/** Analyse la page HTML de DuckDuckGo (sans clé). */
export function parseDuckDuckGo(
  html: string,
): Omit<SearchResult, 'provider'>[] {
  const results: Omit<SearchResult, 'provider'>[] = [];
  for (const block of html.split(/class="[^"]*result__body/).slice(1)) {
    const link =
      /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    let url = decodeEntities(link[1]);
    if (url.includes('uddg=')) {
      const target = new URL(url, 'https://duckduckgo.com').searchParams.get(
        'uddg',
      );
      if (!target) continue;
      url = target;
    }
    if (
      !/^https?:\/\//.test(url) ||
      hostnameOf(url).endsWith('duckduckgo.com')
    ) {
      continue; // publicités et liens internes
    }
    const snippet =
      /class="result__snippet"[^>]*>([\s\S]*?)<\/(a|div|td)>/.exec(block);
    results.push({
      title: stripTags(link[2]),
      url,
      snippet: stripTags(snippet?.[1] ?? ''),
      rank: results.length,
    });
  }
  return results;
}

const duckduckgo: SearchProvider = {
  id: 'duckduckgo',
  label: 'DuckDuckGo',
  kind: 'web',
  weight: 2,
  enabled: () => true,
  async search(query, ctx) {
    const res = await httpFetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          accept: 'text/html',
          'accept-language': 'en-US,en;q=0.9,fr;q=0.8',
        },
        timeoutMs: 12_000,
        signal: ctx.signal,
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = parseDuckDuckGo(await res.text());
    if (results.length === 0)
      throw new Error('aucun résultat (limitation anti-robot ?)');
    return results
      .slice(0, ctx.count)
      .map((r) => ({ ...r, provider: 'duckduckgo' }));
  },
};

const wikipedia: SearchProvider = {
  id: 'wikipedia',
  label: 'Wikipedia',
  kind: 'knowledge',
  weight: 1,
  enabled: () => true,
  async search(query, ctx) {
    const body = await getJson<{
      pages?: {
        key: string;
        title: string;
        excerpt?: string;
        description?: string;
      }[];
    }>(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`,
      ctx,
    );
    return (body.pages ?? []).map((p, rank) => ({
      title: `${p.title} — Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
      snippet: stripTags(p.description ?? p.excerpt ?? ''),
      provider: 'wikipedia',
      rank,
    }));
  },
};

const stackoverflow: SearchProvider = {
  id: 'stackoverflow',
  label: 'Stack Overflow',
  kind: 'knowledge',
  weight: 1.5,
  enabled: () => true,
  async search(query, ctx) {
    const key = ctx.env('STACKEXCHANGE_KEY');
    const url =
      'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance' +
      `&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=6` +
      (key ? `&key=${encodeURIComponent(key)}` : '');
    const body = await getJson<{
      items?: {
        question_id: number;
        title: string;
        link: string;
        score: number;
        answer_count: number;
        is_answered: boolean;
        tags?: string[];
      }[];
    }>(url, ctx);
    return (body.items ?? [])
      .filter((q) => q.is_answered && q.score > 0)
      .slice(0, 3)
      .map((q, rank) => ({
        title: decodeEntities(q.title),
        url: q.link,
        snippet: `Question Stack Overflow · score ${q.score} · ${q.answer_count} réponse(s) · ${(q.tags ?? []).join(', ')}`,
        provider: 'stackoverflow',
        questionId: q.question_id,
        rank,
      }));
  },
};

/** Ordre de préférence des moteurs web (le premier disponible est utilisé). */
export const SEARCH_PROVIDERS: SearchProvider[] = [
  tavily,
  brave,
  searxng,
  duckduckgo,
  wikipedia,
  stackoverflow,
];

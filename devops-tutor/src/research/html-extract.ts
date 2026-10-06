import { decodeEntities, keywords, stripTags } from '../common/text';

const NOISE_TAGS = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'iframe',
  'template',
  'button',
  'select',
];

/** Marqueur (zone Unicode privée) des blocs de code mis de côté. */
const CODE_MARK = '';

function htmlToText(fragment: string): string {
  let html = fragment.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of NOISE_TAGS) {
    html = html.replace(
      new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi'),
      ' ',
    );
  }

  // Les blocs de code sont mis de côté pour conserver leur mise en forme.
  const codeBlocks: string[] = [];
  html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
    const code = decodeEntities(
      inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
    )
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    codeBlocks.push(code);
    return `\n\n${CODE_MARK}${codeBlocks.length - 1}${CODE_MARK}\n\n`;
  });

  html = html
    .replace(
      /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_m, _level, title: string) => `\n\n## ${stripTags(title)}\n\n`,
    )
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(
      /<code[^>]*>([\s\S]*?)<\/code>/gi,
      (_m, code: string) => `\`${stripTags(code)}\``,
    )
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(
      /<(br|\/p|\/div|\/tr|\/table|\/ul|\/ol|\/section|\/blockquote|\/dd|\/dt)[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(html)
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(
      new RegExp(`${CODE_MARK}(\\d+)${CODE_MARK}`, 'g'),
      (_m, index: string) => `\`\`\`\n${codeBlocks[Number(index)]}\n\`\`\``,
    )
    .trim();
}

export interface ExtractedPage {
  title: string;
  text: string;
}

/** Extrait le contenu principal lisible d'une page HTML (sans menus, pubs, scripts). */
export function extractReadableText(html: string): ExtractedPage {
  const title = stripTags(
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '',
  );
  const candidates = [
    /<main[\s>][\s\S]*?<\/main>/i.exec(html)?.[0],
    /<article[\s>][\s\S]*<\/article>/i.exec(html)?.[0],
    /<div[^>]+role=["']main["'][\s\S]*/i.exec(html)?.[0],
    /<body[\s>][\s\S]*<\/body>/i.exec(html)?.[0],
    html,
  ];
  let best = '';
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = htmlToText(candidate);
    if (text.length >= 400) return { title, text };
    if (text.length > best.length) best = text;
  }
  return { title, text: best };
}

/** Découpe un texte en morceaux sans jamais couper un bloc de code. */
export function splitChunks(text: string, size = 1200): string[] {
  const blocks: string[] = [];
  let current = '';
  let insideFence = false;
  for (const paragraph of text.split(/\n{2,}/)) {
    current = current ? `${current}\n\n${paragraph}` : paragraph;
    if ((paragraph.match(/```/g) ?? []).length % 2 === 1) {
      insideFence = !insideFence;
    }
    if (!insideFence) {
      blocks.push(current);
      current = '';
    }
  }
  if (current) blocks.push(current);

  const chunks: string[] = [];
  let chunk = '';
  for (const block of blocks) {
    if (chunk && chunk.length + block.length > size) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk = chunk ? `${chunk}\n\n${block}` : block;
    if (chunk.length > size * 2) {
      chunks.push(chunk.slice(0, size * 2));
      chunk = '';
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

/**
 * Sélectionne les passages les plus pertinents pour la question,
 * dans la limite de `budget` caractères, en gardant l'ordre du document.
 */
export function selectRelevant(
  text: string,
  terms: string[],
  budget: number,
): string {
  const chunks = splitChunks(text);
  if (chunks.length === 0) return '';
  const scored = chunks.map((chunk, index) => {
    const lower = chunk.toLowerCase();
    const words = new Set(keywords(chunk));
    let score = 0;
    for (const term of terms) {
      if (words.has(term)) score += 2;
      else if (lower.includes(term)) score += 1;
    }
    if (chunk.includes('```')) score += 1;
    return { chunk, index, score };
  });

  const ranked = [...scored].sort(
    (a, b) => b.score - a.score || a.index - b.index,
  );
  const picked: typeof scored = [];
  let used = 0;
  for (const item of ranked) {
    if (item.score === 0 && picked.length > 0) break;
    if (used + item.chunk.length > budget && picked.length > 0) continue;
    picked.push(item);
    used += item.chunk.length;
    if (used >= budget) break;
  }
  return picked
    .sort((a, b) => a.index - b.index)
    .map((item) => item.chunk.slice(0, budget))
    .join('\n\n[…]\n\n');
}

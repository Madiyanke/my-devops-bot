const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ocirc: 'ô',
  ucirc: 'û',
  ugrave: 'ù',
  icirc: 'î',
  copy: '©',
  reg: '®',
  times: '×',
  rarr: '→',
  larr: '←',
};

export function decodeEntities(input: string): string {
  return input.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code.startsWith('#')) {
        const hex = code[1] === 'x' || code[1] === 'X';
        const value = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return value > 0 && value < 0x110000
          ? String.fromCodePoint(value)
          : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    },
  );
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const STOPWORDS = new Set(
  (
    'the and for with that this from what how why when are was can you your into ' +
    'does not use using vs les des une un est que qui quoi comment pourquoi quand ' +
    'dans pour avec sur par pas plus mon mes ton tes son ses leur nos vos aux du de ' +
    'la le et ou il elle on je tu nous vous ils elles ce cet cette ces faire fait ' +
    'peux peut entre official documentation docs guide tutorial example'
  ).split(' '),
);

/** Mots-clés significatifs d'un texte (minuscules, sans mots vides). */
export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ_.+#-]+/i)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

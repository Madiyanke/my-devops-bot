import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { Marked } from 'marked';
import type { Source } from './types';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LANG_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  tf: 'ini',
  terraform: 'ini',
  hcl: 'ini',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  ps1: 'powershell',
};

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
      if (language === 'mermaid') {
        return `<div class="mermaid-block" data-code="${encodeURIComponent(text)}"><pre><code>${escapeHtml(text)}</code></pre></div>`;
      }
      const alias = LANG_ALIASES[language] ?? language;
      const highlighted =
        alias && hljs.getLanguage(alias)
          ? hljs.highlight(text, { language: alias, ignoreIllegals: true }).value
          : escapeHtml(text);
      const label = language || 'code';
      return (
        `<div class="code-block"><div class="code-head"><span class="code-lang">${escapeHtml(label)}</span>` +
        `<button type="button" class="code-copy" aria-label="Copier le code">Copier</button></div>` +
        `<pre><code class="hljs">${highlighted}</code></pre></div>`
      );
    },
  },
});

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const CITATION = /\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\](?!\()/g;

/** Transforme les citations [n] en liens vers les sources, hors blocs de code. */
function linkCitations(root: HTMLElement, sources: Source[]) {
  if (sources.length === 0) return;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('pre, code, a')) continue;
    CITATION.lastIndex = 0;
    if (CITATION.test(node.data)) targets.push(node);
  }
  for (const node of targets) {
    const fragment = document.createDocumentFragment();
    let last = 0;
    for (const match of node.data.matchAll(CITATION)) {
      const ids = match[1].split(/\s*[,;]\s*/).map(Number);
      if (!ids.every((id) => byId.has(id))) continue;
      fragment.append(node.data.slice(last, match.index));
      for (const id of ids) {
        const source = byId.get(id)!;
        const link = document.createElement('a');
        link.className = 'cite';
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = `${source.title} — ${source.domain}`;
        link.dataset.source = String(id);
        link.textContent = String(id);
        fragment.append(link);
      }
      last = (match.index ?? 0) + match[0].length;
    }
    fragment.append(node.data.slice(last));
    node.replaceWith(fragment);
  }
}

export function renderMarkdown(markdown: string, sources: Source[] = []): string {
  ensureHooks();
  // Les tableaux défilent horizontalement sur mobile.
  const html = marked
    .parse(markdown, { async: false })
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  if (sources.length === 0) return clean;
  const container = document.createElement('div');
  container.innerHTML = clean;
  linkCitations(container, sources);
  return container.innerHTML;
}

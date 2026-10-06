import { parseSseEvent } from '../common/http';
import { decodeEntities, keywords } from '../common/text';
import {
  extractReadableText,
  selectRelevant,
  splitChunks,
} from './html-extract';
import { parseDuckDuckGo } from './search.providers';
import { isSafePublicUrl, trustLevel } from './trusted-domains';

describe('extractReadableText', () => {
  const html = `<html><head><title>Pods | Kubernetes</title><script>var x = 1;</script></head>
    <body><nav>Menu Home Docs</nav>
    <main><h1>Pods</h1><p>A <em>Pod</em> is the smallest deployable unit &amp; it groups containers.</p>
    <pre><code>kubectl get pods
kubectl describe pod nginx</code></pre>
    <ul><li>Shared network</li><li>Shared storage</li></ul>
    ${'<p>Filler paragraph about pods lifecycle and scheduling.</p>'.repeat(10)}</main>
    <footer>Copyright</footer></body></html>`;

  it('garde le contenu principal, les titres, listes et blocs de code', () => {
    const page = extractReadableText(html);
    expect(page.title).toBe('Pods | Kubernetes');
    expect(page.text).toContain('## Pods');
    expect(page.text).toContain('smallest deployable unit & it groups');
    expect(page.text).toContain(
      '```\nkubectl get pods\nkubectl describe pod nginx\n```',
    );
    expect(page.text).toContain('- Shared network');
    expect(page.text).not.toContain('var x');
    expect(page.text).not.toContain('Menu Home');
    expect(page.text).not.toContain('Copyright');
  });
});

describe('splitChunks / selectRelevant', () => {
  it('ne coupe jamais un bloc de code', () => {
    const text = `intro\n\n\`\`\`\nline1\n\nline2\n\`\`\`\n\nend`;
    const chunks = splitChunks(text, 30);
    expect(chunks.some((c) => c.includes('line1\n\nline2'))).toBe(true);
  });

  it('sélectionne les passages contenant les termes de la question', () => {
    const text = [
      'Paragraph about cooking recipes.',
      'Helm charts package Kubernetes manifests.',
      'Another paragraph about gardening.',
    ].join('\n\n'.repeat(1) + 'x'.repeat(1300) + '\n\n');
    const excerpt = selectRelevant(text, keywords('helm charts'), 1500);
    expect(excerpt).toContain('Helm charts');
  });
});

describe('parseDuckDuckGo', () => {
  it('décode les liens de redirection et ignore les publicités', () => {
    const html = `
      <div class="result results_links result__body">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fkubernetes.io%2Fdocs%2F&amp;rut=abc">Kubernetes <b>Docs</b></a>
        <a class="result__snippet" href="#">Production-grade <b>container</b> orchestration</a>
      </div>
      <div class="result result--ad result__body">
        <a class="result__a" href="https://duckduckgo.com/y.js?ad_domain=x">Ad</a>
      </div>`;
    const results = parseDuckDuckGo(html);
    expect(results).toEqual([
      {
        title: 'Kubernetes Docs',
        url: 'https://kubernetes.io/docs/',
        snippet: 'Production-grade container orchestration',
        rank: 0,
      },
    ]);
  });
});

describe('trusted domains & URL safety', () => {
  it('classe la documentation officielle', () => {
    expect(trustLevel('https://kubernetes.io/docs/concepts/')).toBe('official');
    expect(trustLevel('https://docs.aws.amazon.com/eks/')).toBe('official');
    expect(trustLevel('https://stackoverflow.com/q/1')).toBe('reputable');
    expect(trustLevel('https://random-blog.example.com')).toBeNull();
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1/admin',
    'http://10.0.0.5',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1',
    'http://api.dev.svc.cluster.local',
    'http://api:3000',
    'file:///etc/passwd',
  ])('bloque %s', (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });

  it('autorise les URL publiques', () => {
    expect(isSafePublicUrl('https://docs.docker.com/engine/')).toBe(true);
  });
});

describe('utilitaires', () => {
  it('parse un évènement SSE multi-lignes', () => {
    expect(parseSseEvent('event: x\ndata: {"a":1}')).toBe('{"a":1}');
    expect(parseSseEvent(': ping')).toBeNull();
  });

  it('décode les entités HTML', () => {
    expect(decodeEntities('&lt;pod&gt; &amp; &#39;x&#39; &#x2192;')).toBe(
      "<pod> & 'x' →",
    );
  });
});

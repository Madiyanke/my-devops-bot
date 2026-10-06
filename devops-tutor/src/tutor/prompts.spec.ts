import { answerPrompt, parsePlan } from './prompts';

describe('parsePlan', () => {
  it('lit un JSON valide entouré de texte', () => {
    const raw =
      'Voici : {"language":"fr","needs_research":true,"level":"debutant","topic":"Pods","queries":["kubernetes pod official docs","pod lifecycle"]} fin';
    expect(parsePlan(raw, 'Un pod ?', 3)).toEqual({
      language: 'fr',
      needsResearch: true,
      level: 'debutant',
      topic: 'Pods',
      queries: ['kubernetes pod official docs', 'pod lifecycle'],
    });
  });

  it('limite le nombre de requêtes', () => {
    const raw = JSON.stringify({ queries: ['aaa', 'bbb', 'ccc', 'ddd'] });
    expect(parsePlan(raw, 'q', 2).queries).toEqual(['aaa', 'bbb']);
  });

  it('se replie sur la question si la réponse est invalide', () => {
    const plan = parsePlan('pas du json', 'Comment fonctionne Helm ?', 3);
    expect(plan.needsResearch).toBe(true);
    expect(plan.language).toBe('fr');
    expect(plan.queries).toEqual(['Comment fonctionne Helm ?']);
  });

  it('respecte needs_research=false', () => {
    expect(
      parsePlan('{"needs_research":false}', 'merci', 3).needsResearch,
    ).toBe(false);
  });
});

describe('answerPrompt', () => {
  const plan = {
    language: 'fr',
    needsResearch: true,
    level: 'debutant',
    topic: 'Pods',
    queries: ['pods'],
  };

  it('numérote les sources et rappelle la règle de citation', () => {
    const prompt = answerPrompt(
      'Un pod ?',
      plan,
      [
        {
          id: 1,
          title: 'Pods',
          url: 'https://kubernetes.io/docs/concepts/workloads/pods/',
          domain: 'kubernetes.io',
          provider: 'duckduckgo',
          trust: 'official',
          snippet: '',
          excerpt: 'A Pod is the smallest deployable unit.',
        },
      ],
      true,
      '2026-10-07',
    );
    expect(prompt).toContain('<source id="1">');
    expect(prompt).toContain('documentation officielle');
    expect(prompt).toContain('[n]');
  });

  it("signale l'absence de sources", () => {
    expect(answerPrompt('q', plan, [], true, '2026-10-07')).toContain(
      'AUCUNE source',
    );
  });
});

import { pickBestModel, suggestedModel } from './llm.models';

describe('suggestedModel', () => {
  it('extrait le modèle recommandé par Google', () => {
    const message =
      'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features.';
    expect(suggestedModel(message)).toBe('gemini-3.8-flash');
  });

  it('renvoie null sans recommandation', () => {
    expect(suggestedModel('model not found')).toBeNull();
  });
});

describe('pickBestModel', () => {
  const gemini = [
    'gemini-2.0-flash-001',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.8-flash',
    'gemini-3.8-flash-lite',
    'gemini-3.8-flash-preview-09-2026',
    'gemini-omni-1.1-flash',
    'gemini-3.8-flash-image',
    'text-embedding-004',
  ];

  it('choisit le flash stable le plus récent (sans lite, preview, omni, image)', () => {
    expect(pickBestModel('gemini', gemini)).toBe('gemini-3.8-flash');
  });

  it("privilégie l'alias gemini-flash-latest s'il existe", () => {
    expect(pickBestModel('gemini', [...gemini, 'gemini-flash-latest'])).toBe(
      'gemini-flash-latest',
    );
  });

  it('OpenAI : le mini le plus récent', () => {
    expect(
      pickBestModel('openai', [
        'gpt-4o',
        'gpt-4.1-mini',
        'gpt-5-mini',
        'dall-e-3',
      ]),
    ).toBe('gpt-5-mini');
  });

  it('renvoie null pour une liste vide', () => {
    expect(pickBestModel('gemini', [])).toBeNull();
  });
});

import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../lib/markdown'
import { createSseParser } from '../lib/api'
import { detectProvider, maskKey } from '../lib/providers'

const SOURCES = [
  { id: 1, title: 'Pods', url: 'https://kubernetes.io/docs/pods/', domain: 'kubernetes.io', provider: 'duckduckgo', trust: 'official', snippet: '', chars: 100 },
  { id: 2, title: 'Probes', url: 'https://kubernetes.io/docs/probes/', domain: 'kubernetes.io', provider: 'duckduckgo', trust: 'official', snippet: '', chars: 100 },
]

describe('renderMarkdown', () => {
  it('transforme les citations [n] en liens vers les sources', () => {
    const html = renderMarkdown('Un Pod regroupe des conteneurs [1][2].', SOURCES)
    const div = document.createElement('div')
    div.innerHTML = html
    const cites = div.querySelectorAll('a.cite')
    expect(cites).toHaveLength(2)
    expect(cites[0].getAttribute('href')).toBe('https://kubernetes.io/docs/pods/')
    expect(cites[1].textContent).toBe('2')
  })

  it('gère les citations groupées et ignore les numéros inconnus', () => {
    const div = document.createElement('div')
    div.innerHTML = renderMarkdown('Voir [1, 2] mais pas [9].', SOURCES)
    expect(div.querySelectorAll('a.cite')).toHaveLength(2)
    expect(div.textContent).toContain('[9]')
  })

  it('ne touche pas aux crochets dans le code', () => {
    const div = document.createElement('div')
    div.innerHTML = renderMarkdown('```bash\necho ${arr[1]}\n```', SOURCES)
    expect(div.querySelector('a.cite')).toBeNull()
    expect(div.querySelector('.code-lang').textContent).toBe('bash')
    expect(div.querySelector('.code-copy')).not.toBeNull()
  })

  it('neutralise le HTML dangereux', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })

  it('ouvre les liens dans un nouvel onglet de façon sûre', () => {
    const html = renderMarkdown('[doc](https://kubernetes.io)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('prépare les blocs mermaid pour un rendu différé', () => {
    const div = document.createElement('div')
    div.innerHTML = renderMarkdown('```mermaid\nflowchart LR\n  A-->B\n```')
    const code = decodeURIComponent(div.querySelector('.mermaid-block').dataset.code)
    expect(code).toBe('flowchart LR\n  A-->B')
  })
})

describe('createSseParser', () => {
  it('reconstitue les évènements découpés en plusieurs morceaux', () => {
    const events = []
    const parse = createSseParser((e) => events.push(e))
    parse('data: {"type":"token","te')
    parse('xt":"Hello"}\n\n: ping\n\ndata: {"type":"done","ms":5}\n')
    parse('\n')
    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'done', ms: 5 },
    ])
  })
})

describe('providers', () => {
  it('détecte le fournisseur depuis la clé', () => {
    expect(detectProvider('AIzaSy123')).toBe('gemini')
    expect(detectProvider('sk-ant-123')).toBe('anthropic')
    expect(detectProvider('gsk_123')).toBe('groq')
    expect(detectProvider('sk-proj-123')).toBe('openai')
    expect(detectProvider('random')).toBeNull()
  })

  it('masque la clé', () => {
    expect(maskKey('AIzaSyABCDEFGHIJKLMN1234')).toBe('AIzaSy…1234')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'

const CONFIG = {
  server: { provider: 'gemini', providerLabel: 'Google Gemini', model: 'gemini-2.5-flash' },
  providers: [
    { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', requiresKey: true, keyHint: 'AIza…', keyUrl: null, needsBaseUrl: false },
  ],
  search: [{ id: 'duckduckgo', label: 'DuckDuckGo', kind: 'web' }],
  allowCustomBaseUrl: false,
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(CONFIG), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
})

describe('App.vue', () => {
  it("affiche l'interface principale", async () => {
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.find('.topbar').exists()).toBe(true)
    expect(wrapper.find('.composer').exists()).toBe(true)
    expect(wrapper.text()).toContain('DevOps Mentor')
  })

  it("affiche l'écran d'accueil avec des suggestions", async () => {
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.findAll('.suggestion').length).toBeGreaterThanOrEqual(4)
  })

  it('affiche le modèle configuré côté serveur', async () => {
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('.model-pill').text()).toContain('Google Gemini · gemini-2.5-flash')
  })

  it("désactive l'envoi quand le champ est vide", async () => {
    const wrapper = mount(App)
    await flushPromises()
    const send = wrapper.find('button[aria-label="Envoyer"]')
    expect(send.attributes('disabled')).toBeDefined()
    await wrapper.find('textarea').setValue('Comment fonctionne Helm ?')
    expect(send.attributes('disabled')).toBeUndefined()
  })
})

describe('PWA & accessibilité', () => {
  it('affiche le bandeau hors ligne et bloque l\'envoi', async () => {
    const wrapper = mount(App)
    await flushPromises()
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(wrapper.find('.offline').exists()).toBe(true)
    await wrapper.find('textarea').setValue('Question')
    expect(wrapper.find('button[aria-label="Envoyer"]').attributes('disabled')).toBeDefined()
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(wrapper.find('.offline').exists()).toBe(false)
  })

  it('désactive les animations quand le mouvement réduit est demandé', async () => {
    const { reducedMotion } = await import('../lib/motion')
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    expect(reducedMotion()).toBe(true)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    expect(reducedMotion()).toBe(false)
    delete window.matchMedia
  })
})

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { listModels, testLlm } from '../lib/api';
import { openSheet } from '../lib/motion';
import { detectProvider } from '../lib/providers';
import Icon from './Icon.vue';

const emit = defineEmits<{ close: [] }>();
const { settings, serverConfig, configError, refreshConfig, llmOverride, effectiveProvider } = useSettings();

const showKey = ref(false);
const overlay = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const models = ref<string[]>([]);
const loadingModels = ref(false);
const testing = ref(false);
const result = ref<{ ok: boolean; text: string } | null>(null);

const providers = computed(() => serverConfig.value?.providers ?? []);
const detected = computed(() => detectProvider(settings.apiKey));
const info = computed(() => providers.value.find((p) => p.id === effectiveProvider.value) ?? null);
const showBaseUrl = computed(
  () => settings.mode === 'custom' && (info.value?.needsBaseUrl || settings.baseUrl !== ''),
);
const modelPlaceholder = computed(() =>
  settings.mode === 'server'
    ? (serverConfig.value?.server?.model ?? 'modèle par défaut')
    : (info.value?.defaultModel ?? 'nom du modèle'),
);
const webEngines = computed(() => serverConfig.value?.search.filter((s) => s.kind === 'web') ?? []);
const knowledgeEngines = computed(() => serverConfig.value?.search.filter((s) => s.kind === 'knowledge') ?? []);

watch(
  () => [settings.mode, settings.provider, settings.apiKey],
  () => {
    models.value = [];
    result.value = null;
  },
);

async function loadModels() {
  loadingModels.value = true;
  result.value = null;
  try {
    models.value = (await listModels(llmOverride())).models;
    if (models.value.length === 0) result.value = { ok: false, text: 'Aucun modèle retourné par le fournisseur.' };
  } catch (error) {
    result.value = { ok: false, text: error instanceof Error ? error.message : String(error) };
  } finally {
    loadingModels.value = false;
  }
}

async function runTest() {
  testing.value = true;
  result.value = null;
  try {
    const r = await testLlm(llmOverride());
    result.value = { ok: true, text: `Connexion réussie : ${r.providerLabel} · ${r.model} (${r.latencyMs} ms)` };
  } catch (error) {
    result.value = { ok: false, text: error instanceof Error ? error.message : String(error) };
  } finally {
    testing.value = false;
  }
}

function clearKey() {
  settings.apiKey = '';
  settings.model = '';
  settings.baseUrl = '';
  settings.provider = 'auto';
}

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close');
onMounted(() => {
  document.addEventListener('keydown', onKey);
  if (panel.value && overlay.value) {
    openSheet(panel.value, overlay.value, window.matchMedia?.('(max-width: 600px)').matches ?? false);
  }
  void refreshConfig();
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div ref="overlay" class="overlay" @click.self="emit('close')">
    <div ref="panel" class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <span class="grabber" aria-hidden="true"></span>
      <header class="modal-head">
        <div>
          <h2 id="settings-title">Paramètres</h2>
          <p class="sub">Branche n'importe quel modèle d'IA. Le moteur de recherche reste le même.</p>
        </div>
        <button class="btn btn-ghost btn-icon" aria-label="Fermer" @click="emit('close')"><Icon name="x" /></button>
      </header>

      <div class="modal-body">
        <p v-if="configError" class="notice notice-error"><Icon name="alert" :size="15" /> {{ configError }}</p>

        <section>
          <h3 class="section-title mono"><Icon name="brain" :size="14" /> Moteur IA</h3>
          <div class="modes">
            <label class="mode" :class="{ active: settings.mode === 'server' }">
              <input v-model="settings.mode" type="radio" value="server" />
              <span class="mode-title"><Icon name="cloud" :size="15" /> Clé du serveur</span>
              <span class="mode-desc">
                <template v-if="serverConfig?.server">
                  {{ serverConfig.server.providerLabel }} · <span class="mono">{{ serverConfig.server.model }}</span>
                </template>
                <template v-else>Aucune clé configurée sur le backend</template>
              </span>
            </label>
            <label class="mode" :class="{ active: settings.mode === 'custom' }">
              <input v-model="settings.mode" type="radio" value="custom" />
              <span class="mode-title"><Icon name="key" :size="15" /> Ma propre clé</span>
              <span class="mode-desc">Gemini, OpenAI, Claude, Mistral, Groq, Ollama…</span>
            </label>
          </div>

          <template v-if="settings.mode === 'custom'">
            <label class="field">
              <span class="label">Clé API</span>
              <span class="input-wrap">
                <input
                  v-model="settings.apiKey"
                  :type="showKey ? 'text' : 'password'"
                  class="mono"
                  autocomplete="off"
                  spellcheck="false"
                  :placeholder="info?.keyHint ?? 'Colle ta clé (AIza…, sk-…, sk-ant-…, gsk_…)'"
                />
                <button type="button" class="btn btn-ghost btn-icon" :aria-label="showKey ? 'Masquer la clé' : 'Afficher la clé'" @click="showKey = !showKey">
                  <Icon :name="showKey ? 'eye-off' : 'eye'" :size="16" />
                </button>
              </span>
              <span v-if="settings.apiKey && settings.provider === 'auto'" class="help">
                <template v-if="detected">
                  <span class="dot dot-ok"></span> Fournisseur détecté :
                  <strong>{{ providers.find((p) => p.id === detected)?.label ?? detected }}</strong>
                </template>
                <template v-else><span class="dot dot-warn"></span> Fournisseur non reconnu : choisis-le ci-dessous.</template>
              </span>
            </label>

            <div class="row">
              <label class="field">
                <span class="label">Fournisseur</span>
                <select v-model="settings.provider">
                  <option value="auto">Détection automatique</option>
                  <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
              </label>
              <a v-if="info?.keyUrl" class="key-link" :href="info.keyUrl" target="_blank" rel="noopener noreferrer">
                Obtenir une clé {{ info.label }} <Icon name="external" :size="12" />
              </a>
            </div>

            <label v-if="showBaseUrl" class="field">
              <span class="label">URL de l'API (compatible OpenAI)</span>
              <input v-model="settings.baseUrl" class="mono" placeholder="http://host.docker.internal:11434/v1" />
              <span v-if="!serverConfig?.allowCustomBaseUrl" class="help warn">
                Désactivé sur ce serveur : définir ALLOW_CUSTOM_BASE_URL=true côté backend.
              </span>
            </label>
          </template>

          <label class="field">
            <span class="label">Modèle <span class="optional">(optionnel)</span></span>
            <span class="input-wrap">
              <input v-model="settings.model" class="mono" list="model-list" :placeholder="modelPlaceholder" />
              <button type="button" class="btn" :disabled="loadingModels" @click="loadModels">
                <span v-if="loadingModels" class="spinner"></span>
                <Icon v-else name="refresh" :size="14" /> Lister
              </button>
            </span>
            <datalist id="model-list">
              <option v-for="m in models" :key="m" :value="m" />
            </datalist>
            <span v-if="models.length" class="help">{{ models.length }} modèles disponibles : sélectionne-en un dans la liste.</span>
          </label>

          <div class="test-row">
            <button class="btn btn-primary" :disabled="testing" @click="runTest">
              <span v-if="testing" class="spinner dark"></span>
              <Icon v-else name="zap" :size="15" /> Tester la connexion
            </button>
            <button v-if="settings.mode === 'custom' && settings.apiKey" class="btn btn-ghost" @click="clearKey">
              <Icon name="trash" :size="14" /> Oublier la clé
            </button>
          </div>
          <p v-if="result" class="notice" :class="result.ok ? 'notice-ok' : 'notice-error'">
            <Icon :name="result.ok ? 'check' : 'alert'" :size="15" /> {{ result.text }}
          </p>

          <p class="privacy">
            <Icon name="lock" :size="13" />
            Ta clé reste dans ce navigateur (localStorage). Elle est transmise uniquement à ton backend, qui l'utilise
            pour appeler le fournisseur et ne la stocke jamais.
          </p>
        </section>

        <section>
          <h3 class="section-title mono"><Icon name="search" :size="14" /> Moteurs de recherche actifs</h3>
          <div class="engines">
            <span v-for="e in webEngines" :key="e.id" class="badge badge-official">{{ e.label }}</span>
            <span v-for="e in knowledgeEngines" :key="e.id" class="badge badge-reputable">{{ e.label }}</span>
          </div>
          <p class="help">
            Gratuits et sans clé par défaut. Pour des recherches encore plus fiables, ajoute côté serveur
            <code>TAVILY_API_KEY</code>, <code>BRAVE_API_KEY</code> ou <code>SEARXNG_URL</code> (offres gratuites).
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 10, 0.6);
  backdrop-filter: blur(4px);
}
.grabber {
  display: none;
}
.modal {
  width: min(640px, 100%);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 18px;
}
.sub {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.modal-body {
  overflow-y: auto;
  padding: 6px 22px 22px;
}
section {
  padding-top: 16px;
}
section + section {
  margin-top: 18px;
  border-top: 1px dashed var(--border);
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}
.modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.mode {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: pointer;
}
.mode.active {
  border-color: var(--accent);
  box-shadow: var(--glow);
}
.mode input {
  position: absolute;
  opacity: 0;
}
.mode-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 14px;
}
.mode-desc {
  font-size: 12.5px;
  color: var(--muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  flex: 1;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.optional {
  font-weight: 400;
  color: var(--muted);
}
input:not([type='radio']),
select {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13.5px;
  outline: none;
}
input:focus,
select:focus {
  border-color: var(--accent);
}
.input-wrap {
  display: flex;
  gap: 8px;
}
.row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}
.key-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 24px;
  font-size: 12.5px;
  color: var(--cyan);
  text-decoration: none;
  white-space: nowrap;
}
.help {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--muted);
  flex-wrap: wrap;
}
.help.warn {
  color: var(--amber);
}
.help code,
.privacy code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--accent);
}
.test-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.notice .icon {
  margin-top: 2px;
}
.notice-ok {
  background: var(--accent-soft);
  color: var(--accent);
}
.notice-error {
  background: var(--danger-soft);
  color: var(--danger);
}
.privacy {
  display: flex;
  gap: 8px;
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.privacy .icon {
  margin-top: 3px;
}
.engines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@media (max-width: 600px) {
  /* Panneau du bas, façon application native */
  .overlay {
    place-items: end stretch;
    padding: 0;
  }
  .modal {
    width: 100%;
    max-height: 92dvh;
    border-radius: 22px 22px 0 0;
    border-bottom: none;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .grabber {
    display: block;
    width: 42px;
    height: 5px;
    margin: 8px auto 0;
    border-radius: 5px;
    background: var(--border-strong);
  }
  .modal-head {
    padding: 12px 18px 12px;
  }
  .modal-body {
    padding: 4px 18px 22px;
  }
  input:not([type='radio']),
  select {
    font-size: 16px; /* évite le zoom automatique d'iOS */
  }
  .modes {
    grid-template-columns: 1fr;
  }
  .row {
    flex-direction: column;
    align-items: stretch;
  }
  .key-link {
    margin: -6px 0 14px;
  }
}
</style>

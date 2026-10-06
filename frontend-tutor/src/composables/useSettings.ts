import { computed, reactive, ref, watch } from 'vue';
import { fetchConfig } from '../lib/api';
import { detectProvider } from '../lib/providers';
import { load, save } from '../lib/storage';
import type { Depth, LlmOverride, ServerConfig } from '../lib/types';

export interface Settings {
  /** server : clé configurée sur le backend ; custom : clé de l'utilisateur. */
  mode: 'server' | 'custom';
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  depth: Depth;
  theme: 'dark' | 'light';
}

const KEY = 'devops-mentor:settings';
const DEFAULTS: Settings = {
  mode: 'server',
  provider: 'auto',
  apiKey: '',
  model: '',
  baseUrl: '',
  depth: 'standard',
  theme: 'dark',
};

const settings = reactive<Settings>(load(KEY, DEFAULTS));
const serverConfig = ref<ServerConfig | null>(null);
const configError = ref('');

watch(settings, (value) => save(KEY, value), { deep: true });
watch(
  () => settings.theme,
  (theme) => document.documentElement.setAttribute('data-theme', theme),
  { immediate: true },
);

async function refreshConfig() {
  try {
    serverConfig.value = await fetchConfig();
    configError.value = '';
  } catch (error) {
    configError.value = error instanceof Error ? error.message : String(error);
  }
}

/** Paramètres IA envoyés au backend avec chaque question. */
function llmOverride(): LlmOverride | undefined {
  if (settings.mode === 'server') {
    return settings.model.trim() ? { model: settings.model.trim() } : undefined;
  }
  const override: LlmOverride = {};
  if (settings.provider !== 'auto') override.provider = settings.provider;
  if (settings.apiKey.trim()) override.apiKey = settings.apiKey.trim();
  if (settings.model.trim()) override.model = settings.model.trim();
  if (settings.baseUrl.trim()) override.baseUrl = settings.baseUrl.trim();
  return override;
}

const effectiveProvider = computed(() =>
  settings.mode === 'server'
    ? (serverConfig.value?.server?.provider ?? null)
    : settings.provider !== 'auto'
      ? settings.provider
      : detectProvider(settings.apiKey),
);

/** Libellé affiché dans l'interface : « Gemini · gemini-2.5-flash ». */
const activeModelLabel = computed(() => {
  const providers = serverConfig.value?.providers ?? [];
  const id = effectiveProvider.value;
  const info = providers.find((p) => p.id === id);
  if (settings.mode === 'server') {
    const server = serverConfig.value?.server;
    return server ? `${server.providerLabel} · ${settings.model || server.model}` : null;
  }
  if (!info) return null;
  return `${info.label} · ${settings.model || info.defaultModel || '?'}`;
});

const isReady = computed(() =>
  settings.mode === 'server'
    ? !!serverConfig.value?.server
    : !!effectiveProvider.value &&
      (!!settings.apiKey.trim() ||
        !(serverConfig.value?.providers.find((p) => p.id === effectiveProvider.value)?.requiresKey ?? true)),
);

export function useSettings() {
  return {
    settings,
    serverConfig,
    configError,
    refreshConfig,
    llmOverride,
    effectiveProvider,
    activeModelLabel,
    isReady,
  };
}

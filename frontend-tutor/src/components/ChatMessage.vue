<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { renderMarkdown } from '../lib/markdown';
import { enterMessage, shake } from '../lib/motion';
import type { Message } from '../lib/types';
import { useSettings } from '../composables/useSettings';
import BrandLogo from './BrandLogo.vue';
import Icon from './Icon.vue';
import PipelineRun from './PipelineRun.vue';
import SourceCards from './SourceCards.vue';

const props = defineProps<{ message: Message; last: boolean }>();
const emit = defineEmits<{ retry: []; settings: [] }>();
const { settings } = useSettings();

const body = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);
const errorCard = ref<HTMLElement | null>(null);

// Seuls les messages qui viennent d'arriver sont animés (pas l'historique rechargé).
onMounted(() => {
  if (root.value && Date.now() - props.message.createdAt < 4000) {
    enterMessage(root.value, props.message.role === 'user');
  }
});
watch(
  () => props.message.status,
  async (status) => {
    if (status !== 'error') return;
    await nextTick();
    if (errorCard.value) shake(errorCard.value);
  },
);
const copied = ref(false);

const html = computed(() => renderMarkdown(props.message.content, props.message.sources ?? []));
const streaming = computed(() => props.message.status === 'streaming');
const waitingFirstToken = computed(() => streaming.value && !props.message.content);
const keyError = computed(() =>
  ['no_key', 'invalid_key', 'unknown_provider', 'missing_key', 'model_not_found', 'base_url_forbidden', 'rate_limited'].includes(
    props.message.error?.code ?? '',
  ),
);

/** Copie d'un bloc de code (délégation d'évènement sur le HTML rendu). */
async function onBodyClick(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest('.code-copy');
  if (!button) return;
  const code = button.closest('.code-block')?.querySelector('code')?.textContent ?? '';
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copié ✓';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'Copier';
      button.classList.remove('copied');
    }, 1600);
  } catch {
    button.textContent = 'Échec';
  }
}

async function copyAnswer() {
  try {
    await navigator.clipboard.writeText(props.message.content);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // presse-papiers indisponible (contexte non sécurisé)
  }
}

/** Les diagrammes Mermaid sont rendus une fois la réponse complète (chargement à la demande). */
let mermaidCounter = 0;
async function renderDiagrams() {
  await nextTick();
  const blocks = body.value?.querySelectorAll<HTMLElement>('.mermaid-block:not([data-rendered])');
  if (!blocks?.length) return;
  try {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: settings.theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'Inter, sans-serif',
    });
    for (const block of blocks) {
      block.dataset.rendered = 'true';
      try {
        const { svg } = await mermaid.render(`mmd-${Date.now()}-${mermaidCounter++}`, decodeURIComponent(block.dataset.code ?? ''));
        block.innerHTML = svg;
      } catch {
        block.dataset.rendered = 'error'; // syntaxe invalide : on garde le code source
      }
    }
  } catch {
    // module non chargé : le code source reste affiché
  }
}

watch(
  () => [props.message.status, html.value, settings.theme] as const,
  ([status]) => {
    if (status !== 'streaming') void renderDiagrams();
  },
  { immediate: true, flush: 'post' },
);
</script>

<template>
  <article ref="root" class="message" :class="message.role">
    <template v-if="message.role === 'user'">
      <div class="user-bubble">{{ message.content }}</div>
    </template>

    <template v-else>
      <div class="avatar"><BrandLogo :size="30" /></div>
      <div class="assistant-body">
        <PipelineRun v-if="message.steps" :message="message" />

        <SourceCards v-if="message.sources?.length" :sources="message.sources" />

        <div v-if="waitingFirstToken" class="thinking mono">
          <span class="bar"></span> le mentor prépare sa réponse…
        </div>

        <div
          v-if="message.content"
          ref="body"
          class="prose"
          :class="{ streaming }"
          @click="onBodyClick"
          v-html="html"
        ></div>

        <div v-if="message.status === 'error' && message.error" ref="errorCard" class="error-card">
          <Icon name="alert" :size="18" />
          <div>
            <strong>La réponse n'a pas pu être générée</strong>
            <p>{{ message.error.message }}</p>
            <div class="error-actions">
              <button v-if="keyError" class="btn btn-primary" @click="emit('settings')">
                <Icon name="key" :size="15" /> Configurer l'IA
              </button>
              <button v-if="last" class="btn" @click="emit('retry')"><Icon name="refresh" :size="15" /> Réessayer</button>
            </div>
          </div>
        </div>

        <div v-if="message.status === 'aborted'" class="aborted mono">■ génération interrompue</div>

        <div v-if="message.status === 'done' || message.status === 'aborted'" class="actions">
          <button class="btn btn-ghost" :aria-label="copied ? 'Copié' : 'Copier la réponse'" @click="copyAnswer">
            <Icon :name="copied ? 'check' : 'copy'" :size="15" /> {{ copied ? 'Copié' : 'Copier' }}
          </button>
          <button v-if="last" class="btn btn-ghost" @click="emit('retry')">
            <Icon name="refresh" :size="15" /> Régénérer
          </button>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped>
.message {
  display: flex;
  gap: 14px;
}
.message.user {
  justify-content: flex-end;
}
.user-bubble {
  max-width: min(640px, 88%);
  padding: 12px 16px;
  border-radius: var(--radius) var(--radius) 4px var(--radius);
  background: var(--surface-3);
  border: 1px solid var(--border);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.avatar {
  flex: none;
  padding-top: 4px;
}
.assistant-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.prose.streaming > :last-child::after {
  content: '▍';
  color: var(--accent);
  margin-left: 2px;
  animation: blink 1s step-end infinite;
}
.thinking {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--muted);
}
.bar {
  width: 48px;
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  background-size: 200% 100%;
  animation: slide 1.2s linear infinite;
}
@keyframes slide {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
.error-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  background: var(--danger-soft);
  color: var(--danger);
}
.error-card strong {
  color: var(--text);
  font-size: 14px;
}
.error-card p {
  margin: 4px 0 10px;
  color: var(--text-2);
  font-size: 13.5px;
  overflow-wrap: anywhere;
}
.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.aborted {
  font-size: 12px;
  color: var(--muted);
}
.actions {
  display: flex;
  gap: 4px;
  margin-left: -10px;
}
.actions .btn {
  font-size: 12.5px;
  color: var(--muted);
  padding: 5px 10px;
}
.actions .btn:hover {
  color: var(--text);
}
@media (max-width: 600px) {
  .avatar {
    display: none;
  }
}
</style>

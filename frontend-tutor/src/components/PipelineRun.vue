<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { popStage } from '../lib/motion';
import type { Message, StepId } from '../lib/types';
import Icon from './Icon.vue';

const props = defineProps<{ message: Message }>();

const STAGES: { id: StepId; label: string; icon: string }[] = [
  { id: 'plan', label: 'Analyse', icon: 'brain' },
  { id: 'search', label: 'Recherche', icon: 'search' },
  { id: 'read', label: 'Lecture', icon: 'book' },
  { id: 'answer', label: 'Synthèse', icon: 'sparkle' },
];

const expanded = ref(true);
const stagesEl = ref<HTMLElement | null>(null);

watch(
  () => STAGES.map((s) => props.message.steps?.[s.id]?.status),
  async (now, before) => {
    await nextTick();
    now.forEach((status, i) => {
      if (status === before?.[i] || !['done', 'error'].includes(status ?? '')) return;
      const icon = stagesEl.value?.children[i]?.querySelector('.stage-icon');
      if (icon) popStage(icon);
    });
  },
);
const finished = computed(() => props.message.status !== 'streaming');

// Une fois la réponse terminée, le pipeline se replie pour laisser place au contenu.
watch(finished, (done) => {
  if (done && props.message.status === 'done') expanded.value = false;
}, { immediate: true });

const fmt = (ms?: number) => (ms === undefined ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

const hasDetails = computed(
  () => STAGES.some((s) => props.message.steps?.[s.id]?.detail) || !!props.message.plan?.queries?.length,
);

const summary = computed(() => {
  const m = props.message;
  if (m.status === 'streaming') return 'Pipeline en cours…';
  if (m.status === 'aborted') return 'Pipeline interrompu';
  if (m.status === 'error') return 'Pipeline en échec';
  const n = m.sources?.length ?? 0;
  return `Pipeline réussi${m.ms ? ` en ${fmt(m.ms)}` : ''} · ${n} source${n > 1 ? 's' : ''}`;
});
</script>

<template>
  <div class="pipeline" :class="message.status">
    <button class="pipeline-head" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="run-dot" :class="message.status"></span>
      <span class="mono summary">{{ summary }}</span>
      <span v-if="message.meta" class="badge">{{ message.meta.providerLabel }} · {{ message.meta.model }}</span>
      <span v-if="message.meta?.depth === 'deep'" class="badge badge-reputable">approfondi</span>
      <Icon class="chev" :class="{ open: expanded }" name="chevron" :size="14" />
    </button>

    <ol ref="stagesEl" class="stages" aria-label="Étapes de recherche">
      <li v-for="(stage, i) in STAGES" :key="stage.id" class="stage" :class="message.steps?.[stage.id]?.status ?? 'pending'">
        <span class="stage-icon">
          <span v-if="message.steps?.[stage.id]?.status === 'running'" class="spinner"></span>
          <Icon v-else-if="message.steps?.[stage.id]?.status === 'done'" name="check" :size="13" />
          <Icon v-else-if="message.steps?.[stage.id]?.status === 'error'" name="x" :size="13" />
          <Icon v-else-if="message.steps?.[stage.id]?.status === 'skipped'" name="skip" :size="13" />
          <Icon v-else :name="stage.icon" :size="13" />
        </span>
        <span class="stage-text">
          <span class="stage-label">{{ stage.label }}</span>
          <span class="stage-ms mono">{{ fmt(message.steps?.[stage.id]?.ms) }}</span>
        </span>
        <span v-if="i < STAGES.length - 1" class="connector" aria-hidden="true"></span>
      </li>
    </ol>

    <div v-if="expanded && hasDetails" class="details">
      <template v-for="stage in STAGES" :key="stage.id">
        <div v-if="message.steps?.[stage.id]?.detail" class="detail-line mono">
          <span class="detail-key">{{ stage.id }}</span>
          <span>{{ message.steps[stage.id].detail }}</span>
        </div>
      </template>
      <div v-if="message.plan?.queries?.length" class="queries">
        <span v-for="q in message.plan.queries" :key="q" class="query mono"><Icon name="search" :size="12" /> {{ q }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pipeline {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  overflow: hidden;
}
.pipeline.streaming {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}
.pipeline-head {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 10px 14px;
  background: none;
  border: none;
  text-align: left;
}
.summary {
  font-size: 12.5px;
  font-weight: 500;
  margin-right: auto;
}
.run-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  flex: none;
}
.run-dot.streaming {
  background: var(--amber);
  box-shadow: 0 0 0 0 var(--amber);
  animation: pulse 1.4s infinite;
}
.run-dot.error {
  background: var(--danger);
}
.run-dot.aborted {
  background: var(--muted);
}
@keyframes pulse {
  70% {
    box-shadow: 0 0 0 7px transparent;
  }
}
.chev {
  color: var(--muted);
  transition: transform 0.2s;
}
.chev.open {
  transform: rotate(90deg);
}
.stages {
  list-style: none;
  margin: 0;
  padding: 2px 14px 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.stage {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.stage-icon {
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
}
.stage.running .stage-icon {
  border-color: var(--amber);
  color: var(--amber);
}
.stage.done .stage-icon {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: var(--accent-soft);
  color: var(--accent);
}
.stage.error .stage-icon {
  border-color: color-mix(in srgb, var(--danger) 50%, transparent);
  background: var(--danger-soft);
  color: var(--danger);
}
.stage-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}
.stage-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.stage.pending .stage-label,
.stage.skipped .stage-label {
  color: var(--muted);
}
.stage-ms {
  font-size: 10.5px;
  color: var(--muted);
  min-height: 12px;
}
.connector {
  flex: 1;
  height: 1px;
  margin: 0 4px;
  background: repeating-linear-gradient(90deg, var(--border-strong) 0 4px, transparent 4px 8px);
}
.stage.done .connector {
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--amber) 30%, transparent);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.details {
  border-top: 1px dashed var(--border);
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface-2);
}
.detail-line {
  display: flex;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-2);
}
.detail-key {
  color: var(--accent);
  min-width: 52px;
}
.detail-key::after {
  content: ' ›';
  color: var(--muted);
}
.queries {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.query {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 6px;
  color: var(--text-2);
  border: 1px solid var(--border);
  background: var(--surface);
}
@media (max-width: 600px) {
  .stages {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 10px;
  }
  .connector {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { pressFeedback } from '../lib/motion';
import Icon from './Icon.vue';

const props = defineProps<{ busy: boolean; offline?: boolean }>();
const emit = defineEmits<{ send: [text: string]; stop: [] }>();
const { settings } = useSettings();

const text = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const sendBtn = ref<HTMLElement | null>(null);

function autosize() {
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
}
watch(text, () => nextTick(autosize));

function submit() {
  if (props.busy || props.offline || !text.value.trim()) return;
  if (sendBtn.value) pressFeedback(sendBtn.value);
  emit('send', text.value);
  text.value = '';
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submit();
  }
}

function focus() {
  input.value?.focus();
}
defineExpose({ focus });
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <div class="box" :class="{ busy }">
      <textarea
        ref="input"
        v-model="text"
        rows="1"
        maxlength="8000"
        placeholder="Pose ta question DevOps… (colle un message d'erreur, un YAML, un Dockerfile)"
        aria-label="Ta question"
        @keydown="onKeydown"
      ></textarea>
      <div class="toolbar">
        <div class="depth" role="radiogroup" aria-label="Profondeur de recherche">
          <button
            type="button"
            role="radio"
            :aria-checked="settings.depth === 'standard'"
            :class="{ active: settings.depth === 'standard' }"
            title="3 requêtes, ~6 sources : rapide"
            @click="settings.depth = 'standard'"
          >
            <Icon name="zap" :size="13" /> Standard
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="settings.depth === 'deep'"
            :class="{ active: settings.depth === 'deep' }"
            title="5 requêtes, ~10 sources, 2 moteurs : plus lent mais plus complet"
            @click="settings.depth = 'deep'"
          >
            <Icon name="search" :size="13" /> Approfondi
          </button>
        </div>
        <span class="hint mono">Entrée ↵ envoyer · Maj+Entrée nouvelle ligne</span>
        <button v-if="busy" type="button" class="btn send stop" aria-label="Arrêter la génération" @click="emit('stop')">
          <Icon name="stop" :size="15" />
        </button>
        <button v-else type="submit" class="btn btn-primary send" ref="sendBtn" :disabled="!text.trim() || offline" aria-label="Envoyer">
          <Icon name="send" :size="15" />
        </button>
      </div>
    </div>
    <p class="disclaimer">
      Les réponses s'appuient sur des sources publiques citées [n]. Vérifie toujours avant d'appliquer en production.
    </p>
  </form>
</template>

<style scoped>
.composer {
  max-width: 880px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px 14px;
}
.box {
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.box:focus-within {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
  box-shadow: var(--shadow), var(--glow);
}
textarea {
  display: block;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  padding: 14px 16px 6px;
  font-size: 15px;
  line-height: 1.55;
  max-height: 220px;
}
textarea::placeholder {
  color: var(--muted);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 8px 10px;
}
.depth {
  display: inline-flex;
  padding: 2px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.depth button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  padding: 4px 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.depth button.active {
  background: var(--surface-3);
  color: var(--text);
  box-shadow: 0 1px 0 var(--border-strong);
}
.depth button.active .icon {
  color: var(--accent);
}
.hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--muted);
}
.send {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: 10px;
}
.stop {
  background: var(--danger-soft);
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  color: var(--danger);
}
.disclaimer {
  margin: 8px 0 0;
  text-align: center;
  font-size: 11.5px;
  color: var(--muted);
}
@media (max-width: 600px) {
  .composer {
    padding: 0 calc(10px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));
  }
  textarea {
    font-size: 16px; /* évite le zoom automatique d'iOS */
    padding: 12px 14px 4px;
  }
  .disclaimer {
    display: none;
  }
  .depth button {
    padding: 6px 10px;
  }
  .hint {
    display: none;
  }
  .send {
    margin-left: auto;
  }
}
</style>

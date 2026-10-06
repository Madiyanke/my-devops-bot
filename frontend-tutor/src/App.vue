<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import ChatComposer from './components/ChatComposer.vue';
import ChatMessage from './components/ChatMessage.vue';
import EmptyState from './components/EmptyState.vue';
import Icon from './components/Icon.vue';
import SettingsModal from './components/SettingsModal.vue';
import { useChat } from './composables/useChat';
import { usePwa } from './composables/usePwa';
import { useSettings } from './composables/useSettings';

const { current, busy, ask, retry, stop, newConversation } = useChat();
const { refreshConfig, activeModelLabel, isReady, serverConfig } = useSettings();
const { online, needRefresh, applyUpdate, dismissUpdate } = usePwa();

const sidebarOpen = ref(false);
const settingsOpen = ref(false);
const scroller = ref<HTMLElement | null>(null);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
let stickToBottom = true;

function onScroll() {
  const el = scroller.value;
  if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

async function scrollToBottom(force = false) {
  await nextTick();
  const el = scroller.value;
  if (el && (force || stickToBottom)) el.scrollTop = el.scrollHeight;
}

// Suit le texte pendant le streaming, sauf si l'utilisateur remonte pour lire.
watch(
  () => {
    const last = current.value?.messages.at(-1);
    return [current.value?.id, current.value?.messages.length, last?.content.length, last?.status];
  },
  () => void scrollToBottom(),
  { flush: 'post' },
);

async function send(text: string) {
  stickToBottom = true;
  void scrollToBottom(true);
  await ask(text);
}

function onShortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    newConversation();
    composer.value?.focus();
  }
}

onMounted(async () => {
  document.addEventListener('keydown', onShortcut);
  // Raccourci « Nouvelle question » de l'application installée.
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) {
    newConversation();
    composer.value?.focus();
    window.history.replaceState(null, '', window.location.pathname);
  }
  await refreshConfig();
  // Premier lancement sans IA disponible : on ouvre directement les paramètres.
  if (serverConfig.value && !isReady.value) settingsOpen.value = true;
});
onBeforeUnmount(() => document.removeEventListener('keydown', onShortcut));
</script>

<template>
  <div class="shell">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" @settings="settingsOpen = true" />
    <div v-if="sidebarOpen" class="scrim" @click="sidebarOpen = false"></div>

    <main class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu" aria-label="Ouvrir le menu" @click="sidebarOpen = true">
          <Icon name="menu" />
        </button>
        <h1 class="topbar-title">{{ current?.title ?? 'Nouvelle session' }}</h1>
        <button class="model-pill mono" :class="{ warn: !isReady }" @click="settingsOpen = true">
          <span class="dot" :class="isReady ? 'dot-ok' : 'dot-warn'"></span>
          {{ activeModelLabel ?? 'Configurer une IA' }}
        </button>
      </header>

      <div v-if="!online" class="offline mono" role="status">
        <Icon name="wifi-off" :size="14" /> Hors ligne : ton historique reste consultable, l'envoi reprendra au retour du réseau.
      </div>

      <div ref="scroller" class="scroller" @scroll.passive="onScroll">
        <EmptyState v-if="!current || current.messages.length === 0" @ask="send" />
        <div v-else class="thread">
          <ChatMessage
            v-for="(m, i) in current.messages"
            :key="m.id"
            :message="m"
            :last="i === current.messages.length - 1"
            @retry="retry"
            @settings="settingsOpen = true"
          />
        </div>
      </div>

      <ChatComposer ref="composer" :busy="busy" :offline="!online" @send="send" @stop="stop" />
    </main>

    <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />

    <div v-if="needRefresh" class="toast" role="status">
      <Icon name="sparkle" :size="16" />
      <span>Une nouvelle version est disponible.</span>
      <button class="btn btn-primary" :disabled="busy" @click="applyUpdate">Mettre à jour</button>
      <button class="btn btn-ghost btn-icon" aria-label="Plus tard" @click="dismissUpdate"><Icon name="x" :size="14" /></button>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(10px);
}
.menu {
  display: none;
}
.topbar-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 50%;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.model-pill:hover {
  border-color: var(--border-strong);
}
.model-pill.warn {
  color: var(--amber);
  border-color: color-mix(in srgb, var(--amber) 40%, transparent);
}
.offline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 16px;
  font-size: 11.5px;
  text-align: center;
  color: var(--amber);
  background: var(--amber-soft);
  border-bottom: 1px solid color-mix(in srgb, var(--amber) 30%, transparent);
}
.toast {
  position: fixed;
  z-index: 70;
  left: 50%;
  bottom: calc(110px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow), var(--glow);
  font-size: 13.5px;
  animation: fade-up 0.3s ease both;
}
.toast > .icon {
  color: var(--accent);
}
.scroller {
  flex: 1;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
  scroll-behavior: smooth;
}
.thread {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.scrim {
  display: none;
}
@media (max-width: 900px) {
  .menu {
    display: inline-flex;
  }
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(0, 0, 0, 0.5);
  }
  .topbar {
    padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px calc(8px + env(safe-area-inset-left));
  }
  .model-pill {
    max-width: 46vw;
  }
  .thread {
    padding: 20px 16px 24px;
  }
}
</style>

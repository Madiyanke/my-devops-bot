<script setup lang="ts">
import { computed } from 'vue';
import { useChat } from '../composables/useChat';
import { usePwa } from '../composables/usePwa';
import { useSettings } from '../composables/useSettings';
import BrandLogo from './BrandLogo.vue';
import Icon from './Icon.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; settings: [] }>();

const { conversations, currentId, select, remove, newConversation } = useChat();
const { settings, activeModelLabel, isReady, configError } = useSettings();
const { canInstall, showIosHint, install } = usePwa();

const groups = computed(() => {
  const today = new Date().setHours(0, 0, 0, 0);
  const week = today - 6 * 86_400_000;
  const buckets = [
    { label: "Aujourd'hui", items: [] as typeof conversations.value },
    { label: '7 derniers jours', items: [] as typeof conversations.value },
    { label: 'Plus ancien', items: [] as typeof conversations.value },
  ];
  for (const c of conversations.value) {
    buckets[c.updatedAt >= today ? 0 : c.updatedAt >= week ? 1 : 2].items.push(c);
  }
  return buckets.filter((b) => b.items.length > 0);
});

function pick(id: string) {
  select(id);
  emit('close');
}

function fresh() {
  newConversation();
  emit('close');
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <BrandLogo orbit />
      <div>
        <div class="brand-name">DevOps Mentor</div>
        <div class="brand-sub mono">research · verify · teach</div>
      </div>
      <button class="btn btn-ghost btn-icon close" aria-label="Fermer le menu" @click="emit('close')">
        <Icon name="x" />
      </button>
    </div>

    <button class="btn new-chat" @click="fresh">
      <Icon name="plus" :size="16" />
      Nouvelle session
      <span class="kbd mono">Ctrl K</span>
    </button>

    <nav class="history" aria-label="Historique des conversations">
      <p v-if="groups.length === 0" class="empty">
        Tes sessions apparaîtront ici. Elles restent stockées dans ce navigateur.
      </p>
      <section v-for="group in groups" :key="group.label">
        <h3 class="group-label mono">{{ group.label }}</h3>
        <div
          v-for="c in group.items"
          :key="c.id"
          class="history-item"
          :class="{ active: c.id === currentId }"
        >
          <button class="history-title" :title="c.title" @click="pick(c.id)">
            <Icon name="terminal" :size="14" />
            <span>{{ c.title }}</span>
          </button>
          <button class="history-delete" aria-label="Supprimer la session" @click="remove(c.id)">
            <Icon name="trash" :size="14" />
          </button>
        </div>
      </section>
    </nav>

    <button v-if="canInstall" class="btn install" @click="install">
      <Icon name="download" :size="16" />
      <span>Installer l'application</span>
    </button>
    <p v-else-if="showIosHint" class="ios-hint">
      <Icon name="share" :size="14" />
      Sur iPhone : <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong> pour installer l'app.
    </p>

    <footer class="sidebar-foot">
      <button class="status" :title="configError || 'Configurer le modèle IA'" @click="emit('settings')">
        <span class="dot" :class="isReady ? 'dot-ok' : 'dot-warn'"></span>
        <span class="status-text">
          <span class="status-label">{{ isReady ? 'IA connectée' : 'IA non configurée' }}</span>
          <span class="status-model mono">{{ activeModelLabel ?? 'Ajoute une clé API' }}</span>
        </span>
        <Icon name="settings" :size="16" />
      </button>
      <button
        class="btn btn-icon theme"
        :aria-label="settings.theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'"
        @click="settings.theme = settings.theme === 'dark' ? 'light' : 'dark'"
      >
        <Icon :name="settings.theme === 'dark' ? 'sun' : 'moon'" :size="16" />
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 14px 14px;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(12px);
  height: 100%;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
}
.brand-sub {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.close {
  margin-left: auto;
  display: none;
}
.new-chat {
  justify-content: flex-start;
  width: 100%;
  padding: 10px 12px;
  border-style: dashed;
}
.new-chat:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.kbd {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 5px;
}
.history {
  flex: 1;
  overflow-y: auto;
  margin: 0 -6px;
  padding: 0 6px;
}
.empty {
  font-size: 13px;
  color: var(--muted);
  padding: 8px 6px;
}
.group-label {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 14px 8px 6px;
}
.history-item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
}
.history-item:hover {
  background: var(--surface-2);
}
.history-item.active {
  background: var(--surface-3);
  border-color: var(--border);
}
.history-item.active .history-title {
  color: var(--text);
}
.history-item.active .icon {
  color: var(--accent);
}
.history-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  background: none;
  border: none;
  padding: 8px 6px 8px 10px;
  text-align: left;
  font-size: 13.5px;
  color: var(--text-2);
}
.history-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-title .icon {
  color: var(--muted);
}
.history-delete {
  opacity: 0;
  background: none;
  border: none;
  color: var(--muted);
  padding: 6px 8px;
  border-radius: 6px;
}
.history-item:hover .history-delete,
.history-delete:focus-visible {
  opacity: 1;
}
.history-delete:hover {
  color: var(--danger);
}
.install {
  width: 100%;
  justify-content: center;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-soft);
}
.ios-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-2);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
}
.ios-hint .icon {
  color: var(--cyan);
  margin-top: 2px;
}
.sidebar-foot {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.status {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: left;
}
.status:hover {
  border-color: var(--border-strong);
}
.status-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.status-label {
  font-size: 12.5px;
  font-weight: 600;
}
.status-model {
  font-size: 10.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (hover: none) {
  /* Écrans tactiles : pas de survol, le bouton de suppression reste visible */
  .history-delete {
    opacity: 0.6;
  }
}
@media (max-width: 900px) {
  .sidebar {
    width: min(86vw, 320px);
    padding-top: calc(18px + env(safe-area-inset-top));
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
    padding-left: calc(14px + env(safe-area-inset-left));
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: var(--shadow);
    background: var(--surface);
  }
  .sidebar.open {
    transform: none;
  }
  .close {
    display: inline-flex;
  }
}
</style>

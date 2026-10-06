<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { enterSources } from '../lib/motion';
import type { Source } from '../lib/types';
import Icon from './Icon.vue';

defineProps<{ sources: Source[] }>();

const list = ref<HTMLElement | null>(null);
onMounted(() => enterSources([...(list.value?.children ?? [])]));

const hue = (domain: string) => [...domain].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
</script>

<template>
  <div class="sources">
    <div class="sources-head mono">
      <Icon name="globe" :size="13" /> {{ sources.length }} sources consultées
    </div>
    <div ref="list" class="sources-list">
      <a
        v-for="s in sources"
        :key="s.id"
        class="source"
        :href="s.url"
        target="_blank"
        rel="noopener noreferrer"
        :title="s.snippet || s.title"
      >
        <span class="source-top">
          <span class="source-id mono">{{ s.id }}</span>
          <span class="source-favicon" :style="{ '--h': hue(s.domain) }">{{ s.domain.charAt(0).toUpperCase() }}</span>
          <span class="source-domain mono">{{ s.domain }}</span>
          <Icon class="source-ext" name="external" :size="12" />
        </span>
        <span class="source-title">{{ s.title }}</span>
        <span v-if="s.trust" class="badge" :class="s.trust === 'official' ? 'badge-official' : 'badge-reputable'">
          {{ s.trust === 'official' ? 'Doc officielle' : 'Référence' }}
        </span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.sources-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--muted);
  margin-bottom: 8px;
}
.sources-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x proximity;
}
.source {
  scroll-snap-align: start;
  flex: 0 0 216px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.source:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.source-top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.source-id {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 5px;
  padding: 0 5px;
}
.source-favicon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: hsl(var(--h) 55% 42%);
  flex: none;
}
.source-domain {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-ext {
  margin-left: auto;
  color: var(--muted);
}
.source-title {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.source .badge {
  align-self: flex-start;
  margin-top: auto;
}
</style>

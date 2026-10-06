<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import type { JSAnimation } from 'animejs';
import { orbitLogo } from '../lib/motion';

const props = withDefaults(defineProps<{ size?: number; orbit?: boolean }>(), { size: 34, orbit: false });

const gradientId = `dm-loop-${useId()}`;
const path = ref<SVGPathElement | null>(null);
const dot = ref<SVGCircleElement | null>(null);
let animation: JSAnimation | null = null;

onMounted(() => {
  if (!props.orbit || !path.value || !dot.value) return;
  animation = orbitLogo(path.value, dot.value);
  // Animations réduites : le point reste immobile sur la boucle.
  if (!animation) dot.value.setAttribute('transform', 'translate(32.6 17.4)');
});
onBeforeUnmount(() => animation?.revert());
</script>

<template>
  <!-- Boucle infinie DevOps (Plan → Build → Deploy → Operate) -->
  <svg :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true" class="brand-logo">
    <defs>
      <linearGradient :id="gradientId" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#3ddc97" />
        <stop offset="1" stop-color="#38bdf8" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="#0b1219" :stroke="`url(#${gradientId})`" stroke-opacity=".5" />
    <path
      ref="path"
      class="loop-path"
      d="M24 24c-3.2-4.4-5.6-6.6-8.6-6.6a6.6 6.6 0 1 0 0 13.2c3 0 5.4-2.2 8.6-6.6s5.6-6.6 8.6-6.6a6.6 6.6 0 1 1 0 13.2c-3 0-5.4-2.2-8.6-6.6z"
      fill="none"
      :stroke="`url(#${gradientId})`"
      stroke-width="3.2"
      stroke-linecap="round"
    />
    <circle v-if="orbit" ref="dot" class="orbit-dot" r="2.3" fill="#eafff5" />
    <circle v-else cx="32.6" cy="17.4" r="2.2" fill="#3ddc97" />
  </svg>
</template>

<style scoped>
.orbit-dot {
  filter: drop-shadow(0 0 2.5px #3ddc97) drop-shadow(0 0 5px #3ddc97);
}
</style>

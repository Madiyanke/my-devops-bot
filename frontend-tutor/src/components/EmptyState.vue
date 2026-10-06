<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { playHeroIntro, reducedMotion } from '../lib/motion';
import BrandLogo from './BrandLogo.vue';
import Icon from './Icon.vue';

const emit = defineEmits<{ ask: [question: string] }>();

const SUGGESTIONS = [
  { tag: 'Kubernetes', icon: 'wheel', q: 'Quelle est la différence entre liveness, readiness et startup probes, et comment les configurer correctement ?' },
  { tag: 'CI/CD', icon: 'branch', q: 'Comment construire un pipeline GitHub Actions sécurisé qui build, scanne et pousse une image Docker ?' },
  { tag: 'IaC', icon: 'layers', q: 'Comment organiser un projet Terraform multi-environnements avec un state distant verrouillé ?' },
  { tag: 'Observabilité', icon: 'activity', q: 'Comment définir des SLO et des alertes Prometheus basées sur le burn rate ?' },
  { tag: 'Docker', icon: 'box', q: "Comment réduire la taille et la surface d'attaque d'une image Docker Node.js ?" },
  { tag: 'DevSecOps', icon: 'lock', q: 'Comment gérer les secrets dans Kubernetes : Secrets natifs, Sealed Secrets ou External Secrets ?' },
];

const COMMAND = 'mentor ask --research --cite-sources';
const typed = ref('');
const root = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (root.value) playHeroIntro(root.value);
  let i = 0;
  // La commande se tape une fois l'intro animée lancée.
  const start = reducedMotion() ? 0 : 900;
  timer = setTimeout(() => (timer = setInterval(type, 38)), start);
  const type = () => {
    typed.value = COMMAND.slice(0, ++i);
    if (i >= COMMAND.length) clearInterval(timer);
  };
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  clearInterval(timer);
});
</script>

<template>
  <section ref="root" class="empty-state">
    <div class="hero">
      <div data-anim="logo"><BrandLogo :size="60" orbit /></div>
      <h1><span data-anim="title">Ton mentor DevOps</span> <span class="grad" data-anim="fade">senior.</span></h1>
      <p class="tagline" data-anim="fade">
        Chaque réponse est <strong>recherchée</strong>, <strong>vérifiée</strong> dans la documentation officielle
        et <strong>sourcée</strong>. Pas d'invention, que de la pédagogie.
      </p>
      <div class="terminal mono" data-anim="fade" aria-hidden="true">
        <span class="prompt">~/devops $</span> {{ typed }}<span class="caret">▍</span>
      </div>
    </div>

    <ul class="features">
      <li data-anim="feature"><Icon name="search" :size="16" /> Recherche multi-sources</li>
      <li data-anim="feature"><Icon name="book" :size="16" /> Docs officielles prioritaires</li>
      <li data-anim="feature"><Icon name="shield" :size="16" /> Citations vérifiables</li>
      <li data-anim="feature"><Icon name="brain" :size="16" /> Explications pédagogiques</li>
    </ul>

    <div class="suggestions">
      <button v-for="s in SUGGESTIONS" :key="s.tag" class="suggestion" data-anim="card" @click="emit('ask', s.q)">
        <span class="suggestion-tag mono"><Icon :name="s.icon" :size="14" /> {{ s.tag }}</span>
        <span class="suggestion-q">{{ s.q }}</span>
        <Icon class="suggestion-go" name="chevron" :size="16" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.empty-state {
  max-width: 880px;
  margin: 0 auto;
  padding: 56px 24px 24px;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}
h1 {
  margin: 8px 0 0;
  font-size: clamp(28px, 4.4vw, 42px);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.grad {
  background: linear-gradient(90deg, var(--accent), var(--cyan));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tagline {
  margin: 0;
  max-width: 560px;
  color: var(--text-2);
  font-size: 15.5px;
}
.tagline strong {
  color: var(--text);
}
.terminal {
  margin-top: 6px;
  padding: 10px 16px;
  min-width: min(440px, 100%);
  text-align: left;
  font-size: 13px;
  color: var(--text);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--glow);
}
:root[data-theme='light'] .terminal {
  color: #e6edf3;
}
.prompt {
  color: var(--accent);
}
.caret {
  color: var(--accent);
  animation: blink 1s step-end infinite;
}
.features {
  list-style: none;
  padding: 0;
  margin: 28px 0 26px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  color: var(--text-2);
  font-size: 13px;
}
.features li {
  display: flex;
  align-items: center;
  gap: 7px;
}
.features .icon {
  color: var(--accent);
}
.suggestions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.suggestion {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: 14px 36px 14px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.suggestion:hover {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.suggestion-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--accent);
}
.suggestion-q {
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.5;
}
.suggestion-go {
  position: absolute;
  right: 12px;
  top: 14px;
  color: var(--muted);
  transition: transform 0.15s, color 0.15s;
}
.suggestion:hover .suggestion-go {
  color: var(--accent);
  transform: translateX(2px);
}
@media (max-width: 600px) {
  .empty-state {
    padding: 24px 0 12px;
  }
  .hero,
  .features {
    padding: 0 16px;
  }
  .tagline {
    font-size: 14.5px;
  }
  .terminal {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
  }
  .features {
    margin: 20px 0 18px;
    gap: 8px 14px;
    font-size: 12px;
  }
  /* Carrousel horizontal à faire glisser, comme une app native */
  .suggestions {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 4px 16px 10px;
    scroll-padding: 0 16px;
    scrollbar-width: none;
  }
  .suggestions::-webkit-scrollbar {
    display: none;
  }
  .suggestion {
    flex: 0 0 78%;
    scroll-snap-align: start;
  }
}
</style>

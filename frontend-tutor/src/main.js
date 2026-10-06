import './assets/theme.css'

import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { bindServiceWorker, signalUpdate } from './composables/usePwa'

createApp(App).mount('#app')

// Service worker : application installable et utilisable hors ligne.
// Une nouvelle version n'est appliquée qu'après accord (pour ne pas couper une réponse en cours).
const updateSW = registerSW({
  onNeedRefresh: signalUpdate,
  onRegisteredSW(_url, registration) {
    // Vérifie les mises à jour toutes les heures pour les applis restées ouvertes.
    if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})
bindServiceWorker(updateSW)

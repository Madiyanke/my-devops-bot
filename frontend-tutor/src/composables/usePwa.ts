import { computed, ref, shallowRef } from 'vue';

/** Évènement Chrome/Edge/Android permettant d'afficher notre propre bouton « Installer ». */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const hasWindow = typeof window !== 'undefined';

const online = ref(hasWindow ? navigator.onLine : true);
const installEvent = shallowRef<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);
const needRefresh = ref(false);
let updater: ((reload?: boolean) => Promise<void>) | null = null;

const isStandalone = () =>
  hasWindow &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

// iOS (Safari) ne propose pas d'installation automatique : on affiche la marche à suivre.
const isIos = hasWindow && /iphone|ipad|ipod/i.test(navigator.userAgent);

if (hasWindow) {
  window.addEventListener('online', () => (online.value = true));
  window.addEventListener('offline', () => (online.value = false));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installEvent.value = null;
    installed.value = true;
  });
}

/** Appelé par main.js une fois le service worker enregistré. */
export function bindServiceWorker(update: (reload?: boolean) => Promise<void>) {
  updater = update;
}

export function signalUpdate() {
  needRefresh.value = true;
}

async function install() {
  const event = installEvent.value;
  if (!event) return;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') installed.value = true;
  installEvent.value = null;
}

async function applyUpdate() {
  needRefresh.value = false;
  await updater?.(true);
}

export function usePwa() {
  return {
    online,
    needRefresh,
    canInstall: computed(() => !!installEvent.value && !installed.value),
    showIosHint: computed(() => isIos && !isStandalone() && !installed.value),
    install,
    applyUpdate,
    dismissUpdate: () => (needRefresh.value = false),
  };
}

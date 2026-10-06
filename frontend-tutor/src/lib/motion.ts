import {
  animate,
  createDrawable,
  createMotionPath,
  createSpring,
  createTimeline,
  set,
  splitText,
  stagger,
  type JSAnimation,
} from 'animejs';

/**
 * Animations de l'interface (anime.js v4).
 * Toutes sont désactivées si l'utilisateur a demandé à réduire les animations.
 */
export const reducedMotion = (): boolean =>
  typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bouncy = createSpring({ stiffness: 260, damping: 18 });

/** Écran d'accueil : logo tracé, titre lettre par lettre, cartes en cascade. */
export function playHeroIntro(root: HTMLElement): void {
  if (reducedMotion()) return;
  const q = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T & Element>(sel)];

  const title = root.querySelector<HTMLElement>('[data-anim="title"]');
  const chars = title ? splitText(title, { chars: true }).chars : [];
  const loop = q<SVGGeometryElement>('[data-anim="logo"] .loop-path');

  // État initial posé avant le premier rendu : aucun clignotement.
  set([...chars, ...q('[data-anim="logo"], [data-anim="fade"], [data-anim="feature"], [data-anim="card"]')], { opacity: 0 });

  const tl = createTimeline({ defaults: { ease: 'outExpo' } });
  if (loop.length) {
    tl.add(createDrawable(loop), { draw: ['0 0', '0 1'], duration: 1100, ease: 'inOutQuart' }, 0);
  }
  tl.add(q('[data-anim="logo"]'), { scale: [0.6, 1], opacity: [0, 1], duration: 700, ease: bouncy }, 0)
    .add(chars, { y: ['110%', '0%'], opacity: [0, 1], duration: 650, delay: stagger(18) }, 250)
    .add(q('[data-anim="fade"]'), { y: [14, 0], opacity: [0, 1], duration: 600, delay: stagger(90) }, 500)
    .add(q('[data-anim="feature"]'), { y: [10, 0], opacity: [0, 1], duration: 500, delay: stagger(60) }, 750)
    .add(
      q('[data-anim="card"]'),
      { y: [26, 0], scale: [0.96, 1], opacity: [0, 1], duration: 700, delay: stagger(70, { grid: [3, 2], from: 'first' }) },
      850,
    );
}

/** Un point lumineux parcourt la boucle infinie DevOps du logo, en continu. */
export function orbitLogo(path: SVGGeometryElement, dot: SVGElement, duration = 5200): JSAnimation | null {
  if (reducedMotion()) return null;
  return animate(dot, {
    ...createMotionPath(path),
    duration,
    loop: true,
    ease: 'linear',
  });
}

/** Apparition d'un message (bulle utilisateur ou réponse du mentor). */
export function enterMessage(el: Element, fromRight = false): void {
  if (reducedMotion()) return;
  animate(el, {
    opacity: [0, 1],
    x: [fromRight ? 18 : -10, 0],
    y: [10, 0],
    duration: 550,
    ease: 'outExpo',
  });
}

/** Les cartes de sources glissent en cascade. */
export function enterSources(cards: Element[]): void {
  if (reducedMotion() || cards.length === 0) return;
  animate(cards, {
    opacity: [0, 1],
    x: [40, 0],
    scale: [0.94, 1],
    duration: 600,
    delay: stagger(65),
    ease: 'outExpo',
  });
}

/** Rebond de l'icône d'une étape du pipeline quand son statut change. */
export function popStage(el: Element): void {
  if (reducedMotion()) return;
  animate(el, { scale: [0.55, 1], rotate: [-25, 0], duration: 700, ease: bouncy });
}

/** Ouverture de la fenêtre des paramètres (panneau du bas sur mobile). */
export function openSheet(panel: Element, backdrop: Element, mobile: boolean): void {
  if (reducedMotion()) return;
  animate(backdrop, { opacity: [0, 1], duration: 250, ease: 'outQuad' });
  animate(
    panel,
    mobile
      ? { y: ['100%', '0%'], duration: 520, ease: 'outExpo' }
      : { opacity: [0, 1], scale: [0.94, 1], y: [16, 0], duration: 450, ease: bouncy },
  );
}

/** Petit retour tactile sur un bouton (envoi, installation…). */
export function pressFeedback(el: Element): void {
  if (reducedMotion()) return;
  animate(el, { scale: [0.86, 1], duration: 600, ease: bouncy });
}

/** Secousse discrète pour signaler une erreur. */
export function shake(el: Element): void {
  if (reducedMotion()) return;
  animate(el, { x: [0, -8, 7, -5, 3, 0], duration: 480, ease: 'outQuad' });
}

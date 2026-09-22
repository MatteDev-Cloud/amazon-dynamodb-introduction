import gsap from 'gsap';
import { cubicIn, expoOut } from 'svelte/easing';
import { reducedMotion } from '../shared/ui';

/** Entrance for a scene element (or its children with `stagger`). */
export function reveal(node: HTMLElement, opts: { delay?: number; y?: number; stagger?: number; x?: number } = {}) {
  if (reducedMotion()) return;
  const targets = opts.stagger ? Array.from(node.children) : node;
  const tween = gsap.from(targets, { opacity: 0, y: opts.y ?? 28, x: opts.x ?? 0, duration: 1, ease: 'expo.out', delay: .28 + (opts.delay ?? 0), stagger: opts.stagger, clearProps: 'transform,opacity' });
  return { destroy: () => { tween.kill(); } };
}

/** Scene transitions: the next scene arrives from the travel direction, the old one recedes. */
export function sceneIn(_node: Element, { dir }: { dir: number }) {
  return { duration: reducedMotion() ? 0 : 950, easing: expoOut, css: (t: number, u: number) => `opacity:${Math.min(1, t * 1.8)};transform:translate3d(${u * dir * 14}%,0,0) scale(${1 + u * .04})` };
}
export function sceneOut(_node: Element, { dir }: { dir: number }) {
  return { duration: reducedMotion() ? 0 : 650, easing: cubicIn, css: (t: number, u: number) => `opacity:${t};transform:translate3d(${-u * dir * 10}%,0,0) scale(${1 - u * .06})` };
}

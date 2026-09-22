import './styles/app.css';
import { mount } from 'svelte';
import { api } from './shared/runtime';
import { config } from './shared/config';

if (config.mock) { const { mockTransport } = await import('./shared/mock'); api.transport = mockTransport; }
const target = document.querySelector<HTMLElement>('#app')!;
const path = location.pathname.replace(/\/$/, '');
// /play: phones · /regia: presenter's second screen · anything else: the LIM.
const view = path === '/play' ? (await import('./play/Play.svelte')).default
  : path === '/regia' ? (await import('./regia/Regia.svelte')).default
  : (await import('./stage/Stage.svelte')).default;
document.documentElement.dataset.view = path === '/play' ? 'play' : path === '/regia' ? 'regia' : 'stage';
mount(view, { target });

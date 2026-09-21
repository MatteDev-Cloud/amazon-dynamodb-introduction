import './shared/tokens.css';
import { Api } from './shared/api';
import { config } from './shared/config';
import { startPlay } from './play/play';
import { startStage } from './stage/stage';
const api=new Api();
if(config.mock){const {mockTransport}=await import('./shared/mock');api.transport=mockTransport;}
const root=document.querySelector<HTMLElement>('#app')!;
if(location.pathname==='/play')startPlay(root,api);else startStage(root,api);

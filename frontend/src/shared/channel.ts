import { channelName } from './config';

/** Stage (LIM) state as the Regia sees it. */
export interface StageState { scene: number; step: number; steps: number; busy: boolean; notice: string; xray: boolean; meter: boolean; detail: { x: number; y: number } | null; keyed: boolean }

export type Message =
  | { t: 'hello' }                                   // regia → stage: send me your state
  | { t: 'state'; state: StageState }                // stage → regia
  | { t: 'need-key' }                                // stage → regia
  | { t: 'key'; key: string }                        // regia → stage
  | { t: 'next' } | { t: 'prev' }
  | { t: 'go'; scene: number }                       // visual jump, never changes META
  | { t: 'toggle'; what: 'xray' | 'meter' }
  | { t: 'countdown' }                               // HOT KEY 3-2-1
  | { t: 'pixel'; x: number; y: number }             // open pixel detail on the LIM
  | { t: 'close-detail' }
  | { t: 'lit'; x: number; y: number; c: number; by: string; at: number } // swarm write accepted
  | { t: 'conflict'; x: number; y: number }          // swarm write rejected: cell already lit
  | { t: 'video' } | { t: 'reload' };

export function openChannel(onmessage: (message: Message) => void) {
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = event => onmessage(event.data as Message);
  return { send: (message: Message) => channel.postMessage(message), close: () => channel.close() };
}

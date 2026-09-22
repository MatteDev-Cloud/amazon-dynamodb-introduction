import { Api } from './api';
/** One API client per page; main.ts swaps in the mock transport before mounting. */
export const api = new Api();

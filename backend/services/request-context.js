import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();
export const requestSignal = () => context.getStore();
export const withRequestSignal = (signal, operation) => context.run(signal, operation);
export const assertRequestActive = () => requestSignal()?.throwIfAborted();

// Also protects injected providers that do not themselves support cancellation.
export const requestProvider = provider => async (...args) => {
  assertRequestActive();
  const result = await provider(...args);
  assertRequestActive();
  return result;
};

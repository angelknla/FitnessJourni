import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom cannot follow a real <a href>, so clicking a nav link logs
// "Not implemented: navigation". Drop only that message — everything
// else still reaches the console.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes('Not implemented: navigation')) {
    return;
  }
  originalError(...args);
};

/*
 * Node 26 ships its own experimental localStorage that requires
 * --localstorage-file, and it shadows jsdom's implementation — so
 * window.localStorage is undefined here. Components guard against that with
 * try/catch (a real browser has it), but the tests need a working one to
 * exercise the persistence paths at all.
 */
if (!window.localStorage) {
  const store = new Map<string, string>();

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

// jsdom has no matchMedia; components that read it need a stub.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

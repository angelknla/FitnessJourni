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

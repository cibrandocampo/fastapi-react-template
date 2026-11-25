import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { setAccessToken } from '../api/client';
import i18n from '../i18n';
import { server } from './server';

// jsdom lacks APIs Mantine uses.
window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('en');
});
afterAll(() => server.close());

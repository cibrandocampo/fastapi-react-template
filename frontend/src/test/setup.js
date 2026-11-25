import '@testing-library/jest-dom/vitest';

import { notifications } from '@mantine/notifications';
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
  // Notifications live in a module-level store that outlives each render.
  notifications.clean();
  server.resetHandlers();
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('en');
});
afterAll(() => server.close());

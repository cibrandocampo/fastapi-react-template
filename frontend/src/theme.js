import { createTheme, localStorageColorSchemeManager } from '@mantine/core';

// The single place a project changes its look: colours, radius, fonts.
export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
});

// light | dark | auto (follows the OS); remembered in this browser, synced with the user's
// saved preference after login.
export const colorSchemeManager = localStorageColorSchemeManager({ key: 'app-color-scheme' });

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createQueryClient } from './api/queryClient';
import i18n from './i18n';
import { colorSchemeManager, theme } from './theme';

export function Providers({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  return (
    <I18nextProvider i18n={i18n}>
      <MantineProvider
        theme={theme}
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="auto"
      >
        <Notifications position="top-right" />
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MantineProvider>
    </I18nextProvider>
  );
}

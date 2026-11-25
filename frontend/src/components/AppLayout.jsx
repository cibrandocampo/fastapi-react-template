import { Anchor, AppShell, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

import { ColorSchemeMenu } from './ColorSchemeMenu';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Anchor component={Link} to="/" underline="never" c="inherit" fw={700} fz="xl">
            {t('app.name')}
          </Anchor>
          <ColorSchemeMenu />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

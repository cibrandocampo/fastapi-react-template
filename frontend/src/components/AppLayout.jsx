import { Anchor, AppShell, Container, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';

import classes from './AppLayout.module.css';
import { BrandMark } from './BrandMark';
import { ColorSchemeMenu } from './ColorSchemeMenu';
import { LanguageMenu } from './LanguageMenu';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <AppShell header={{ height: 56 }} padding={0}>
      <AppShell.Header className={classes.header}>
        <Container size={1080} h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Anchor component={Link} to="/" underline="never" aria-label={t('app.name')}>
              <BrandMark />
            </Anchor>
            <Group gap="xs" wrap="nowrap">
              <LanguageMenu />
              <ColorSchemeMenu />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size={1080} pt="xl" className={classes.content}>
          <Outlet />
        </Container>
      </AppShell.Main>
      <BottomNav />
    </AppShell>
  );
}

import { Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { useAuth } from '../auth/useAuth';

// Signed-up account without permissions yet: an administrator has to grant access.
export function WaitingPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  if (user.role !== 'none') return <Navigate to="/" replace />;

  return (
    <Center mih="70vh" p="md">
      <Paper withBorder p="xl" radius="md" maw={480}>
        <Stack>
          <Title order={1} size="h2">
            {t('waiting.title')}
          </Title>
          <Text>{t('waiting.text', { email: user.email })}</Text>
          <Text c="dimmed">{t('waiting.hint')}</Text>
          <Button variant="default" onClick={logout}>
            {t('user.logout')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

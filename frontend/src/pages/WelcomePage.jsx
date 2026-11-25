import { Alert, Button, Center, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { useAuth } from '../auth/useAuth';

// First login: the account has no name yet.
export function WelcomePage() {
  const { t } = useTranslation();
  const { updateProfile, isNew, logout } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const form = useForm({
    initialValues: { first_name: '', last_name: '' },
    validate: {
      first_name: (value) => (value.trim() ? null : t('welcome.required')),
      last_name: (value) => (value.trim() ? null : t('welcome.required')),
    },
  });

  if (!isNew) return <Navigate to="/" replace />;

  const save = form.onSubmit(async (values) => {
    setFailed(false);
    try {
      await updateProfile({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
      });
      navigate('/', { replace: true });
    } catch {
      setFailed(true);
    }
  });

  return (
    <Center mih="100vh" p="md">
      <Paper
        withBorder
        p="xl"
        radius="md"
        w="100%"
        maw={420}
        component="form"
        onSubmit={save}
        noValidate
      >
        <Stack>
          <Title order={1} size="h2">
            {t('welcome.title')}
          </Title>
          <Text c="dimmed">{t('welcome.text')}</Text>
          <TextInput
            label={t('welcome.firstName')}
            autoComplete="given-name"
            required
            {...form.getInputProps('first_name')}
          />
          <TextInput
            label={t('welcome.lastName')}
            autoComplete="family-name"
            required
            {...form.getInputProps('last_name')}
          />
          {failed && (
            <Alert color="red" role="alert">
              {t('errors.generic')}
            </Alert>
          )}
          <Button type="submit" loading={form.submitting}>
            {t('welcome.save')}
          </Button>
          <Button variant="subtle" onClick={logout}>
            {t('user.logout')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

import {
  Alert,
  Badge,
  Button,
  Group,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyError } from '../api/queryClient';
import { useAuth } from '../auth/useAuth';
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n';
import classes from './ProfilePage.module.css';

const PASSWORD_ERRORS = ['invalid_credentials', 'weak_password', 'rate_limited'];

function Section({ title, children }) {
  return (
    <section className={classes.section}>
      <Title order={2} size="h3">
        {title}
      </Title>
      {children}
    </section>
  );
}

function NameForm() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const form = useForm({
    initialValues: { first_name: user.first_name, last_name: user.last_name },
    validate: {
      first_name: (value) => (value.trim() ? null : t('welcome.required')),
      last_name: (value) => (value.trim() ? null : t('welcome.required')),
    },
  });

  const save = form.onSubmit(async (values) => {
    try {
      await updateProfile({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
      });
      notifications.show({ color: 'teal', message: t('profile.saved') });
    } catch (error) {
      notifyError(error);
    }
  });

  return (
    <form onSubmit={save} noValidate>
      <Stack>
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
        <Button type="submit" w="fit-content" loading={form.submitting}>
          {t('profile.saveName')}
        </Button>
      </Stack>
    </form>
  );
}

function Preferences() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  // Saved at once; the session applies the user's language and colour scheme when they change.
  const save = (changes) => updateProfile(changes).catch(notifyError);

  return (
    <Stack>
      <Select
        label={t('language.label')}
        data={LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
        value={user.language}
        onChange={(language) => language && save({ language })}
        allowDeselect={false}
        w={240}
      />
      <Stack gap={4}>
        <Text id="profile-theme" fw={500} size="sm">
          {t('colorScheme.label')}
        </Text>
        <SegmentedControl
          aria-labelledby="profile-theme"
          value={user.theme}
          onChange={(theme) => save({ theme })}
          data={[
            { value: 'light', label: t('colorScheme.light') },
            { value: 'dark', label: t('colorScheme.dark') },
            { value: 'system', label: t('colorScheme.auto') },
          ]}
          w="fit-content"
        />
      </Stack>
    </Stack>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const { user, changePassword } = useAuth();
  const hasPassword = user.auth_method === 'password';
  const [error, setError] = useState(null);
  const form = useForm({
    initialValues: { current_password: '', new_password: '', confirm: '' },
    validate: {
      current_password: (value) => (hasPassword && !value ? t('welcome.required') : null),
      new_password: (value) => (value ? null : t('welcome.required')),
      confirm: (value, values) =>
        value === values.new_password ? null : t('profile.password.mismatch'),
    },
  });

  const save = form.onSubmit(async (values) => {
    setError(null);
    try {
      await changePassword({
        ...(hasPassword ? { current_password: values.current_password } : {}),
        new_password: values.new_password,
      });
      form.reset();
      notifications.show({ color: 'teal', message: t('profile.password.saved') });
    } catch (err) {
      setError(PASSWORD_ERRORS.includes(err.code) ? err.code : 'generic');
    }
  });

  return (
    <form onSubmit={save} noValidate>
      <Stack>
        <Text c="dimmed" size="sm">
          {hasPassword ? t('profile.password.helpChange') : t('profile.password.helpSet')}
        </Text>
        {hasPassword && (
          <PasswordInput
            label={t('profile.password.current')}
            autoComplete="current-password"
            required
            {...form.getInputProps('current_password')}
          />
        )}
        <PasswordInput
          label={t('profile.password.new')}
          description={t('profile.password.rules')}
          autoComplete="new-password"
          required
          {...form.getInputProps('new_password')}
        />
        <PasswordInput
          label={t('profile.password.confirm')}
          autoComplete="new-password"
          required
          {...form.getInputProps('confirm')}
        />
        {error && (
          <Alert color="red" role="alert">
            {t(`profile.password.errors.${error}`)}
          </Alert>
        )}
        <Button type="submit" w="fit-content" loading={form.submitting}>
          {hasPassword ? t('profile.password.change') : t('profile.password.set')}
        </Button>
      </Stack>
    </form>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <Stack gap="xl" maw={560}>
      <Stack gap={4}>
        <Title order={1}>{t('profile.title')}</Title>
        <Group gap="xs">
          <Text c="dimmed">{user.email}</Text>
          <Badge variant="light">{t(`roles.${user.role}`)}</Badge>
        </Group>
      </Stack>
      <Section title={t('profile.name')}>
        <NameForm />
      </Section>
      <Section title={t('profile.preferences')}>
        <Preferences />
      </Section>
      <Section title={t('profile.password.title')}>
        <PasswordForm />
      </Section>
      <Section title={t('profile.session')}>
        <Button
          variant="default"
          leftSection={<LogOut size={16} aria-hidden />}
          onClick={logout}
          w="fit-content"
        >
          {t('user.logout')}
        </Button>
      </Section>
    </Stack>
  );
}

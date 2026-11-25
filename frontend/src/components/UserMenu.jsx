import { Avatar, Menu, Text, UnstyledButton } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/useAuth';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  // Users without a name never reach the shell (they complete it on the welcome step first).
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <UnstyledButton aria-label={t('user.menu')}>
          <Avatar radius="xl" color="indigo">
            {initials}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500}>
            {name}
          </Text>
          <Text size="xs" c="dimmed">
            {user.email}
          </Text>
        </Menu.Label>
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>
          {t('user.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

import { ActionIcon, Menu, useMantineColorScheme } from '@mantine/core';
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { notifyError } from '../api/queryClient';
import { useAuth } from '../auth/useAuth';

const ICONS = { light: IconSun, dark: IconMoon, auto: IconDeviceDesktop };

export function ColorSchemeMenu() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { user, updateProfile } = useAuth();
  const Current = ICONS[colorScheme];

  const choose = (scheme) => {
    setColorScheme(scheme);
    if (user) updateProfile({ theme: scheme === 'auto' ? 'system' : scheme }).catch(notifyError);
  };

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="default" size="lg" aria-label={t('colorScheme.label')}>
          <Current size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {Object.entries(ICONS).map(([scheme, Icon]) => (
          <Menu.Item
            key={scheme}
            leftSection={<Icon size={16} />}
            onClick={() => choose(scheme)}
            // Mantine fixes role="menuitem"; aria-current marks the active choice for assistive
            // technology and the check mark shows it visually.
            aria-current={scheme === colorScheme ? 'true' : undefined}
            rightSection={scheme === colorScheme ? <IconCheck size={16} /> : null}
          >
            {t(`colorScheme.${scheme}`)}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

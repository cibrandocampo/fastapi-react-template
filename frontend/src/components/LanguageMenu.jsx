import { ActionIcon, Menu } from '@mantine/core';
import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { notifyError } from '../api/queryClient';
import { useAuth } from '../auth/useAuth';
import { LANGUAGES } from '../i18n';

// Language names in their own language, so anyone can find theirs.
const NAMES = { en: 'English', es: 'Español', gl: 'Galego' };

export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const { user, updateProfile } = useAuth();
  const current = i18n.resolvedLanguage;

  const choose = (language) => {
    i18n.changeLanguage(language);
    if (user) updateProfile({ language }).catch(notifyError);
  };

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="default" size="lg" aria-label={t('language.label')}>
          <IconLanguage size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {LANGUAGES.map((language) => (
          <Menu.Item
            key={language}
            lang={language}
            onClick={() => choose(language)}
            aria-current={language === current ? 'true' : undefined}
            rightSection={language === current ? <IconCheck size={16} /> : null}
          >
            {NAMES[language]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

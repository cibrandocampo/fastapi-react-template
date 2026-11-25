import { House, UserRound, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, matchPath, useLocation } from 'react-router';

import { useAuth } from '../auth/useAuth';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen';
import classes from './BottomNav.module.css';

// Tabs: `match` are the routes that keep a tab current (its own sub-pages included).
const TABS = [
  { to: '/', icon: House, label: 'nav.home', match: ['/'], min: 'user' },
  { to: '/profile', icon: UserRound, label: 'nav.profile', match: ['/profile'], min: 'none' },
  { to: '/admin/users', icon: Users, label: 'nav.users', match: ['/admin/users/*'], min: 'admin' },
];
const LEVEL = { none: 0, user: 1, admin: 2 };

// Bottom navigation, always visible (nudge's bar) in the "expanding label" style: the current tab is a
// pill with its icon and label, the others show their icon only. Labels stay in the DOM, so every tab
// keeps its accessible name.
export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const keyboardOpen = useKeyboardOpen();

  const tabs = TABS.filter((tab) => LEVEL[user.role] >= LEVEL[tab.min]);
  // A single tab is not navigation (accounts waiting for access only have their profile).
  if (tabs.length < 2 || keyboardOpen) return null;

  return (
    <nav className={classes.nav} aria-label={t('nav.label')} data-bottom-nav>
      <ul className={classes.list}>
        {tabs.map(({ to, icon: Icon, label, match }) => {
          const current = match.some((path) => matchPath(path, pathname));
          return (
            <li key={to}>
              <Link
                to={to}
                className={classes.tab}
                data-current={current || undefined}
                aria-current={current ? 'page' : undefined}
              >
                <Icon size={22} aria-hidden />
                <span className={classes.label}>{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

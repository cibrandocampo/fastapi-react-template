import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '../App';
import { renderWithProviders } from '../test/render';
import { makeUser, server, withSession } from '../test/server';

const nav = () => screen.findByRole('navigation', { name: 'Main' });

describe('BottomNav', () => {
  it('shows Home and Profile to a user, with Home current', async () => {
    server.use(withSession());
    renderWithProviders(<AppRoutes />);

    await nav();
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('adds Users for an administrator and marks the current tab after navigating', async () => {
    server.use(withSession(makeUser({ role: 'admin' })));
    const { router } = renderWithProviders(<AppRoutes />);

    await nav();
    await userEvent.click(screen.getByRole('link', { name: 'Profile' }));

    expect(router.location.pathname).toBe('/profile');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('is not shown to an account waiting for access (one tab is not navigation)', async () => {
    server.use(withSession(makeUser({ role: 'none' })));
    renderWithProviders(<AppRoutes />);

    await screen.findByRole('heading', { name: 'Waiting for access' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('hides while the on-screen keyboard is open', async () => {
    const listeners = {};
    const viewport = {
      height: window.innerHeight,
      addEventListener: (type, fn) => (listeners[type] = fn),
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    server.use(withSession());
    renderWithProviders(<AppRoutes />);
    await nav();

    viewport.height = window.innerHeight - 300;
    act(() => listeners.resize());

    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    viewport.height = window.innerHeight;
    act(() => listeners.resize());
    expect(await nav()).toBeInTheDocument();
    delete window.visualViewport;
  });

  it('stays visible while the page is pinch-zoomed', async () => {
    const viewport = {
      height: window.innerHeight / 2,
      scale: 2,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    server.use(withSession());
    renderWithProviders(<AppRoutes />);

    expect(await nav()).toBeInTheDocument();
    delete window.visualViewport;
  });

  it('leaves the content bottom reserve to its class (no inline padding overrides it)', async () => {
    server.use(withSession());
    renderWithProviders(<AppRoutes />);

    const content = (await screen.findByRole('heading', { name: 'Welcome' })).closest('main > *');
    expect(content.className).toMatch(/content/);
    expect(content.style.paddingBottom).toBe('');
    expect(content.style.paddingBlock).toBe('');
  });
});

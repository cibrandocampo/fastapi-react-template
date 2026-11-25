import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App, { AppRoutes } from './App';
import { render } from '@testing-library/react';

import { renderWithProviders } from './test/render';

describe('App', () => {
  it('shows the home page inside the shell', () => {
    renderWithProviders(<AppRoutes />);

    expect(screen.getByRole('link', { name: 'App' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('shows a not-found page with a way home', async () => {
    renderWithProviders(<AppRoutes />, { route: '/nowhere' });

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Go to the home page' }));
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('switches and remembers the colour scheme', async () => {
    renderWithProviders(<AppRoutes />);

    await userEvent.click(screen.getByRole('button', { name: 'Colour scheme' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    expect(localStorage.getItem('app-color-scheme')).toBe('dark');
  });

  it('marks the active colour scheme in the menu', async () => {
    localStorage.setItem('app-color-scheme', 'dark');
    renderWithProviders(<AppRoutes />);

    await userEvent.click(screen.getByRole('button', { name: 'Colour scheme' }));

    const items = await screen.findAllByRole('menuitem');
    const current = items.filter((item) => item.getAttribute('aria-current') === 'true');
    expect(items).toHaveLength(3);
    expect(current.map((item) => item.textContent)).toEqual(['Dark']);
  });

  it('applies the colour scheme saved in this browser on load', () => {
    localStorage.setItem('app-color-scheme', 'dark');

    renderWithProviders(<AppRoutes />);

    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
  });

  it('renders the whole app with its own providers and router', () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });
});

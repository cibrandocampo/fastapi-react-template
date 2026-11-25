import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { api } from '../api/client';
import { AppRoutes } from '../App';
import i18n from '../i18n';
import { renderWithProviders } from '../test/render';
import { apiError, makeUser, server, unauthorized, withSession } from '../test/server';
import { AuthProvider } from './AuthContext';
import { RequireRole, RequireSession } from './routes';

describe('session', () => {
  it('shows a loader while the session is restored', () => {
    server.use(http.post('/api/auth/refresh', () => new Promise(() => {})));
    renderWithProviders(<AppRoutes />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it("applies the user's saved language and colour scheme", async () => {
    server.use(withSession(makeUser({ language: 'gl', theme: 'dark' })));
    renderWithProviders(<AppRoutes />);

    expect(await screen.findByRole('heading', { name: 'Benvida' })).toBeInTheDocument();
    expect(i18n.resolvedLanguage).toBe('gl');
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
  });

  it('sends an account without permissions to the waiting page', async () => {
    server.use(withSession(makeUser({ role: 'none' })));
    renderWithProviders(<AppRoutes />);

    expect(await screen.findByRole('heading', { name: 'Waiting for access' })).toBeInTheDocument();
    expect(screen.getByText(/ana@example.com is ready/)).toBeInTheDocument();
  });

  it('sends an account with permissions away from the waiting page', async () => {
    server.use(withSession());
    renderWithProviders(<AppRoutes />, { route: '/waiting' });

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('sends a user without a name to the welcome step', async () => {
    server.use(withSession(makeUser({ first_name: '', last_name: '' })));
    renderWithProviders(<AppRoutes />);

    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument();
  });

  it('answers not found when the role is not enough', async () => {
    server.use(withSession());
    renderWithProviders(
      <AuthProvider>
        <Routes>
          <Route element={<RequireSession />}>
            <Route element={<RequireRole min="admin" />}>
              <Route path="/" element={<p>admin area</p>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('goes back to the login page when the server ends the session', async () => {
    server.use(withSession(), http.get('/api/things', unauthorized));
    renderWithProviders(<AppRoutes />);
    await screen.findByRole('heading', { name: 'Welcome' });
    server.use(http.post('/api/auth/refresh', unauthorized));

    await act(() => api('/things').catch(() => {}));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('logs out from the user menu', async () => {
    let loggedOut = false;
    server.use(
      withSession(),
      http.post('/api/auth/logout', () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(loggedOut).toBe(true);
  });

  it('logs out locally even when the server cannot be reached', async () => {
    server.use(
      withSession(makeUser({ role: 'none' })),
      http.post('/api/auth/logout', () => HttpResponse.error()),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows initials from one name', async () => {
    server.use(withSession(makeUser({ first_name: 'Ana', last_name: '' })));
    renderWithProviders(<AppRoutes />);

    expect(await screen.findByText('A')).toBeInTheDocument();
  });
});

describe('preferences menus', () => {
  it('tells the user when a colour scheme could not be saved', async () => {
    server.use(
      withSession(),
      http.patch('/api/auth/me', () => apiError(500, 'boom')),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Colour scheme' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    expect(await screen.findByText('Unexpected error. Please try again.')).toBeInTheDocument();
  });

  it('tells the user when a preference could not be saved', async () => {
    server.use(
      withSession(),
      http.patch('/api/auth/me', () => apiError(500, 'boom')),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Language' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Español' }));

    expect(await screen.findByText('Error inesperado. Inténtalo de nuevo.')).toBeInTheDocument();
  });

  it('changes the colour scheme for a visitor without saving it anywhere', async () => {
    renderWithProviders(<AppRoutes />, { route: '/login' });

    await userEvent.click(await screen.findByRole('button', { name: 'Colour scheme' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    // An unexpected PATCH /api/auth/me would fail the test (MSW rejects unhandled requests).
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
  });

  it('saves the system colour scheme as "system"', async () => {
    let saved;
    server.use(
      withSession(makeUser({ theme: 'dark' })),
      http.patch('/api/auth/me', async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json(makeUser({ theme: saved.theme }));
      }),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Colour scheme' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'System' }));

    await waitFor(() => expect(saved).toEqual({ theme: 'system' }));
  });

  it('changes the language for a visitor without saving it anywhere', async () => {
    renderWithProviders(<AppRoutes />, { route: '/login' });

    await userEvent.click(await screen.findByRole('button', { name: 'Language' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Español' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it("saves the language in a logged-in user's profile", async () => {
    let saved;
    server.use(
      withSession(),
      http.patch('/api/auth/me', async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json(makeUser({ language: saved.language }));
      }),
    );
    renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Language' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Galego' }));

    await waitFor(() => expect(saved).toEqual({ language: 'gl' }));
    expect(await screen.findByRole('heading', { name: 'Benvida' })).toBeInTheDocument();
  });
});

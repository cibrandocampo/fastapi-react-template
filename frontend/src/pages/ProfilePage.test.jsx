import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '../App';
import i18n from '../i18n';
import { renderWithProviders } from '../test/render';
import { apiError, makeUser, server, withSession } from '../test/server';

function patchMe(onBody) {
  return http.patch('/api/auth/me', async ({ request }) => {
    const body = await request.json();
    onBody?.(body);
    return HttpResponse.json(makeUser(body));
  });
}

describe('ProfilePage', () => {
  it('shows the account and saves a new name', async () => {
    let saved;
    server.use(
      withSession(),
      patchMe((body) => (saved = body)),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    const first = screen.getByLabelText(/First name/);
    await userEvent.clear(first);
    await userEvent.type(first, ' Uxía ');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(saved).toEqual({ first_name: 'Uxía', last_name: 'Pérez' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('requires both names', async () => {
    server.use(withSession());
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.clear(await screen.findByLabelText(/Last name/));
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Required')).toBeInTheDocument();
  });

  it('notifies when the name cannot be saved', async () => {
    server.use(
      withSession(),
      http.patch('/api/auth/me', () => apiError(500, 'boom')),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.click(await screen.findByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Unexpected error. Please try again.')).toBeInTheDocument();
  });

  it('saves the language and the colour scheme at once', async () => {
    const saved = [];
    server.use(
      withSession(),
      patchMe((body) => saved.push(body)),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.click(await screen.findByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(saved).toContainEqual({ theme: 'dark' }));
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');

    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Galego' }));
    await waitFor(() => expect(saved).toContainEqual({ language: 'gl' }));
    await waitFor(() => expect(i18n.resolvedLanguage).toBe('gl'));
  });

  it('changes the password of a password account and keeps the session', async () => {
    let body;
    server.use(
      withSession(makeUser({ auth_method: 'password' })),
      http.post('/api/auth/change-password', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          access_token: 'new',
          user: makeUser({ auth_method: 'password' }),
        });
      }),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.type(await screen.findByLabelText(/Current password/), 'old password!');
    await userEvent.type(screen.getByLabelText(/^New password/), 'a new long password');
    await userEvent.type(screen.getByLabelText(/Repeat the new password/), 'a new long password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(body).toEqual({
        current_password: 'old password!',
        new_password: 'a new long password',
      }),
    );
    expect(await screen.findByText(/Password saved/)).toBeInTheDocument();
  });

  it('lets a code account set a first password without the current one', async () => {
    let body;
    server.use(
      withSession(),
      http.post('/api/auth/change-password', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          access_token: 'new',
          user: makeUser({ auth_method: 'password' }),
        });
      }),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    expect(await screen.findByText(/You sign in with a code/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^New password/), 'a new long password');
    await userEvent.type(screen.getByLabelText(/Repeat the new password/), 'a new long password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));

    await waitFor(() => expect(body).toEqual({ new_password: 'a new long password' }));
  });

  it('requires the first name and every password field', async () => {
    server.use(withSession(makeUser({ auth_method: 'password' })));
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.clear(await screen.findByLabelText(/First name/));
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findAllByText('Required')).toHaveLength(3);
  });

  it('checks the repeated password', async () => {
    server.use(withSession());
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.type(await screen.findByLabelText(/^New password/), 'a new long password');
    await userEvent.type(screen.getByLabelText(/Repeat the new password/), 'another one!!');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
  });

  it.each([
    ['invalid_credentials', 400, 'The current password is not correct.'],
    ['weak_password', 400, 'This password is too weak.'],
    ['boom', 500, 'The password could not be saved.'],
  ])('explains a %s answer', async (code, status, message) => {
    server.use(
      withSession(makeUser({ auth_method: 'password' })),
      http.post('/api/auth/change-password', () => apiError(status, code)),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.type(await screen.findByLabelText(/Current password/), 'old password!');
    await userEvent.type(screen.getByLabelText(/^New password/), 'a new long password');
    await userEvent.type(screen.getByLabelText(/Repeat the new password/), 'a new long password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
  });

  it('logs out', async () => {
    server.use(
      withSession(),
      http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('is reachable from the waiting page by an account without permissions', async () => {
    server.use(withSession(makeUser({ role: 'none' })));
    const { router } = renderWithProviders(<AppRoutes />);

    await userEvent.click(await screen.findByRole('link', { name: 'Edit your profile' }));

    expect(router.location.pathname).toBe('/profile');
    expect(await screen.findByText('Waiting for access')).toBeInTheDocument(); // role badge
  });
});

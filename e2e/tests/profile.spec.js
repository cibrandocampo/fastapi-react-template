import { expect, test } from '@playwright/test';

import {
  createUser,
  loginAsAdmin,
  loginWithCode,
  loginWithPassword,
  logout,
  uniqueEmail,
} from './helpers';

// A code (OTP) account with access, signed in on `page`.
async function signedInUser(page, browser) {
  const email = uniqueEmail('profile');
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await createUser(adminPage, { email });
  await admin.close();

  await loginWithCode(page, email);
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  return email;
}

// Signs in again from a fresh browser: proves a preference was saved on the account, not in
// this browser's storage.
async function freshBrowserSignIn(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginWithCode(page, email);
  return { context, page };
}

test('the language is saved on the account', async ({ page, browser }) => {
  const email = await signedInUser(page, browser);
  await page.goto('/profile');

  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
  const other = await freshBrowserSignIn(browser, email);
  await expect(other.page.getByRole('heading', { name: 'Bienvenida', exact: true })).toBeVisible();
  await other.context.close();
});

test('the colour scheme is saved on the account', async ({ page, browser }) => {
  const email = await signedInUser(page, browser);
  await page.goto('/profile');

  // The radio itself is visually hidden; people click its label.
  await page.locator('label', { hasText: /^Dark$/ }).click();
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  const other = await freshBrowserSignIn(browser, email);
  await expect(other.page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  await other.context.close();
});

test('a code account sets a password and then signs in with it', async ({ page, browser }) => {
  const email = await signedInUser(page, browser);
  const password = 'e2e-new-password-1';
  await page.goto('/profile');

  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(password);
  await page.getByRole('textbox', { name: 'Repeat the new password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByText(/Password saved/)).toBeVisible();
  await logout(page);

  await loginWithPassword(page, email, password);
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
});

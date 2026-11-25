import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/useAuth';
import { DeleteDialog, ErrorAlert, SetPasswordDialog, UserFormDialog } from './UserDialogs';
import {
  PAGE_SIZE,
  useCreateUser,
  useDeleteUser,
  useSetPassword,
  useUpdateUser,
  useUsers,
} from './usersApi';

const fullName = (user) => [user.first_name, user.last_name].filter(Boolean).join(' ');

export function UsersPage() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [role, setRole] = useState(null);
  const [active, setActive] = useState(null);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { kind: 'create'|'edit'|'password'|'delete', user }

  const users = useUsers({ q, role, active, page });
  const create = useCreateUser();
  const update = useUpdateUser();
  const setPassword = useSetPassword();
  const remove = useDeleteUser();
  const grant = useUpdateUser();

  // Dialogs mount on open, so Mantine cannot return focus itself: put it back on the button that opened
  // the dialog, or on "New user" when that row is gone (WCAG 2.4.3).
  const trigger = useRef(null);
  const createButton = useRef(null);
  const open = (kind, user) => {
    for (const mutation of [create, update, setPassword, remove]) mutation.reset();
    trigger.current = document.activeElement;
    setDialog({ kind, user });
  };
  const close = () => {
    const target = trigger.current;
    setDialog(null);
    setTimeout(() => (target?.isConnected ? target : createButton.current)?.focus());
  };
  const done = (message) => () => {
    notifications.show({ color: 'teal', message });
    close();
  };

  const filters = (change) => (value) => {
    change(value);
    setPage(1);
  };

  const data = users.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Title order={1}>{t('users.title')}</Title>
        <Button
          ref={createButton}
          leftSection={<Plus size={16} aria-hidden />}
          onClick={() => open('create')}
        >
          {t('users.create.open')}
        </Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label={t('users.search')}
          leftSection={<Search size={16} aria-hidden />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          w={260}
        />
        <Select
          label={t('users.role')}
          placeholder={t('users.all')}
          data={['none', 'user', 'admin'].map((value) => ({ value, label: t(`roles.${value}`) }))}
          value={role}
          onChange={filters(setRole)}
          clearable
          w={180}
        />
        <Select
          label={t('users.status')}
          placeholder={t('users.all')}
          data={[
            { value: 'true', label: t('users.activeState') },
            { value: 'false', label: t('users.inactiveState') },
          ]}
          value={active}
          onChange={filters(setActive)}
          clearable
          w={180}
        />
      </Group>

      <ErrorAlert error={grant.error} />

      {data && data.items.length === 0 ? (
        <Text c="dimmed">{t('users.empty')}</Text>
      ) : (
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('users.name')}</Table.Th>
                <Table.Th>{t('login.email')}</Table.Th>
                <Table.Th>{t('users.role')}</Table.Th>
                <Table.Th>{t('users.status')}</Table.Th>
                <Table.Th>
                  <VisuallyHidden>{t('users.actions')}</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.items.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{fullName(user) || <Text c="dimmed">—</Text>}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    {user.role === 'none' ? (
                      <Group gap="xs" wrap="nowrap">
                        <Badge variant="light" color="red">
                          {t('roles.none')}
                        </Badge>
                        <Button
                          size="compact-sm"
                          variant="light"
                          loading={grant.isPending && grant.variables?.id === user.id}
                          onClick={() =>
                            grant.mutate(
                              { id: user.id, role: 'user' },
                              { onSuccess: done(t('users.granted', { email: user.email })) },
                            )
                          }
                        >
                          {t('users.grant')}
                        </Button>
                      </Group>
                    ) : (
                      <Badge variant="light" color={user.role === 'admin' ? 'slate' : 'gray'}>
                        {t(`roles.${user.role}`)}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {user.is_active ? t('users.activeState') : t('users.inactiveState')}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label={t('users.edit.title')}>
                        <ActionIcon
                          size="lg"
                          variant="subtle"
                          aria-label={t('users.edit.label', { email: user.email })}
                          onClick={() => open('edit', user)}
                        >
                          <Pencil size={16} aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                      {/* Your own password and account are managed from the profile: setting it
                          here would close all your sessions. */}
                      {user.id !== me.id && (
                        <>
                          <Tooltip label={t('users.password.title')}>
                            <ActionIcon
                              size="lg"
                              variant="subtle"
                              aria-label={t('users.password.label', { email: user.email })}
                              onClick={() => open('password', user)}
                            >
                              <KeyRound size={16} aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('users.delete.title')}>
                            <ActionIcon
                              size="lg"
                              variant="subtle"
                              color="red"
                              aria-label={t('users.delete.label', { email: user.email })}
                              onClick={() => open('delete', user)}
                            >
                              <Trash2 size={16} aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {pages > 1 && (
        <Pagination
          total={pages}
          value={page}
          onChange={setPage}
          getControlProps={(control) => ({ 'aria-label': t(`users.pagination.${control}`) })}
          withEdges={false}
        />
      )}

      {dialog?.kind === 'create' && (
        <UserFormDialog
          opened
          mutation={{
            ...create,
            mutate: (body) => create.mutate(body, { onSuccess: done(t('users.create.done')) }),
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === 'edit' && (
        <UserFormDialog
          opened
          user={dialog.user}
          mutation={{
            ...update,
            mutate: (body, options) =>
              update.mutate(body, { ...options, onSuccess: done(t('users.edit.saved')) }),
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === 'password' && (
        <SetPasswordDialog
          opened
          user={dialog.user}
          mutation={{
            ...setPassword,
            mutate: (body) =>
              setPassword.mutate(body, { onSuccess: done(t('users.password.saved')) }),
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          opened
          user={dialog.user}
          mutation={{
            ...remove,
            mutate: (id) =>
              remove.mutate(id, {
                onSuccess: done(t('users.delete.done', { email: dialog.user.email })),
              }),
          }}
          onClose={close}
        />
      )}
    </Stack>
  );
}

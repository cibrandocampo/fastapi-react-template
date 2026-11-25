import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { createQueryClient } from '../api/queryClient';
import { Providers } from '../Providers';

export function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = createQueryClient();
  return {
    queryClient,
    ...render(
      <Providers queryClient={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Providers>,
    ),
  };
}

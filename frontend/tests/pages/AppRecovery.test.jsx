import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AppErrorBoundary from '../../src/components/common/AppErrorBoundary.jsx';

it('offers reload and home navigation if a page or route chunk fails', () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenPage() {
    throw new Error('Route chunk unavailable');
  }
  try {
    render(
      <AppErrorBoundary>
        <BrokenPage />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'We couldn’t open this page',
    );
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/',
    );
  } finally {
    errorLog.mockRestore();
  }
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/store/useWindowStore', () => ({
  useWindowStore: () => ({
    windows: [],
    activeWindowId: null,
    openWindow: vi.fn(),
    focusWindow: vi.fn(),
    toggleMinimize: vi.fn(),
  }),
}));

describe('DesktopShell', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('shows Settings in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { default: DesktopShell } = await import('@/components/shell/DesktopShell.jsx');

    render(<DesktopShell><div>Desktop content</div></DesktopShell>);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});

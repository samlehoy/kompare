import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const mockWindowStore = vi.hoisted(() => ({
  windows: [],
  openWindow: vi.fn((componentId) => {
    mockWindowStore.windows = [{ id: componentId, componentId }];
  }),
}));

vi.mock('@/store/useWindowStore', () => ({
  useWindowStore: (selector) => {
    const store = {
      windows: mockWindowStore.windows,
      activeWindowId: null,
      openWindow: mockWindowStore.openWindow,
      focusWindow: vi.fn(),
      closeWindow: vi.fn(),
      toggleMinimize: vi.fn(),
      toggleMaximize: vi.fn(),
    };
    return selector ? selector(store) : store;
  },
}));

describe('DesktopShell', () => {
  afterEach(() => {
    mockWindowStore.windows = [];
    mockWindowStore.openWindow.mockClear();
    vi.unstubAllGlobals();
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

  test('opens provider settings from the Settings desktop button', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.resetModules();
    const { default: DesktopShell } = await import('@/components/shell/DesktopShell.jsx');

    const view = render(<DesktopShell><div>Desktop content</div></DesktopShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    view.rerender(<DesktopShell><div>Desktop content</div></DesktopShell>);

    expect(mockWindowStore.openWindow).toHaveBeenCalledWith('settings');
    expect(screen.getByText('Gemini Cloud Settings')).toBeVisible();
  });
});

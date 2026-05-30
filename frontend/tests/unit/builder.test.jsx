import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import BuildWizard from '@/components/builder/BuildWizard.jsx';
import { api } from '@/lib/api.js';

vi.mock('@/lib/api.js', () => ({
  api: {
    listAllocationPresets: vi.fn(),
    recommendAiBuild: vi.fn(),
    recommendBuild: vi.fn(),
    swapComponent: vi.fn(),
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function buildWithAllOptionalAddons() {
  return {
    budget_idr: 20_000_000,
    total_idr: 12_000_000,
    remaining_idr: 8_000_000,
    components: {},
    optional_addons: {
      hdd: {
        sku: 'hdd-1',
        name: 'Selected 1TB HDD',
        price_idr: 1_000_000,
        specs: { capacity_gb: 1024 },
      },
      monitor: {
        sku: 'monitor-1',
        name: 'Unselected gaming monitor',
        price_idr: 2_000_000,
        specs: { resolution: 'FHD' },
      },
      ups: {
        sku: 'ups-1',
        name: 'Unselected UPS',
        price_idr: 1_500_000,
        specs: { capacity_va: 1200 },
      },
    },
  };
}

describe('build wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listAllocationPresets.mockRejectedValue(new Error('metadata unavailable'));
  });

  test('shows a catalog-aware progress message while AI build ranking is running', async () => {
    const request = deferred();
    api.recommendAiBuild.mockReturnValue(request.promise);

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
    await userEvent.click(screen.getByRole('radio', { name: /AI-assisted/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(screen.getByRole('status')).toHaveTextContent('AI BUILD IN PROGRESS');
    expect(screen.getByRole('status')).toHaveTextContent('ranking real catalog candidates');
    expect(screen.getByRole('status')).toHaveTextContent('can take about a minute');
  });

  test('uses one generate action and hides AI profile until AI-assisted mode is selected', async () => {
    render(<BuildWizard />);

    expect(screen.getByRole('button', { name: 'Generate build' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Generate$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate with AI' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('AI profile')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /AI-assisted/i }));

    expect(screen.getByLabelText('AI profile')).toBeVisible();
  });

  test('sends the selected AI profile when AI-assisted mode generates a build', async () => {
    const request = deferred();
    api.recommendAiBuild.mockReturnValue(request.promise);

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
    await userEvent.click(screen.getByRole('radio', { name: /AI-assisted/i }));
    await userEvent.selectOptions(screen.getByLabelText('AI profile'), 'gemini_free');
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendAiBuild).toHaveBeenCalledWith(expect.objectContaining({
      aiProfile: 'gemini_free',
    }));
  });

  test('fast compatibility mode uses deterministic recommendations', async () => {
    const request = deferred();
    api.recommendBuild.mockReturnValue(request.promise);

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).toHaveBeenCalledWith(expect.objectContaining({
      budgetIdr: 20000000,
    }));
    expect(api.recommendAiBuild).not.toHaveBeenCalled();
  });

  test('sends budget strategy and performance priority with build requests', async () => {
    const request = deferred();
    api.recommendBuild.mockReturnValue(request.promise);

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '30000000');
    await userEvent.selectOptions(screen.getByLabelText('Budget strategy'), 'maximize');
    await userEvent.selectOptions(screen.getByLabelText('Performance priority'), 'upgrade_friendly');
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).toHaveBeenCalledWith(expect.objectContaining({
      budgetStrategy: 'maximize',
      performancePriority: 'upgrade_friendly',
    }));
  });

  test('sends advanced allocation overrides only when the user opts in', async () => {
    api.recommendBuild.mockResolvedValue({
      budget_idr: 30_000_000,
      total_idr: 0,
      components: {},
    });

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '30000000');
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).toHaveBeenLastCalledWith(expect.not.objectContaining({
      allocationOverrides: expect.anything(),
    }));

    vi.clearAllMocks();
    api.recommendBuild.mockResolvedValue({
      budget_idr: 30_000_000,
      total_idr: 0,
      components: {},
    });

    await userEvent.click(screen.getByLabelText(/Use advanced allocation/i));
    expect(screen.getByRole('group', { name: 'Advanced allocation' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).toHaveBeenCalledWith(expect.objectContaining({
      allocationOverrides: {
        cpu: 20,
        gpu: 37,
        ram: 7,
        motherboard: 9,
        ssd: 8,
        psu: 8,
        case: 5,
        cpu_cooler: 5,
        fan_cooler: 1,
      },
    }));
  });

  test('automatically recalculates advanced allocation from strategy and priority presets', async () => {
    render(<BuildWizard />);

    await userEvent.click(screen.getByLabelText(/Use advanced allocation/i));

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(20);
    expect(screen.getByRole('spinbutton', { name: 'GPU allocation percent' })).toHaveValue(37);
    expect(screen.getByText('Suggested by: Gaming + Balanced spending + Best for gaming')).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText('Performance priority'), 'productivity');

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(23);
    expect(screen.getByRole('spinbutton', { name: 'GPU allocation percent' })).toHaveValue(26);
    expect(screen.getByText('Suggested by: Gaming + Balanced spending + Best for productivity')).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText('Budget strategy'), 'maximize');

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(25);
    expect(screen.getByRole('spinbutton', { name: 'GPU allocation percent' })).toHaveValue(29);
    expect(screen.getByText('Suggested by: Gaming + Maximize budget usage + Best for productivity')).toBeVisible();
  });

  test('hydrates advanced allocation presets from backend metadata when available', async () => {
    api.listAllocationPresets.mockResolvedValue({
      slots: ['cpu', 'gpu', 'ram', 'motherboard', 'ssd', 'psu', 'case', 'cpu_cooler', 'fan_cooler'],
      profiles: {
        gaming: { cpu: 10, gpu: 40, ram: 8, motherboard: 9, ssd: 10, psu: 8, case: 7, cpu_cooler: 5, fan_cooler: 3 },
      },
      priority_shifts: {
        gaming: { cpu: 1, gpu: 2 },
      },
      strategy_shifts: {
        balanced: {},
      },
    });

    render(<BuildWizard />);

    expect(await screen.findByText('Backend allocation presets loaded.')).toBeVisible();
    await userEvent.click(screen.getByLabelText(/Use advanced allocation/i));

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(11);
    expect(screen.getByRole('spinbutton', { name: 'GPU allocation percent' })).toHaveValue(39);
  });

  test('protects manual allocation edits until the user applies a new suggested split', async () => {
    render(<BuildWizard />);

    await userEvent.click(screen.getByLabelText(/Use advanced allocation/i));
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'CPU allocation percent' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'CPU allocation percent' }), '21');
    await userEvent.selectOptions(screen.getByLabelText('Performance priority'), 'productivity');

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(21);
    expect(screen.getByText('Custom allocation')).toBeVisible();
    expect(screen.getByText('Suggested allocation changed. Apply suggested split?')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Apply suggested allocation' }));

    expect(screen.getByRole('spinbutton', { name: 'CPU allocation percent' })).toHaveValue(23);
    expect(screen.getByRole('spinbutton', { name: 'GPU allocation percent' })).toHaveValue(26);
    expect(screen.queryByText('Suggested allocation changed. Apply suggested split?')).not.toBeInTheDocument();
  });

  test('blocks advanced allocation submission until percentages total 100', async () => {
    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '30000000');
    await userEvent.click(screen.getByLabelText(/Use advanced allocation/i));
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'CPU allocation percent' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'CPU allocation percent' }), '21');
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).not.toHaveBeenCalled();
    expect(api.recommendAiBuild).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Advanced allocation must total 100%. Current total is 101%.');
  });

  test('makes optional add-ons individually selectable instead of ambiguous', async () => {
    const request = deferred();
    api.recommendBuild.mockReturnValue(request.promise);

    render(<BuildWizard />);

    expect(screen.getByRole('group', { name: 'Optional add-ons' })).toBeVisible();
    expect(screen.getByLabelText(/Hard Drive \/ HDD/i)).toBeVisible();
    expect(screen.getByLabelText(/Monitor/i)).toBeVisible();
    expect(screen.getByLabelText(/UPS/i)).toBeVisible();
    expect(screen.queryByLabelText(/Add optional HDD, monitor, and UPS/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Include optional add-ons')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
    await userEvent.click(screen.getByLabelText(/Hard Drive \/ HDD/i));
    await userEvent.click(screen.getByLabelText(/UPS/i));
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(api.recommendBuild).toHaveBeenCalledWith(expect.objectContaining({
      includeOptionalAddons: true,
      selectedOptionalAddons: ['hdd', 'ups'],
    }));
  });

  test('shows only the optional add-ons selected for the current request', async () => {
    api.recommendBuild.mockResolvedValue(buildWithAllOptionalAddons());

    render(<BuildWizard />);

    await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
    await userEvent.click(screen.getByLabelText(/Hard Drive \/ HDD/i));
    await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

    expect(await screen.findByText('Selected 1TB HDD')).toBeVisible();
    expect(screen.queryByText('Unselected gaming monitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Unselected UPS')).not.toBeInTheDocument();
  });
});

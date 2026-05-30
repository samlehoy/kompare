import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import BuildResults from '@/components/results/BuildResults.jsx';

function component(slot, overrides = {}) {
  return {
    sku: `${slot}-sku`,
    category: slot,
    name: `${slot} component`,
    price_idr: 1_000_000,
    product_url: `https://enterkomputer.com/${slot}`,
    specs: {},
    ...overrides,
  };
}

function build(overrides = {}) {
  return {
    budget_idr: 20_000_000,
    total_idr: 9_000_000,
    remaining_idr: 11_000_000,
    components: {
      cpu: component('cpu'),
      motherboard: component('motherboard'),
      ram: component('ram'),
      gpu: component('gpu'),
      ssd: component('ssd'),
      psu: component('psu'),
      cpu_cooler: component('cpu_cooler'),
      fan_cooler: component('fan_cooler'),
      case: component('case'),
    },
    optional_addons: {
      hdd: null,
      monitor: null,
      ups: null,
    },
    ...overrides,
  };
}

describe('build results', () => {
  test('does not render hard drive as a core tower slot', () => {
    render(<BuildResults build={build()} />);

    expect(screen.queryByText('Hard Drive / HDD')).not.toBeInTheDocument();
  });

  test('renders hard drive under optional add-ons when requested', () => {
    render(
      <BuildResults
        build={build({
          optional_addons: {
            hdd: component('hdd', {
              name: '2TB SATA HDD',
              specs: { capacity_gb: 2048, interface: 'SATA' },
            }),
            monitor: null,
            ups: null,
          },
        })}
      />,
    );

    const optionalSection = screen.getByRole('region', { name: 'Optional add-ons' });
    expect(within(optionalSection).getByText('Hard Drive / HDD')).toBeVisible();
    expect(within(optionalSection).getByText('2TB SATA HDD')).toBeVisible();
  });

  test('renders budget strategy warnings, upgrade suggestions, and balance notes', () => {
    render(
      <BuildResults
        build={build({
          budget_usage: {
            strategy: 'maximize',
            used_percent: 73.4,
            target_min_percent: 95,
            target_max_percent: 100,
            status: 'catalog_limited',
          },
          budget_warnings: [{
            code: 'budget_underused',
            severity: 'warning',
            title: 'Budget is not fully used',
            message: 'This build uses 73.4% of the available budget.',
            recommendation: 'Review the suggested upgrades before buying.',
            suggested_slots: ['gpu'],
          }],
          upgrade_suggestions: [{
            slot: 'gpu',
            candidate: component('gpu', {
              sku: 'gpu-5070-ti',
              name: 'GeForce RTX 5070 Ti',
              price_idr: 14_000_000,
            }),
            added_cost_idr: 9_000_000,
            projected_total_idr: 18_000_000,
            reason: 'Higher graphics tier improves gaming frame rate.',
          }],
          performance_balance: {
            priority: 'gaming',
            summary: 'GPU choice is the primary gaming performance lever.',
            bottleneck_risk: 'low',
          },
        })}
      />,
    );

    expect(screen.getByText('Budget usage')).toBeVisible();
    expect(screen.getByText(/73.4% used/i)).toBeVisible();
    expect(screen.getByText('Budget is not fully used')).toBeVisible();
    expect(screen.getByText('GeForce RTX 5070 Ti')).toBeVisible();
    expect(screen.getByText('Performance balance')).toBeVisible();
    expect(screen.getByText(/primary gaming performance lever/i)).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

const part = (sku, name, brand, price_idr, specs = {}) => ({
  sku,
  id: sku,
  name,
  brand,
  price_idr,
  product_url: `https://enterkomputer.com/detail/${sku}`,
  stock_status: 'in_stock',
  scraped_at: '2026-05-10T10:06:21.498121+00:00',
  marketplace_links: [{ marketplace: 'enterkomputer', url: `https://enterkomputer.com/detail/${sku}` }],
  specs,
});

const buildRecommendation = {
  budget_idr: 20000000,
  total_idr: 19480000,
  remaining_idr: 520000,
  compatibility_warnings: [],
  compatibility_issues: [],
  components: {
    cpu: part('cpu-7600', 'AMD Ryzen 5 7600', 'AMD', 3150000, { socket: 'AM5', cores: 6 }),
    motherboard: part('b650m', 'B650M WiFi Motherboard', 'MSI', 2450000, { socket: 'AM5', ram_type: 'DDR5' }),
    ram: part('ddr5-32', '32GB DDR5 6000 Kit', 'TeamGroup', 1850000, { type: 'DDR5', capacity_gb: 32 }),
    gpu: part('rtx4060ti', 'GeForce RTX 4060 Ti 8GB', 'NVIDIA', 7200000, { vram_gb: 8 }),
    ssd: part('nvme-1tb', '1TB NVMe PCIe 4.0 SSD', 'Lexar', 1150000, { capacity_gb: 1024 }),
    psu: part('psu-650', '650W 80+ Gold PSU', 'Cooler Master', 1250000, { wattage_w: 650 }),
    cpu_cooler: part('tower-120', '120mm Tower Air Cooler', 'ID-Cooling', 1450000, { tdp_w: 180 }),
    fan_cooler: part('fan-120', '3-Pack 120mm Case Fan', 'ID-Cooling', 350000, { fan_size_mm: 120 }),
    case: part('case-air', 'Airflow mATX Case', 'Deepcool', 980000, { form_factor: 'mATX' }),
  },
  optional_addons: { hdd: null, monitor: null, ups: null },
};

const upgradeRecommendation = {
  budget_idr: 7000000,
  total_idr: 7200000,
  remaining_idr: -200000,
  recognized_existing: {
    cpu: 'Ryzen 5 5600',
    gpu: 'RTX 3060 12GB',
  },
  upgrade_priorities: [
    {
      title: 'Upgrade GPU first',
      reason: 'The existing CPU is still capable, while the GPU is the biggest uplift for 1440p gaming.',
    },
  ],
  recommendation: {
    budget_idr: 7000000,
    total_idr: 7200000,
    remaining_idr: -200000,
    compatibility_warnings: [],
    compatibility_issues: [],
    components: {
      cpu: part('keep-5600', 'Keep Ryzen 5 5600', 'AMD', 0, { socket: 'AM4', cores: 6 }),
      motherboard: null,
      ram: null,
      gpu: part('rtx4060ti', 'GeForce RTX 4060 Ti 8GB', 'NVIDIA', 7200000, { vram_gb: 8 }),
      ssd: null,
      psu: null,
      cpu_cooler: null,
      fan_cooler: null,
      case: null,
    },
    optional_addons: { hdd: null, monitor: null, ups: null },
  },
};

function buildResponseFor(request) {
  if (!request.include_optional_addons) return buildRecommendation;

  return {
    ...buildRecommendation,
    optional_addons: {
      ...buildRecommendation.optional_addons,
      hdd: part('hdd-2tb', '2TB SATA HDD', 'Seagate', 700000, { capacity_gb: 2048, interface: 'SATA' }),
    },
  };
}

async function mockBuildApi(page) {
  const requests = {
    build: [],
    ai: [],
  };

  await page.route('**/api/build/recommend', async (route) => {
    const request = route.request().postDataJSON();
    requests.build.push(request);
    await route.fulfill({ json: buildResponseFor(request) });
  });
  await page.route('**/api/build/ai-recommend', async (route) => {
    const request = route.request().postDataJSON();
    requests.ai.push(request);
    await route.fulfill({ json: { ...buildResponseFor(request), ai_assisted: true } });
  });

  return requests;
}

async function mockUpgradeApi(page) {
  const requests = [];

  await page.route('**/api/build/upgrade', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: upgradeRecommendation });
  });

  return requests;
}

async function mockAuditApi(page) {
  const requests = [];

  await page.route('**/api/build/audit', async (route) => {
    requests.push(route.request().postData() || '');
    await route.fulfill({
      json: {
        audit: {
          status: 'compatible',
          summary: 'No major compatibility issue detected.',
          detected_parts: [
            {
              slot: 'cpu',
              slot_label: 'Processor / CPU',
              name: 'Ryzen 5 5600',
              confidence: 0.94,
              source: 'text',
              extracted_specs: { socket: 'AM4', cores: 6, memory_support: { type: 'DDR4', channels: 2 } },
            },
            {
              slot: 'gpu',
              slot_label: 'VGA / GPU',
              name: 'RTX 3060 12GB',
              confidence: 0.91,
              source: 'text',
              extracted_specs: { vram_gb: 12 },
            },
          ],
          compatibility_issues: [],
          missing_slots: ['PSU'],
          budget_notes: ['Prices were not included in the pasted list.'],
          suggested_next_steps: ['Confirm PSU wattage before buying.'],
        },
      },
    });
  });

  return requests;
}

test('build wizard generates a full PC recommendation', async ({ page }) => {
  const requests = await mockBuildApi(page);
  await page.goto('/builder');

  await expect(page.getByRole('heading', { name: 'BUILD_WIZARD.EXE' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Recommendation mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate build', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate with AI', exact: true })).toHaveCount(0);
  await page.getByLabel('Budget (IDR)').fill('20.000.000');
  await page.getByLabel('Use case').selectOption('content_creation');
  await page.getByLabel('CPU').selectOption('AMD');
  await page.getByLabel('GPU').selectOption('Nvidia');
  await page.getByLabel(/Hard Drive \/ HDD/).check();
  await page.getByLabel(/Monitor/).check();
  await page.getByLabel(/UPS/).check();
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();

  await expect(page.getByText('AMD Ryzen 5 7600')).toBeVisible();
  await expect(page.getByText('GeForce RTX 4060 Ti 8GB')).toBeVisible();
  await expect(page.getByText('Rp 19.480.000')).toBeVisible();
  expect(requests.build).toEqual([
    {
      budget_idr: 20000000,
      use_case: 'content_creation',
      cpu_brand: 'AMD',
      gpu_vendor: 'Nvidia',
      include_optional_addons: true,
      selected_optional_addons: ['hdd', 'monitor', 'ups'],
    },
  ]);
  expect(requests.ai).toEqual([]);

  const enterKomputerLinks = page.getByRole('link', { name: /View at EnterKomputer - .+/ });
  await expect(enterKomputerLinks).toHaveCount(10);
  const enterKomputerLabels = await enterKomputerLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('aria-label'))
  );
  expect(new Set(enterKomputerLabels).size).toBe(10);
  expect(enterKomputerLabels).toContain('View at EnterKomputer - AMD Ryzen 5 7600');
  await expect(page.getByRole('region', { name: 'Optional add-ons' })).toBeVisible();
  await expect(page.getByText('2TB SATA HDD')).toBeVisible();
});

test('build wizard posts AI requests and marks AI-assisted results', async ({ page }) => {
  const requests = await mockBuildApi(page);
  await page.goto('/builder');

  await page.getByLabel('Budget (IDR)').fill('18.500.000');
  await page.getByLabel('Use case').selectOption('office');
  await page.getByLabel('CPU').selectOption('Intel');
  await page.getByLabel('GPU').selectOption('Intel');

  await page.getByRole('radio', { name: /AI-assisted/ }).check();
  await expect(page.getByLabel('AI profile')).toBeVisible();
  await page.getByLabel('AI profile').selectOption('local_qwen');
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();

  await expect(page.getByLabel('Recommendation source').getByText('AI-assisted')).toBeVisible();
  await expect(page.getByText('AMD Ryzen 5 7600')).toBeVisible();
  expect(requests.ai).toEqual([
    {
      budget_idr: 18500000,
      use_case: 'office',
      cpu_brand: 'Intel',
      gpu_vendor: 'Intel',
      include_optional_addons: false,
      selected_optional_addons: [],
      ai_profile: 'local_qwen',
    },
  ]);
  expect(requests.build).toEqual([]);
});

test('build wizard disables generation controls while a request is pending', async ({ page }) => {
  let releaseBuild;
  let resolveBuildRoute;
  const buildCanFinish = new Promise((resolve) => {
    releaseBuild = resolve;
  });
  const buildRouteFinished = new Promise((resolve) => {
    resolveBuildRoute = resolve;
  });

  const staleBuild = {
    ...buildRecommendation,
    components: {
      ...buildRecommendation.components,
      cpu: part('stale-cpu', 'Stale Build CPU', 'AMD', 3100000, { socket: 'AM5' }),
    },
  };

  await page.route('**/api/build/recommend', async (route) => {
    await buildCanFinish;
    await route.fulfill({ json: staleBuild });
    resolveBuildRoute();
  });

  await page.goto('/builder');
  await page.getByLabel('Budget (IDR)').fill('20.000.000');

  const generateButton = page.getByRole('button', { name: 'Generate build', exact: true });
  await generateButton.click();
  await expect(generateButton).toBeDisabled();
  await expect(page.getByRole('radio', { name: /AI-assisted/ })).toBeDisabled();
  await expect(page.getByText('Building a compatible parts list.')).toBeVisible();

  releaseBuild();
  await buildRouteFinished;

  await expect(page.getByText('Stale Build CPU')).toBeVisible();
  await expect(generateButton).toBeEnabled();
});

test('build result opens swap candidates in a retro modal', async ({ page }) => {
  const swapRequests = [];
  const swappedBuild = {
    ...buildRecommendation,
    total_idr: 17980000,
    remaining_idr: 2020000,
    components: {
      ...buildRecommendation.components,
      gpu: part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vram_gb: 8 }),
    },
  };

  await mockBuildApi(page);
  await page.route('**/api/build/swap-candidates', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            ...part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vram_gb: 8 }),
            price_delta_idr: -1500000,
            projected_total_idr: 17980000,
            projected_remaining_idr: 2020000,
            compatibility_summary: 'Fits the current PSU target.',
          },
        ],
      },
    });
  });
  await page.route('**/api/build/swap', async (route) => {
    swapRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: swappedBuild });
  });

  await page.goto('/builder');
  await page.getByLabel('Budget (IDR)').fill('20.000.000');
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();

  const swapOpener = page.locator('.part-row').filter({ hasText: 'VGA / GPU' }).getByRole('button', { name: 'Swap' });
  await swapOpener.click();

  const dialog = page.getByRole('dialog', { name: 'SWAP_GPU.EXE' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('GeForce RTX 4060 8GB')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'View at EnterKomputer - GeForce RTX 4060 8GB' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(swapOpener).toBeFocused();

  await swapOpener.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Select GeForce RTX 4060 8GB/ }).click();
  await dialog.getByRole('button', { name: 'Swap', exact: true }).click();

  expect(swapRequests).toHaveLength(1);
  expect(swapRequests[0]).toMatchObject({
    slot: 'gpu',
    new_component_id: 'rtx4060',
    current_build: {
      gpu: {
        sku: 'rtx4060ti',
      },
    },
  });
  await expect(page.getByRole('dialog', { name: 'SWAP_GPU.EXE' })).toHaveCount(0);
  await expect(page.locator('.part-row').filter({ hasText: 'VGA / GPU' })).toContainText('GeForce RTX 4060 8GB');
});

test('build wizard ignores stale swap responses after a newer build request', async ({ page }) => {
  let releaseSwap;
  let resolveSwapRoute;
  const swapCanFinish = new Promise((resolve) => {
    releaseSwap = resolve;
  });
  const swapRouteFinished = new Promise((resolve) => {
    resolveSwapRoute = resolve;
  });

  const staleSwapBuild = {
    ...buildRecommendation,
    components: {
      ...buildRecommendation.components,
      gpu: part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vram_gb: 8 }),
    },
  };
  const latestAiBuild = {
    ...buildRecommendation,
    ai_assisted: true,
    components: {
      ...buildRecommendation.components,
      gpu: part('rtx4070', 'GeForce RTX 4070 Super 12GB', 'NVIDIA', 9800000, { vram_gb: 12 }),
    },
  };

  await page.route('**/api/build/recommend', async (route) => {
    await route.fulfill({ json: buildRecommendation });
  });
  await page.route('**/api/build/ai-recommend', async (route) => {
    await route.fulfill({ json: latestAiBuild });
  });
  await page.route('**/api/build/swap-candidates', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            ...part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vram_gb: 8 }),
            price_delta_idr: -1500000,
            projected_total_idr: 17980000,
            projected_remaining_idr: 2020000,
            compatibility_summary: 'Fits the current PSU target.',
          },
        ],
      },
    });
  });
  await page.route('**/api/build/swap', async (route) => {
    await swapCanFinish;
    await route.fulfill({ json: staleSwapBuild });
    resolveSwapRoute();
  });

  await page.goto('/builder');
  await page.getByLabel('Budget (IDR)').fill('20.000.000');
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();
  await page.locator('.part-row').filter({ hasText: 'VGA / GPU' }).getByRole('button', { name: 'Swap' }).click();

  const dialog = page.getByRole('dialog', { name: 'SWAP_GPU.EXE' });
  await dialog.getByRole('button', { name: /GeForce RTX 4060 8GB/ }).click();
  await dialog.getByRole('button', { name: 'Swap', exact: true }).click();
  await page.evaluate(() => {
    const aiMode = document.querySelector('input[name="recommendation-mode"][value="ai"]');
    aiMode.click();
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.find((button) => button.textContent.trim() === 'Generate build').click();
  });

  await expect(page.getByText('GeForce RTX 4070 Super 12GB')).toBeVisible();
  await expect(page.getByLabel('Recommendation source').getByText('AI-assisted')).toBeVisible();

  releaseSwap();
  await swapRouteFinished;
  await page.waitForTimeout(100);

  await expect(page.getByText('GeForce RTX 4070 Super 12GB')).toBeVisible();
  await expect(page.getByLabel('Recommendation source').getByText('AI-assisted')).toBeVisible();
  await expect(page.locator('.part-row').filter({ hasText: 'VGA / GPU' })).not.toContainText('GeForce RTX 4060 8GB');
});

test('advisor answers against the active build context', async ({ page }) => {
  const advisorRequests = [];
  await mockBuildApi(page);
  await page.route('**/api/build/advisor', async (route) => {
    const request = route.request().postDataJSON();
    advisorRequests.push(request);
    await route.fulfill({
      json: {
        answer: advisorRequests.length === 1
          ? 'The GPU is the value anchor and the PSU has enough headroom.'
          : 'The RTX 4060 saves money while keeping 8 GB VRAM.',
        referenced_slots: ['gpu', 'psu'],
        evidence_cards: [
          {
            slot: 'gpu',
            label: 'GPU',
            name: 'GeForce RTX 4060 Ti 8GB',
            brand: 'NVIDIA',
            price_idr: 7200000,
            specs: [
              { label: 'VRAM', value: '8 GB' },
              { label: 'PSU target', value: '550W' },
            ],
            rationale: ['Current GPU is the main cost lever.'],
          },
        ],
        cost_saving_suggestions: [
          {
            slot: 'gpu',
            label: 'GPU',
            current: { sku: 'rtx4060ti', name: 'GeForce RTX 4060 Ti 8GB', price_idr: 7200000 },
            candidate: { sku: 'rtx4060', name: 'GeForce RTX 4060 8GB', price_idr: 5700000 },
            savings_idr: 1500000,
            projected_total_idr: 17980000,
            projected_remaining_idr: 2020000,
            compatibility_summary: 'Fits the current PSU target.',
            compatibility_warnings: [],
          },
        ],
        suggested_questions: ['What would I lose by downgrading GPU?'],
        fallback: false,
      },
    });
  });
  await page.route('**/api/build/swap-candidates', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            ...part('rtx4070', 'GeForce RTX 4070 Super 12GB', 'NVIDIA', 9800000, { vram_gb: 12 }),
            price_delta_idr: 2600000,
            projected_total_idr: 22080000,
            projected_remaining_idr: -2080000,
            compatibility_summary: 'More performance but over budget.',
          },
          {
            ...part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vram_gb: 8 }),
            price_delta_idr: -1500000,
            projected_total_idr: 17980000,
            projected_remaining_idr: 2020000,
            compatibility_summary: 'Fits the current PSU target.',
          },
        ],
      },
    });
  });

  await page.goto('/builder');
  await page.getByLabel('Budget (IDR)').fill('20.000.000');
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();
  await page.getByLabel('Ask the PC Build Advisor').fill('Any compatibility risks?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText('The GPU is the value anchor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PSU', exact: true })).toBeVisible();
  const advisor = page.getByLabel('Build advisor console');
  await expect(advisor.getByText('Evidence used')).toBeVisible();
  await expect(advisor.getByRole('heading', { name: 'GeForce RTX 4060 Ti 8GB' })).toBeVisible();
  await expect(advisor.getByText('Rp 7.200.000')).toBeVisible();
  await expect(advisor.getByText('Current GPU is the main cost lever.')).toBeVisible();
  await expect(advisor.getByText('Cost-saving swaps')).toBeVisible();
  await expect(advisor.getByText('Save Rp 1.500.000')).toBeVisible();
  await expect(advisor.getByText('Projected total')).toBeVisible();
  await expect(advisor.getByText('Rp 17.980.000')).toBeVisible();
  await expect(advisor.getByText('Fits the current PSU target.')).toBeVisible();
  await expect(advisor.getByRole('button', { name: 'What would I lose by downgrading GPU?' })).toBeVisible();

  await page.getByRole('button', { name: 'GPU', exact: true }).click();
  await expect(page.locator('[data-part-slot="gpu"]')).toBeFocused();
  await expect(page.locator('[data-part-slot="gpu"]')).toHaveClass(/is-referenced/);

  await advisor.getByRole('button', { name: /Review alternatives for GPU/ }).click();
  const dialog = page.getByRole('dialog', { name: 'SWAP_GPU.EXE' });
  await expect(dialog).toBeVisible();
  const suggestedCandidate = dialog.locator('.swap-card').filter({ hasText: 'GeForce RTX 4060 8GB' });
  await expect(suggestedCandidate).toBeVisible();
  await expect(suggestedCandidate).toHaveClass(/is-selected/);
  await expect(dialog.getByRole('link', { name: 'View at EnterKomputer - GeForce RTX 4060 8GB' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Select GeForce RTX 4060 8GB/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await advisor.getByRole('button', { name: 'What would I lose by downgrading GPU?' }).click();
  await expect(page.getByText('The RTX 4060 saves money while keeping 8 GB VRAM.')).toBeVisible();
  expect(advisorRequests.at(-1).question).toBe('What would I lose by downgrading GPU?');
});

test('advisor does not send stale history after a newer build replaces context', async ({ page }) => {
  const advisorRequests = [];
  const newerBuild = {
    ...buildRecommendation,
    ai_assisted: true,
    components: {
      ...buildRecommendation.components,
      cpu: part('ai-cpu', 'AI Fresh CPU', 'AMD', 3200000, { socket: 'AM5' }),
    },
  };

  await page.route('**/api/build/recommend', async (route) => {
    await route.fulfill({ json: buildRecommendation });
  });
  await page.route('**/api/build/ai-recommend', async (route) => {
    await route.fulfill({ json: newerBuild });
  });
  await page.route('**/api/build/advisor', async (route) => {
    const request = route.request().postDataJSON();
    advisorRequests.push(request);
    await route.fulfill({
      json: {
        answer: advisorRequests.length === 1
          ? 'First build answer mentions the original CPU.'
          : 'Second build answer uses the fresh CPU context.',
        referenced_slots: ['cpu'],
        evidence_cards: [],
        cost_saving_suggestions: [],
        suggested_questions: [],
        fallback: false,
      },
    });
  });

  await page.goto('/builder');
  await page.getByLabel('Budget (IDR)').fill('20.000.000');
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();
  await page.getByLabel('Ask the PC Build Advisor').fill('Is this first build balanced?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText('First build answer mentions the original CPU.')).toBeVisible();

  await page.getByRole('radio', { name: /AI-assisted/ }).check();
  await page.getByRole('button', { name: 'Generate build', exact: true }).click();
  await expect(page.getByText('AI Fresh CPU')).toBeVisible();
  await page.getByLabel('Ask the PC Build Advisor').fill('Is this newer build balanced?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText('Second build answer uses the fresh CPU context.')).toBeVisible();

  expect(advisorRequests).toHaveLength(2);
  expect(advisorRequests[1].history).toEqual([]);
  expect(advisorRequests[1].context.components.cpu.sku).toBe('ai-cpu');
});

test('upgrade planner recommends upgrades from existing components', async ({ page }) => {
  const requests = await mockUpgradeApi(page);
  await page.goto('/upgrade');

  await expect(page.getByRole('heading', { name: 'UPGRADE_PLANNER.EXE' })).toBeVisible();
  await expect(page.getByLabel('Upgrade budget (IDR)')).toHaveValue('7.000.000');
  await page.getByLabel('Use case').selectOption('gaming');
  await page.getByLabel('CPU', { exact: true }).fill('Ryzen 5 5600');
  await page.getByLabel('GPU', { exact: true }).fill('RTX 3060 12GB');
  await page.getByRole('button', { name: 'Recommend upgrade' }).click();

  await expect(page.getByText('Recognized existing components')).toBeVisible();
  await expect(page.getByText('Upgrade GPU first')).toBeVisible();
  await expect(page.getByText('GeForce RTX 4060 Ti 8GB')).toBeVisible();
  await expect(page.getByLabel('Ask the PC Upgrade Advisor')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    budget_idr: 7000000,
    use_case: 'gaming',
    existing_components: {
      cpu: 'Ryzen 5 5600',
      gpu: 'RTX 3060 12GB',
    },
  });
});

test('build audit submits pasted parts and applies detected parts to upgrade planner', async ({ page }) => {
  const requests = await mockAuditApi(page);
  await page.goto('/audit');

  await expect(page.getByRole('heading', { name: 'BUILD_AUDIT.EXE' })).toBeVisible();
  await page.getByLabel('Parts list').fill('CPU: Ryzen 5 5600\nGPU: RTX 3060 12GB');
  await page.getByRole('button', { name: 'Audit build' }).click();

  await expect(page.getByText('No major compatibility issue detected.')).toBeVisible();
  await expect(page.getByText('[object Object]')).toHaveCount(0);
  await expect(page.getByText(/DDR4/)).toBeVisible();
  await expect(page.getByText(/channels/i)).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('name="parts_list"');
  expect(requests[0]).toContain('CPU: Ryzen 5 5600');
  expect(requests[0]).toContain('GPU: RTX 3060 12GB');
  expect(requests[0]).toContain('name="goal"');
  expect(requests[0]).toContain('General Gaming');

  await page.getByRole('button', { name: 'Apply detected parts' }).click();

  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(page.getByLabel('CPU', { exact: true })).toHaveValue('Ryzen 5 5600');
  await expect(page.getByLabel('GPU', { exact: true })).toHaveValue('RTX 3060 12GB');
});

test('build audit keeps the newest result when requests overlap', async ({ page }) => {
  let releaseAudit;
  let resolveAuditRoute;
  const auditCanFinish = new Promise((resolve) => {
    releaseAudit = resolve;
  });
  const auditRouteFinished = new Promise((resolve) => {
    resolveAuditRoute = resolve;
  });

  const staleAudit = {
    audit: {
      status: 'compatible',
      summary: 'Stale audit summary',
      detected_parts: [
        {
          slot: 'cpu',
          slot_label: 'Processor / CPU',
          name: 'Stale audit CPU',
          confidence: 0.88,
          source: 'text',
          extracted_specs: { socket: 'AM4' },
        },
        {
          slot: 'gpu',
          slot_label: 'VGA / GPU',
          name: 'Stale audit GPU',
          confidence: 0.82,
          source: 'text',
          extracted_specs: { vram_gb: 8 },
        },
      ],
      compatibility_issues: [],
      missing_slots: [],
      budget_notes: [],
      suggested_next_steps: [],
    },
  };
  const freshAudit = {
    audit: {
      status: 'compatible',
      summary: 'Fresh audit summary',
      detected_parts: [
        {
          slot: 'gpu',
          slot_label: 'VGA / GPU',
          name: 'Fresh audit GPU',
          confidence: 0.96,
          source: 'text',
          extracted_specs: { vram_gb: 12 },
        },
      ],
      compatibility_issues: [],
      missing_slots: [],
      budget_notes: [],
      suggested_next_steps: [],
    },
  };

  let requestCount = 0;
  await page.route('**/api/build/audit', async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await auditCanFinish;
      await route.fulfill({ json: staleAudit });
      resolveAuditRoute();
      return;
    }
    await route.fulfill({ json: freshAudit });
  });

  await page.goto('/audit');
  await page.getByLabel('Parts list').fill('CPU: Stale audit CPU\nGPU: Stale audit GPU');
  await page.evaluate(() => document.querySelector('.audit-form').requestSubmit());
  await page.getByLabel('Parts list').fill('GPU: Fresh audit GPU');
  await page.evaluate(() => document.querySelector('.audit-form').requestSubmit());

  await expect(page.getByRole('heading', { name: 'Fresh audit GPU' })).toBeVisible();
  await expect(page.getByText('Fresh audit summary')).toBeVisible();

  releaseAudit();
  await auditRouteFinished;
  await page.waitForTimeout(100);

  await expect(page.getByRole('heading', { name: 'Fresh audit GPU' })).toBeVisible();
  await expect(page.getByText('Fresh audit summary')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stale audit CPU' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Stale audit GPU' })).toHaveCount(0);
});

test('upgrade planner consumes audit prefill from storage', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('kompare95:audit-upgrade-prefill', JSON.stringify({
      parts: {
        cpu: 'Ryzen 5 5600',
        gpu: 'RTX 3060 12GB',
      },
    }));
  });

  await page.goto('/upgrade');

  await expect(page.getByLabel('CPU', { exact: true })).toHaveValue('Ryzen 5 5600');
  await expect(page.getByLabel('GPU', { exact: true })).toHaveValue('RTX 3060 12GB');
  await expect(page.evaluate(() => window.localStorage.getItem('kompare95:audit-upgrade-prefill'))).resolves.toBeNull();
});

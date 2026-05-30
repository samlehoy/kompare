import { expect, test } from '@playwright/test';

const buildRecommendation = {
  budget_idr: 20000000,
  total_idr: 19480000,
  remaining_idr: 520000,
  compatibility_warnings: [],
  compatibility_issues: [],
  unmet_preferences: [],
  components: {
    cpu: part('cpu-7600', 'AMD Ryzen 5 7600', 'AMD', 3150000, { socket: 'AM5', cores: 6, threads: 12, tdp_w: 65 }),
    motherboard: part('b650m', 'B650M WiFi Motherboard', 'MSI', 2450000, { socket: 'AM5', form_factor: 'mATX', ram_type: 'DDR5' }),
    ram: part('ddr5-32', '32GB DDR5 6000 Kit', 'TeamGroup', 1850000, { type: 'DDR5', capacity_gb: 32, speed_mhz: 6000 }),
    gpu: part('rtx4060ti', 'GeForce RTX 4060 Ti 8GB', 'NVIDIA', 7200000, { vendor: 'Nvidia', vram_gb: 8, tdp_w: 160, recommended_psu_w: 550 }),
    ssd: part('nvme-1tb', '1TB NVMe PCIe 4.0 SSD', 'Lexar', 1150000, { capacity_gb: 1024, interface: 'PCIe 4.0' }),
    psu: part('psu-650', '650W 80+ Gold PSU', 'Cooler Master', 1250000, { wattage_w: 650, rating: 'Gold', modular: true }),
    cpu_cooler: part('tower-120', '120mm Tower Air Cooler', 'ID-Cooling', 1450000, { type: 'Air', tdp_w: 180, fan_size_mm: 120 }),
    fan_cooler: part('fan-120', '3-Pack 120mm Case Fan', 'ID-Cooling', 350000, { type: 'fan', fan_size_mm: 120 }),
    case: part('case-air', 'Airflow mATX Case', 'Deepcool', 980000, { form_factor: 'mATX', color: 'Black' }),
    cooler: part('tower-120', '120mm Tower Air Cooler', 'ID-Cooling', 1450000, { type: 'Air', tdp_w: 180, fan_size_mm: 120 }),
  },
  optional_addons: { hdd: null, monitor: null, ups: null },
  missing_slots: [],
  unavailable_optional_addons: ['hdd', 'monitor', 'ups'],
};

const aiBuildRecommendation = {
  ...buildRecommendation,
  ai_assisted: true,
  fallback: false,
  retrieval: {
    embedding_model: 'gemini-embedding-001',
    top_k_per_slot: 12,
    chunk_count_considered: 120,
  },
  ai_rationale: {
    summary: 'This build prioritizes GPU value.',
    tradeoffs: ['GPU value over premium motherboard extras.'],
  },
};

const routes = [
  { path: '/', label: 'PC Builder landing' },
  { path: '/builder', label: 'Build from zero' },
  { path: '/upgrade', label: 'Upgrade existing PC' },
  { path: '/audit', label: 'Audit a PC Build' },
];

const viewports = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

function part(sku, name, brand, price_idr, specs) {
  return {
    sku,
    id: sku,
    name,
    brand,
    price_idr,
    category: 'desktop_pc',
    tier: 'catalog',
    product_url: `https://enterkomputer.com/detail/${sku}`,
    image_url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23d97757'/%3E%3C/svg%3E`,
    stock_status: 'in_stock',
    scraped_at: '2026-05-10T10:06:21.498121+00:00',
    marketplace_links: [
      { marketplace: 'enterkomputer', url: `https://enterkomputer.com/detail/${sku}` },
      { marketplace: 'tokopedia', url: `https://tokopedia.com/enterkomputer/${sku}` },
      { marketplace: 'shopee', url: `https://shopee.co.id/product/${sku}` },
    ],
    primary_url: `https://enterkomputer.com/detail/${sku}`,
    selection_rationale: {
      summary: `${name} was selected by the backend ranking model.`,
      factors: ['In-stock listing', 'Recent marketplace data', 'Balanced value for the slot budget'],
    },
    specs,
  };
}

async function mockApi(page) {
  await page.route('**/api/build/budget-tiers', async (route) => {
    await route.fulfill({
      json: {
        tiers: [
          { key: 'entry_level', label: 'Entry-level', min_idr: 7000000, max_idr: 12000000, target: 'Office, school, light esports, and compact upgrade-friendly basics.', summary: 'Tight starter build for office, school, and light esports.', performance_goal: 'Everyday + light esports', upgrade_note: 'Keeps the platform simple and upgrade-ready.' },
          { key: 'mid_range', label: 'Mid-range', min_idr: 12000000, max_idr: 22000000, target: 'Strong 1080p ultra or 1440p entry gaming with balanced platform choices.', summary: 'Balanced 1080p ultra build with 1440p entry headroom.', performance_goal: '1080p ultra / 1440p entry', upgrade_note: 'Balances GPU value, RAM, and PSU headroom.' },
          { key: 'high_end', label: 'High-end', min_idr: 22000000, max_idr: 40000000, target: '1440p high-refresh, content creation, and longer upgrade runway.', summary: 'Focused high-refresh gaming and creator workload tier.', performance_goal: '1440p high-refresh', upgrade_note: 'Adds stronger cooling and platform runway.' },
          { key: 'custom', label: 'Custom budget', min_idr: 3000000, max_idr: null, display_range: '♾️', target: 'User-defined budget.', summary: 'Enter your own number and keep the same balance checks.', performance_goal: 'Manual budget fit', upgrade_note: 'Uses compatibility checks at your number.' },
        ],
      },
    });
  });

  await page.route('**/api/build/recommend', async (route) => {
    await route.fulfill({ json: buildRecommendation });
  });

  await page.route('**/api/build/advisor', async (route) => {
    await route.fulfill({
      json: {
        answer: 'The GPU is the right value anchor for this build, and the PSU has enough headroom.',
        referenced_slots: ['gpu', 'psu'],
        suggested_questions: ['Can I reduce the total price?', 'What should I upgrade first?'],
        fallback: false,
      },
    });
  });

  await page.route('**/api/build/swap-candidates', async (route) => {
    const body = route.request().postDataJSON();
    const items = body.slot === 'motherboard'
      ? [
          {
            ...part('b650m-plus', 'B650M WiFi Plus Motherboard', 'MSI', 2650000, { socket: 'AM5', form_factor: 'mATX', ram_type: 'DDR5' }),
            compatibility_summary: 'Matches current CPU socket AM5, DDR5 memory, and mATX casing.',
            compatibility_warnings: [],
            price_delta_idr: 200000,
            projected_total_idr: 19680000,
            projected_remaining_idr: 320000,
          },
        ]
      : body.slot === 'gpu'
        ? [
            {
              ...part('rtx4060', 'GeForce RTX 4060 8GB', 'NVIDIA', 5700000, { vendor: 'Nvidia', vram_gb: 8, recommended_psu_w: 550 }),
              compatibility_summary: 'Fits the current PSU target at 550W recommendation.',
              compatibility_warnings: [],
              price_delta_idr: -1500000,
              projected_total_idr: 17980000,
              projected_remaining_idr: 2020000,
            },
          ]
      : [];
    await route.fulfill({ json: { items, total: items.length, slot: body.slot } });
  });

  await page.route('**/api/build/upgrade', async (route) => {
    await route.fulfill({
      json: {
        mode: 'upgrade',
        budget_idr: 7000000,
        use_case: 'gaming',
        recognized_existing: {
          cpu: 'Ryzen 5 5600',
          ram: '16GB DDR4 3200',
          gpu: 'RTX 3060 12GB',
          ssd: '1TB NVMe SSD',
          hdd: '2TB SATA HDD',
        },
        detected_existing: {
          cpu: {
            sku: 'owned-cpu',
            name: 'Ryzen 5 5600',
            slot: 'cpu',
            detection_confidence: 'medium',
            specs: { socket: 'AM4', brand: 'AMD' },
          },
          ram: {
            sku: 'owned-ram',
            name: '16GB DDR4 3200',
            slot: 'ram',
            detection_confidence: 'medium',
            specs: { type: 'DDR4', capacity_gb: 16, speed_mhz: 3200 },
          },
          gpu: {
            sku: 'owned-gpu',
            name: 'RTX 3060 12GB',
            slot: 'gpu',
            detection_confidence: 'medium',
            specs: { vendor: 'Nvidia', vram_gb: 12, recommended_psu_w: 550 },
          },
          ssd: {
            sku: 'owned-ssd',
            name: '1TB NVMe SSD',
            slot: 'ssd',
            detection_confidence: 'medium',
            specs: { capacity_gb: 1024, interface: 'NVMe', form_factor: 'M.2' },
          },
          hdd: {
            sku: 'owned-hdd',
            name: '2TB SATA HDD',
            slot: 'hdd',
            detection_confidence: 'medium',
            specs: { capacity_gb: 2048, interface: 'SATA', form_factor_in: '3.5' },
          },
        },
        unknown_existing: {},
        recommendation: {
          total_idr: 7450000,
          components: {
            gpu: part('rtx4060ti', 'GeForce RTX 4060 Ti 8GB', 'NVIDIA', 5000000, { vendor: 'Nvidia', vram_gb: 8, recommended_psu_w: 550 }),
            ram: part('ddr4-32', '32GB DDR4 3200 Kit', 'TeamGroup', 1200000, { type: 'DDR4', capacity_gb: 32, speed_mhz: 3200 }),
            psu: part('psu-650', '650W 80+ Gold PSU', 'Cooler Master', 1250000, { wattage_w: 650, rating: 'Gold' }),
          },
        },
        upgrade_priorities: [
          {
            slot: 'gpu',
            score: 96,
            title: 'Upgrade GPU first',
            reason: 'Your typed GPU looks below the 8GB VRAM target, so this is likely the biggest gaming improvement.',
            estimated_cost_idr: 5000000,
            selected: true,
          },
          {
            slot: 'ram',
            score: 82,
            title: 'Increase RAM capacity',
            reason: 'Your typed RAM capacity is below the recommended target for this performance goal.',
            estimated_cost_idr: 1200000,
            selected: true,
          },
          {
            slot: 'psu',
            score: 78,
            title: 'Upgrade PSU headroom',
            reason: 'Your typed PSU is below the 550W target for the planned graphics upgrade.',
            estimated_cost_idr: 1250000,
            selected: true,
          },
        ],
        compatibility_notes: ['Motherboard was not provided, so compatibility can only be estimated.'],
        compatibility_warnings: [
          {
            id: 'owned_motherboard_missing',
            severity: 'info',
            slot: 'motherboard',
            slots: ['motherboard'],
            title: 'Motherboard not provided',
            message: 'Motherboard was not provided, so compatibility can only be estimated.',
            recommendation: 'Type your current motherboard if you want a more precise upgrade check.',
          },
        ],
      },
    });
  });

}

async function seedStorage(page, storage = {}) {
  await page.addInitScript((items) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
  }, storage);
}

async function assertResponsive(page, routeLabel, viewport) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.app-shell')).toBeVisible();

  const issues = await page.evaluate(() => {
    const tolerance = 1;
    const width = window.innerWidth;
    const rootOverflow = Math.ceil(document.documentElement.scrollWidth - width);
    const bodyOverflow = Math.ceil(document.body.scrollWidth - width);
    const badElements = [];
      const selector = [
        '.app-main',
        '.page-header',
        '.part-card',
        '.budget-form',
        '.toast',
        'button',
      'a',
      'input',
      'select',
      'textarea',
    ].join(',');

    for (const el of document.querySelectorAll(selector)) {
      if (el.closest('.drawer-backdrop:not([aria-hidden="false"])')) continue;

      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > width + tolerance || rect.left < -tolerance) {
        badElements.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.className || ''),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }

    return {
      rootOverflow,
      bodyOverflow,
      badElements: badElements.slice(0, 10),
    };
  });

  expect(issues, `${routeLabel} at ${viewport.name} should not create page-level horizontal overflow`).toEqual({
    rootOverflow: expect.any(Number),
    bodyOverflow: expect.any(Number),
    badElements: [],
  });
  expect(issues.rootOverflow, `${routeLabel} at ${viewport.name} document overflow`).toBeLessThanOrEqual(1);
  expect(issues.bodyOverflow, `${routeLabel} at ${viewport.name} body overflow`).toBeLessThanOrEqual(1);
}

test.describe('responsive UI audit', () => {
  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport });

      for (const routeInfo of routes) {
        test(`${routeInfo.label} fits within ${viewport.width}px viewport`, async ({ page }) => {
          await mockApi(page);
          await seedStorage(page, routeInfo.storage);

          await page.goto(routeInfo.path);

          if (routeInfo.path === '/builder') {
            await page.getByRole('button', { name: /generate/i }).click();
          }

          if (viewport.width < 1024) {
            await expect(page.locator('.app-topbar')).toBeVisible();
          } else {
            await expect(page.locator('.app-sidebar').first()).toBeVisible();
          }

          await assertResponsive(page, routeInfo.label, viewport);
        });
      }
    });
  }
});

test.describe('pc builder product focus', () => {
  test('visible navigation hides old product shopping pages', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'PC Builder', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upgrade', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit build', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^browse$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^compare$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /identify/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /add product/i })).toHaveCount(0);
  });

  test('shared hero does not repeat build and upgrade CTA buttons', async ({ page }) => {
    await mockApi(page);

    for (const path of ['/', '/builder', '/upgrade', '/audit']) {
      await page.goto(path);
      await expect(page.locator('.pc-builder-hero .hero-actions')).toHaveCount(0);
      await expect(page.locator('.pc-builder-hero').getByRole('link', { name: /start from zero/i })).toHaveCount(0);
      await expect(page.locator('.pc-builder-hero').getByRole('link', { name: /upgrade my pc/i })).toHaveCount(0);
    }
  });

  test('side navigation includes a working theme toggle and drawer background is continuous', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await seedStorage(page, { 'kompare:theme': 'dark' });
    await page.goto('/upgrade');

    await page.getByRole('button', { name: /open navigation/i }).click();
    await expect(page.locator('.drawer')).toBeVisible();
    const drawerThemeToggle = page.locator('.drawer .app-sidebar .theme-toggle');
    await expect(drawerThemeToggle).toBeVisible();
    await expect(drawerThemeToggle).toHaveAttribute('aria-label', /switch to light theme/i);
    await drawerThemeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(drawerThemeToggle).toHaveAttribute('aria-label', /switch to dark theme/i);

    const metrics = await page.evaluate(() => {
      const drawer = document.querySelector('.drawer');
      const sidebar = document.querySelector('.drawer .app-sidebar');
      const drawerRect = drawer?.getBoundingClientRect();
      const sidebarRect = sidebar?.getBoundingClientRect();
      return {
        drawerBg: drawer ? getComputedStyle(drawer).backgroundColor : '',
        sidebarBg: sidebar ? getComputedStyle(sidebar).backgroundColor : '',
        drawerHeight: Math.round(drawerRect?.height ?? 0),
        sidebarHeight: Math.round(sidebarRect?.height ?? 0),
      };
    });

    expect(metrics.sidebarBg).toBe(metrics.drawerBg);
    expect(metrics.sidebarHeight).toBeGreaterThanOrEqual(metrics.drawerHeight);
  });

  test('upgrade flow accepts manually typed existing parts', async ({ page }) => {
    let upgradePayload = null;
    await mockApi(page);
    await page.route('**/api/build/upgrade', async (route) => {
      upgradePayload = route.request().postDataJSON();
      await route.fallback();
    });
    await page.goto('/upgrade');
    await page.getByLabel(/^cpu$/i).fill('Ryzen 5 5600');
    await page.getByLabel(/^ssd/i).fill('1TB NVMe SSD');
    await page.getByLabel(/hard drive|hdd/i).fill('2TB SATA HDD');
    await page.getByLabel(/gpu/i).fill('RTX 3060 12GB');
    await page.getByRole('button', { name: /recommend upgrade/i }).click();
    await expect(page.getByText(/recognized existing/i)).toBeVisible();
    await expect(page.getByText(/Ryzen 5 5600/i).first()).toBeVisible();
    await expect(page.getByText(/1TB NVMe SSD/i).first()).toBeVisible();
    await expect(page.getByText(/2TB SATA HDD/i).first()).toBeVisible();
    await expect(page.getByText(/650W 80\+ Gold PSU/i)).toBeVisible();
    await expect(page.getByText(/Upgrade priority/i)).toBeVisible();
    await expect(page.getByText(/Upgrade GPU first/i)).toBeVisible();
    await expect(page.getByText(/biggest gaming improvement/i)).toBeVisible();
    await expect(page.getByText(/compatibility check/i)).toBeVisible();
    await expect(page.getByText(/Motherboard not provided/i)).toBeVisible();
    await expect(page.getByText(/Detected from your input/i)).toBeVisible();
    await expect(page.getByText(/AM4/i).first()).toBeVisible();
    await expect(page.getByText(/DDR4/i).first()).toBeVisible();
    await expect(page.getByText(/1024 GB/i).first()).toBeVisible();
    await expect(page.getByText(/2048 GB/i).first()).toBeVisible();

    expect(upgradePayload.existing_components.ssd).toBe('1TB NVMe SSD');
    expect(upgradePayload.existing_components.hdd).toBe('2TB SATA HDD');
  });

  test('upgrade flow includes cooling slots in the existing component contract', async ({ page }) => {
    let upgradePayload = null;
    await mockApi(page);
    await page.route('**/api/build/upgrade', async (route) => {
      upgradePayload = route.request().postDataJSON();
      await route.fallback();
    });

    await page.goto('/upgrade');
    await page.getByLabel(/cpu cooler/i).fill('DeepCool AK400 tower cooler');
    await page.getByLabel(/fan cooler/i).fill('Arctic P12 3-pack 120mm case fans');
    await page.getByRole('button', { name: /recommend upgrade/i }).click();

    expect(upgradePayload.existing_components.cpu_cooler).toBe('DeepCool AK400 tower cooler');
    expect(upgradePayload.existing_components.fan_cooler).toBe('Arctic P12 3-pack 120mm case fans');
  });

  test('upgrade form uses the wide desktop content track', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockApi(page);
    await page.goto('/upgrade');
    await expect(page.locator('.upgrade-form')).toBeVisible();

    const widths = await page.evaluate(() => {
      const main = document.querySelector('.app-main')?.getBoundingClientRect();
      const form = document.querySelector('.upgrade-form')?.getBoundingClientRect();
      return {
        main: main?.width ?? 0,
        form: form?.width ?? 0,
      };
    });

    expect(widths.form).toBeGreaterThan(widths.main * 0.75);
  });

  test('build result component cards expose marketplace buying context', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(page.getByText(/buying links/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /view at enterkomputer/i }).first()).toHaveAttribute(
      'href',
      /enterkomputer\.com/
    );
    await expect(page.getByRole('link', { name: /tokopedia/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /shopee/i })).toHaveCount(0);
    await expect(page.getByText(/SKU: cpu-7600/i)).toBeVisible();
  });

  test('build result shows AI metadata when the response is AI-assisted', async ({ page }) => {
    await mockApi(page);
    await page.unroute('**/api/build/recommend');
    await page.route('**/api/build/recommend', async (route) => {
      await route.fulfill({ json: aiBuildRecommendation });
    });

    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(page.getByText('AI-assisted')).toBeVisible();
    await expect(page.getByText('Retrieved candidates reviewed')).toBeVisible();
    await expect(page.getByText('This build prioritizes GPU value.')).toBeVisible();
  });

  test('generated build result stays scoped to the build page', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('.builder-result-grid')).toBeVisible();
    await expect(page.getByText(/Build summary/i)).toBeVisible();

    await page.getByRole('link', { name: 'PC Builder', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.builder-result-grid')).toHaveCount(0);
    await expect(page.locator('.part-card')).toHaveCount(0);
    await expect(page.getByText(/Build summary/i)).toHaveCount(0);

    await page.getByRole('link', { name: 'Upgrade', exact: true }).click();
    await expect(page).toHaveURL(/\/upgrade$/);
    await expect(page.locator('.builder-result-grid')).toHaveCount(0);
    await expect(page.locator('.part-card')).toHaveCount(0);
    await expect(page.getByText(/Build summary/i)).toHaveCount(0);
  });

  test('build result component cards show product media stock and freshness', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const cpuCard = page.locator('.part-card').filter({ hasText: 'AMD Ryzen 5 7600' });
    await expect(cpuCard.getByRole('img', { name: /AMD Ryzen 5 7600/i })).toBeVisible();
    await expect(cpuCard.getByText(/In stock/i)).toBeVisible();
    await expect(cpuCard.getByText(/Updated May 10, 2026/i)).toBeVisible();
  });

  test('build result cards do not collapse into cramped two-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('.part-card')).toHaveCount(10);

    const metrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.builder-result-grid > .parts-list > .part-card'))
        .map((card) => card.getBoundingClientRect());
      const firstTop = cards[0]?.top ?? 0;
      const firstRowCount = cards.filter((rect) => Math.abs(rect.top - firstTop) < 2).length;
      const minCardWidth = Math.min(...cards.map((rect) => rect.width));
      const badElements = [];

      for (const el of document.querySelectorAll('.builder-result-grid .part-card, .builder-result-grid .part-card-body, .builder-result-grid .part-card-right')) {
        const rect = el.getBoundingClientRect();
        const card = el.closest('.part-card')?.getBoundingClientRect();
        if (card && (rect.left < card.left - 1 || rect.right > card.right + 1)) {
          badElements.push({
            className: String(el.className || ''),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            cardLeft: Math.round(card.left),
            cardRight: Math.round(card.right),
          });
        }
      }

      return {
        firstRowCount,
        minCardWidth: Math.round(minCardWidth),
        badElements,
      };
    });

    expect(metrics.firstRowCount).toBe(1);
    expect(metrics.minCardWidth).toBeGreaterThanOrEqual(420);
    expect(metrics.badElements).toEqual([]);
  });

  test('build result cards expose buyer-friendly component spec labels', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const gpuCard = page.locator('.part-card').filter({ hasText: 'VGA / GPU' });
    await expect(gpuCard.getByText(/VRAM/i)).toBeVisible();
    await expect(gpuCard.getByText(/8 GB/i)).toBeVisible();
    await expect(gpuCard.getByText(/PSU target/i)).toBeVisible();
    await expect(gpuCard.getByText(/550W/i)).toBeVisible();

    const ramCard = page.locator('.part-card').filter({ hasText: 'RAM' });
    await expect(ramCard.getByText(/Memory type/i)).toBeVisible();
    await expect(ramCard.getByText(/^DDR5$/).first()).toBeVisible();
    await expect(ramCard.getByText(/Speed/i)).toBeVisible();
    await expect(ramCard.getByText(/6000 MHz/i)).toBeVisible();
  });

  test('why-this-part uses backend selection rationale when provided', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const cpuCard = page.locator('.part-card').filter({ hasText: 'AMD Ryzen 5 7600' });
    await cpuCard.getByRole('button', { name: /why this part/i }).click();

    await expect(cpuCard.getByText(/selected by the backend ranking model/i)).toBeVisible();
    await expect(cpuCard.getByText(/balanced value for the slot budget/i)).toBeVisible();
  });

  test('pc build advisor answers questions from the active build context', async ({ page }) => {
    let advisorPayload = null;
    await mockApi(page);
    await page.route('**/api/build/advisor', async (route) => {
      advisorPayload = route.request().postDataJSON();
      await route.fulfill({
        json: {
          answer: 'The GPU is the right value anchor for this build, and the PSU has enough headroom.',
          referenced_slots: ['gpu', 'psu'],
          evidence_cards: [
            {
              slot: 'gpu',
              label: 'GPU',
              name: 'GeForce RTX 4060 Ti 8GB',
              price_idr: 7200000,
              stock_label: 'In stock',
              specs: [
                { label: 'VRAM', value: '8 GB' },
                { label: 'PSU target', value: '550W' },
              ],
              rationale: ['Balanced value for the slot budget'],
            },
            {
              slot: 'psu',
              label: 'PSU',
              name: '650W 80+ Gold PSU',
              price_idr: 1250000,
              stock_label: 'In stock',
              specs: [{ label: 'Wattage', value: '650W' }],
              rationale: ['Enough headroom for this GPU'],
            },
          ],
          suggested_questions: ['Can I reduce the total price?'],
          fallback: false,
        },
      });
    });
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(page.getByRole('region', { name: /pc build advisor/i })).toBeVisible();
    await page.getByLabel(/ask the pc build advisor/i).fill('Why this GPU and is the PSU enough?');
    await page.getByRole('button', { name: /^ask$/i }).click();

    await expect(page.getByText(/right value anchor/i)).toBeVisible();
    const advisor = page.getByRole('region', { name: /pc build advisor/i });
    await expect(advisor.locator('.advisor-reference-chip')).toHaveText(['GPU', 'PSU']);
    await expect(advisor.getByText(/Evidence used/i)).toBeVisible();
    await expect(advisor.getByText(/GeForce RTX 4060 Ti 8GB/i)).toBeVisible();
    await expect(advisor.getByText(/Rp\s?7\.200\.000/i)).toBeVisible();
    await expect(advisor.getByText(/VRAM/i)).toBeVisible();
    await expect(advisor.getByText(/8 GB/i)).toBeVisible();
    await expect(advisor.getByText(/Balanced value for the slot budget/i)).toBeVisible();
    await expect(page.locator('.part-card[data-part-slot="gpu"]')).toHaveClass(/is-advisor-referenced/);
    await expect(page.locator('.part-card[data-part-slot="psu"]')).toHaveClass(/is-advisor-referenced/);

    await advisor.getByRole('button', { name: /focus gpu component card/i }).click();
    await expect(page.locator('.part-card[data-part-slot="gpu"]')).toBeFocused();

    expect(advisorPayload.mode).toBe('build');
    expect(advisorPayload.question).toBe('Why this GPU and is the PSU enough?');
    expect(advisorPayload.context.components.gpu.sku).toBe('rtx4060ti');
    expect(advisorPayload.history).toEqual([]);
  });

  test('pc build advisor suggests cheaper compatible swap actions', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/build/advisor', async (route) => {
      await route.fulfill({
        json: {
          answer: 'You can reduce the GPU cost by reviewing a cheaper compatible RTX 4060 option.',
          referenced_slots: ['gpu'],
          evidence_cards: [
            {
              slot: 'gpu',
              label: 'GPU',
              name: 'GeForce RTX 4060 Ti 8GB',
              price_idr: 7200000,
              stock_label: 'In stock',
              specs: [{ label: 'VRAM', value: '8 GB' }],
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
              compatibility_summary: 'Fits the current PSU target at 550W recommendation.',
              compatibility_warnings: [],
            },
          ],
          suggested_questions: ['What would I lose by downgrading GPU?'],
          fallback: false,
        },
      });
    });

    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();
    await page.getByLabel(/ask the pc build advisor/i).fill('Can I reduce the GPU price?');
    await page.getByRole('button', { name: /^ask$/i }).click();

    const advisor = page.getByRole('region', { name: /pc build advisor/i });
    await expect(advisor.getByText(/Cost-saving swaps/i)).toBeVisible();
    await expect(advisor.getByText(/GeForce RTX 4060 8GB/i)).toBeVisible();
    await expect(advisor.getByText(/Save Rp\s?1\.500\.000/i)).toBeVisible();
    await expect(advisor.getByText(/Projected total/i)).toBeVisible();
    await expect(advisor.getByText(/Rp\s?17\.980\.000/i)).toBeVisible();
    await expect(advisor.getByText(/Fits the current PSU target/i)).toBeVisible();

    await advisor.getByRole('button', { name: /review cheaper gpu alternatives/i }).click();
    const dialog = page.getByRole('dialog', { name: /swap gpu/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Compatible alternatives', { exact: true })).toBeVisible();
    const recommendedCandidate = page.locator('.swap-candidate-card').filter({ hasText: 'GeForce RTX 4060 8GB' });
    await expect(recommendedCandidate).toBeVisible();
    await expect(recommendedCandidate).toHaveClass(/is-selected/);
    await expect(recommendedCandidate.getByText(/Advisor pick/i)).toBeVisible();
    await expect(recommendedCandidate.getByRole('button', { name: /selected/i })).toBeVisible();
  });

  test('pc upgrade advisor answers from the active upgrade context', async ({ page }) => {
    let advisorPayload = null;
    await mockApi(page);
    await page.route('**/api/build/advisor', async (route) => {
      advisorPayload = route.request().postDataJSON();
      await route.fulfill({
        json: {
          answer: 'Your first upgrade should focus on the GPU, then RAM if the budget still allows it.',
          referenced_slots: ['gpu', 'ram'],
          evidence_cards: [
            {
              slot: 'gpu',
              label: 'GPU',
              name: 'GeForce RTX 4060 Ti 8GB',
              price_idr: 5000000,
              stock_label: 'In stock',
              specs: [{ label: 'VRAM', value: '8 GB' }],
              rationale: ['Top ranked upgrade priority'],
            },
            {
              slot: 'ram',
              label: 'RAM',
              name: '32GB DDR4 3200 Kit',
              price_idr: 1200000,
              stock_label: 'In stock',
              specs: [{ label: 'Capacity', value: '32 GB' }],
              rationale: ['Capacity upgrade for this workload'],
            },
          ],
          suggested_questions: ['Should I upgrade the PSU too?'],
          fallback: false,
        },
      });
    });

    await page.goto('/upgrade');
    await page.getByLabel(/^cpu$/i).fill('Ryzen 5 5600');
    await page.getByLabel(/gpu/i).fill('RTX 3060 12GB');
    await page.getByRole('button', { name: /recommend upgrade/i }).click();

    await expect(page.getByRole('region', { name: /pc upgrade advisor/i })).toBeVisible();
    await page.getByLabel(/ask the pc upgrade advisor/i).fill('What should I upgrade first?');
    await page.getByRole('button', { name: /^ask$/i }).click();

    await expect(page.getByText(/first upgrade should focus on the GPU/i)).toBeVisible();
    const advisor = page.getByRole('region', { name: /pc upgrade advisor/i });
    await expect(advisor.locator('.advisor-reference-chip')).toHaveText(['GPU', 'RAM']);
    await expect(advisor.getByText(/Top ranked upgrade priority/i)).toBeVisible();
    await expect(advisor.getByText(/32GB DDR4 3200 Kit/i)).toBeVisible();
    await expect(page.locator('.upgrade-result .part-card[data-part-slot="gpu"]')).toHaveClass(/is-advisor-referenced/);
    await expect(page.locator('.upgrade-result .part-card[data-part-slot="ram"]')).toHaveClass(/is-advisor-referenced/);

    expect(advisorPayload.mode).toBe('upgrade');
    expect(advisorPayload.question).toBe('What should I upgrade first?');
    expect(advisorPayload.context.recognized_existing.cpu).toBe('Ryzen 5 5600');
    expect(advisorPayload.context.recommendation.components.gpu.sku).toBe('rtx4060ti');
  });

  test('build audit panel has a dedicated page and stays off builder and upgrade pages', async ({ page }) => {
    await mockApi(page);

    for (const path of ['/builder', '/upgrade']) {
      await page.goto(path);
      await expect(page.getByRole('region', { name: /audit a pc build/i })).toHaveCount(0);
    }

    await page.goto('/audit');
    const panel = page.getByRole('region', { name: /audit a pc build/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel(/cart screenshot/i)).toBeVisible();
    await expect(panel.getByLabel(/build goal/i)).toBeVisible();
    await expect(panel.getByLabel(/parts list/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /identify/i })).toHaveCount(0);
  });

  test('build audit page uses the split upload and checklist card layout', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await page.goto('/audit');

    const panel = page.getByRole('region', { name: /audit a pc build/i });
    await expect(panel.locator('.build-audit-card')).toBeVisible();
    await expect(panel.locator('.build-audit-dropzone')).toBeVisible();
    await expect(panel.getByText('Cart Screenshot')).toBeVisible();
    await expect(panel.getByText('OR', { exact: true })).toBeVisible();
    await expect(panel.getByLabel(/build goal/i)).toHaveValue('General Gaming');
    await expect(panel.getByText('What we check')).toBeVisible();
    await expect(panel.getByText(/CPU & Motherboard socket matching/i)).toBeVisible();
    await expect(panel.getByText(/RAM generation/i)).toBeVisible();
    await expect(panel.getByText(/Power supply wattage overhead/i)).toBeVisible();
    await expect(panel.getByText(/Physical clearance/i)).toBeVisible();

    const metrics = await panel.evaluate((node) => {
      const left = node.querySelector('.build-audit-input-column')?.getBoundingClientRect();
      const right = node.querySelector('.build-audit-options-column')?.getBoundingClientRect();
      const goal = node.querySelector('#build-audit-goal')?.getBoundingClientRect();
      const checklist = node.querySelector('.build-audit-checklist')?.getBoundingClientRect();
      const button = node.querySelector('.build-audit-submit')?.getBoundingClientRect();
      return {
        leftRight: Math.round(left?.right ?? 0),
        rightLeft: Math.round(right?.left ?? 0),
        buttonWidth: Math.round(button?.width ?? 0),
        rightWidth: Math.round(right?.width ?? 0),
        checklistTopGap: Math.round((checklist?.top ?? 0) - (goal?.bottom ?? 0)),
        buttonTopGap: Math.round((button?.top ?? 0) - (checklist?.bottom ?? 0)),
      };
    });

    expect(metrics.rightLeft).toBeGreaterThan(metrics.leftRight);
    expect(metrics.buttonWidth).toBeGreaterThan(metrics.rightWidth * 0.9);
    expect(metrics.checklistTopGap).toBeGreaterThanOrEqual(20);
    expect(metrics.buttonTopGap).toBeGreaterThanOrEqual(20);
  });

  test('build audit card stacks before the desktop sidebar makes columns cramped', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await mockApi(page);
    await page.goto('/audit');

    const panel = page.getByRole('region', { name: /audit a pc build/i });
    await expect(panel.locator('.build-audit-card')).toBeVisible();

    const metrics = await panel.evaluate((node) => {
      const card = node.querySelector('.build-audit-card')?.getBoundingClientRect();
      const left = node.querySelector('.build-audit-input-column')?.getBoundingClientRect();
      const right = node.querySelector('.build-audit-options-column')?.getBoundingClientRect();
      const checklist = node.querySelector('.build-audit-checklist')?.getBoundingClientRect();
      const firstCheck = node.querySelector('.build-audit-checklist li')?.getBoundingClientRect();
      const button = node.querySelector('.build-audit-submit')?.getBoundingClientRect();
      return {
        cardWidth: Math.round(card?.width ?? 0),
        leftTop: Math.round(left?.top ?? 0),
        rightTop: Math.round(right?.top ?? 0),
        rightLeft: Math.round(right?.left ?? 0),
        leftLeft: Math.round(left?.left ?? 0),
        checklistWidth: Math.round(checklist?.width ?? 0),
        firstCheckWidth: Math.round(firstCheck?.width ?? 0),
        buttonWidth: Math.round(button?.width ?? 0),
      };
    });

    expect(metrics.cardWidth).toBeLessThan(860);
    expect(metrics.rightTop).toBeGreaterThan(metrics.leftTop);
    expect(metrics.rightLeft).toBe(metrics.leftLeft);
    expect(metrics.checklistWidth).toBeGreaterThanOrEqual(metrics.cardWidth * 0.82);
    expect(metrics.firstCheckWidth).toBeGreaterThanOrEqual(260);
    expect(metrics.buttonWidth).toBeGreaterThanOrEqual(metrics.checklistWidth * 0.9);
  });

  test('build audit uploads a cart screenshot and renders compatibility findings', async ({ page }) => {
    await mockApi(page);
    let requestBody = '';
    let contentType = '';

    await page.route('**/api/build/audit', async (route) => {
      requestBody = route.request().postData() || '';
      contentType = route.request().headers()['content-type'] || '';
      await route.fulfill({
        json: {
          filename: 'cart.jpg',
          image_meta: { processed_bytes: 150528 },
          audit: {
            status: 'needs_attention',
            summary: 'Good start, but the PSU and missing motherboard need review before buying.',
            detected_parts: [
              {
                slot: 'cpu',
                slot_label: 'Processor / CPU',
                name: 'Ryzen 5 5600',
                confidence: 0.9,
                source: 'text',
                extracted_specs: { socket: 'AM4' },
              },
              {
                slot: 'gpu',
                slot_label: 'VGA / GPU',
                name: 'ASUS GeForce RTX 3060 12GB',
                confidence: 0.82,
                source: 'image',
                extracted_specs: { vram_gb: 12, recommended_psu_w: 550 },
              },
            ],
            compatibility_issues: [
              {
                severity: 'warning',
                title: 'PSU headroom is uncertain',
                message: 'A 450W PSU may be too tight for this GPU.',
                slots: ['psu', 'gpu'],
                recommendation: 'Use at least a quality 550W PSU.',
              },
            ],
            missing_slots: ['motherboard', 'ram', 'case'],
            budget_notes: ['Budget target: 1080p gaming under 12 juta.'],
            suggested_next_steps: ['Confirm the motherboard model before buying.'],
          },
        },
      });
    });

    await page.goto('/audit');
    const panel = page.getByRole('region', { name: /audit a pc build/i });
    await panel.getByLabel(/build goal/i).selectOption('1080p Gaming');
    await panel.getByLabel(/parts list/i).fill('CPU: Ryzen 5 5600\nGPU: RTX 3060 12GB\nPSU: 450W Bronze');
    await panel.getByLabel(/cart screenshot/i).setInputFiles({
      name: 'cart.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });
    await panel.getByRole('button', { name: /audit build/i }).click();

    await expect(panel.getByText(/needs attention/i)).toBeVisible();
    await expect(panel.getByText(/Good start/i)).toBeVisible();
    await expect(panel.getByText(/Processor \/ CPU/i)).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Ryzen 5 5600/i })).toBeVisible();
    await expect(panel.getByText(/ASUS GeForce RTX 3060 12GB/i)).toBeVisible();
    await expect(panel.getByText(/PSU headroom is uncertain/i)).toBeVisible();
    await expect(panel.getByText(/motherboard/i).first()).toBeVisible();
    await expect(panel.getByText(/Confirm the motherboard model/i)).toBeVisible();
    expect(contentType).toContain('multipart/form-data');
    expect(requestBody).toContain('1080p Gaming');
    expect(requestBody).toContain('Ryzen 5 5600');
    expect(requestBody).toContain('cart.jpg');
  });

  test('build audit can fill detected owned parts into the upgrade form', async ({ page }) => {
    await mockApi(page);
    let upgradePayload = null;

    await page.route('**/api/build/audit', async (route) => {
      await route.fulfill({
        json: {
          filename: 'cart.jpg',
          image_meta: { processed_bytes: 150528 },
          audit: {
            status: 'needs_attention',
            summary: 'Detected several owned parts from the cart screenshot.',
            detected_parts: [
              {
                slot: 'gpu',
                slot_label: 'VGA / GPU',
                name: 'ASUS GeForce RTX 3060 12GB',
                confidence: 0.82,
                source: 'image',
                extracted_specs: { vram_gb: 12, recommended_psu_w: 550 },
              },
              {
                slot: 'cpu_cooler',
                slot_label: 'CPU Cooler',
                name: 'DeepCool AK400 tower cooler',
                confidence: 0.78,
                source: 'text',
                extracted_specs: { tdp_w: 180, fan_size_mm: 120 },
              },
            ],
            compatibility_issues: [],
            missing_slots: ['motherboard'],
            budget_notes: [],
            suggested_next_steps: [],
          },
        },
      });
    });

    await page.route('**/api/build/upgrade', async (route) => {
      upgradePayload = route.request().postDataJSON();
      await route.fallback();
    });

    await page.goto('/audit');
    const panel = page.getByRole('region', { name: /audit a pc build/i });
    await panel.getByLabel(/build goal/i).selectOption('General Gaming');
    await panel.getByLabel(/parts list/i).fill('GPU: RTX 3060 12GB\nCPU Cooler: DeepCool AK400');
    await panel.getByLabel(/cart screenshot/i).setInputFiles({
      name: 'cart.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });
    await panel.getByRole('button', { name: /audit build/i }).click();

    await panel.getByRole('button', { name: /apply detected parts/i }).click();

    await expect(page).toHaveURL(/\/upgrade$/);
    await expect(page.getByRole('region', { name: /audit a pc build/i })).toHaveCount(0);
    await expect(page.getByLabel(/^gpu$/i)).toHaveValue('ASUS GeForce RTX 3060 12GB');
    await expect(page.getByLabel(/^cpu cooler$/i)).toHaveValue('DeepCool AK400 tower cooler');

    await page.getByRole('button', { name: /recommend upgrade/i }).click();
    expect(upgradePayload.existing_components.gpu).toBe('ASUS GeForce RTX 3060 12GB');
    expect(upgradePayload.existing_components.cpu_cooler).toBe('DeepCool AK400 tower cooler');
  });

  test('swap dialog uses compatible alternatives from the build context', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const motherboardCard = page.locator('.part-card').filter({ hasText: 'Motherboard' });
    await motherboardCard.getByRole('button', { name: /swap/i }).click();

    const dialog = page.getByRole('dialog', { name: /swap motherboard/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Compatible alternatives', { exact: true })).toBeVisible();
    await expect(page.getByText(/B650M WiFi Plus Motherboard/i)).toBeVisible();
    await expect(page.getByText(/Matches current CPU socket AM5/i)).toBeVisible();
    await expect(page.getByText(/B660M DDR4 Motherboard/i)).toHaveCount(0);
  });

  test('swap candidate cards expose specs, stock, marketplace, and projected budget context', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const motherboardCard = page.locator('.part-card').filter({ hasText: 'Motherboard' });
    await motherboardCard.getByRole('button', { name: /swap/i }).click();

    const dialog = page.getByRole('dialog', { name: /swap motherboard/i });
    await expect(dialog).toBeVisible();
    const candidate = dialog.locator('.part-card').filter({ hasText: 'B650M WiFi Plus Motherboard' });
    await expect(candidate).toBeVisible();
    await expect(candidate.getByText(/In stock/i)).toBeVisible();
    await expect(candidate.getByText('Socket', { exact: true })).toBeVisible();
    await expect(candidate.getByText('AM5', { exact: true }).first()).toBeVisible();
    await expect(candidate.getByText('Form factor', { exact: true })).toBeVisible();
    await expect(candidate.getByText('mATX', { exact: true })).toBeVisible();
    await expect(candidate.getByText('Memory type', { exact: true })).toBeVisible();
    await expect(candidate.getByText('DDR5', { exact: true }).first()).toBeVisible();
    await expect(candidate.getByText(/Projected total/i)).toBeVisible();
    await expect(candidate.getByText(/Rp\s?19\.680\.000/i)).toBeVisible();
    await expect(candidate.getByText(/Remaining/i)).toBeVisible();
    await expect(candidate.getByText(/Rp\s?320\.000/i)).toBeVisible();
    await expect(candidate.getByRole('link', { name: /view at enterkomputer/i })).toHaveAttribute(
      'href',
      /enterkomputer\.com\/detail\/b650m-plus/
    );
  });

  test('swap dialog shows a recoverable error state when candidates cannot load', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/build/swap-candidates', async (route) => {
      await route.fulfill({
        status: 500,
        json: { detail: 'Swap candidates unavailable' },
      });
    });
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const motherboardCard = page.locator('.part-card').filter({ hasText: 'Motherboard' });
    await motherboardCard.getByRole('button', { name: /swap/i }).click();

    const dialog = page.getByRole('dialog', { name: /swap motherboard/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Could not load compatible alternatives/i)).toBeVisible();
    await expect(dialog.getByText(/Swap candidates unavailable/i)).toBeVisible();
  });

  test('swap dialog candidate cards stay readable inside desktop modal width', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();

    const motherboardCard = page.locator('.part-card').filter({ hasText: 'Motherboard' });
    await motherboardCard.getByRole('button', { name: /swap/i }).click();

    const dialog = page.getByRole('dialog', { name: /swap motherboard/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Compatible alternatives', { exact: true })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const dialogBody = document.querySelector('.dialog-body');
      const candidate = document.querySelector('.dialog .part-card');
      const dialogRect = dialogBody?.getBoundingClientRect();
      const candidateRect = candidate?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const badElements = [];

      for (const el of document.querySelectorAll('.dialog, .dialog-body, .dialog .part-card, .dialog .part-card-body, .dialog .part-card-right')) {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewportWidth + 1 || rect.left < -1) {
          badElements.push({
            className: String(el.className || ''),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      }

      return {
        dialogWidth: Math.round(dialogRect?.width ?? 0),
        candidateWidth: Math.round(candidateRect?.width ?? 0),
        badElements,
      };
    });

    expect(metrics.badElements).toEqual([]);
    expect(metrics.candidateWidth / metrics.dialogWidth).toBeGreaterThanOrEqual(0.9);
  });

  test('landing cards keep labels and descriptions visually separated', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 768 });
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('.build-mode-card')).toHaveCount(2);

    const metrics = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.build-mode-card')).map((card) => {
        const title = card.querySelector('strong')?.getBoundingClientRect();
        const body = card.querySelector('small')?.getBoundingClientRect();
        const style = window.getComputedStyle(card);
        return {
          background: style.backgroundColor,
          titleBottom: Math.round(title?.bottom ?? 0),
          bodyTop: Math.round(body?.top ?? 0),
        };
      });
    });

    expect(metrics.length).toBe(2);
    for (const card of metrics) {
      expect(card.bodyTop).toBeGreaterThan(card.titleBottom);
      expect(card.background).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('landing recommendation cards use wide desktop space', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('.tier-card')).toHaveCount(4);
    await expect(page.getByText('Budget gaming')).toHaveCount(0);
    await expect(page.getByText('Enthusiast')).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const main = document.querySelector('.app-main');
      const mainRect = main?.getBoundingClientRect();
      const mainStyle = main ? window.getComputedStyle(main) : null;
      const mainContentWidth = mainRect && mainStyle
        ? mainRect.width - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight)
        : 0;
      const mainContentRight = mainRect && mainStyle
        ? mainRect.right - parseFloat(mainStyle.paddingRight)
        : 0;
      const modeGrid = document.querySelector('.build-mode-grid')?.getBoundingClientRect();
      const tierGrid = document.querySelector('.tier-grid')?.getBoundingClientRect();
      const tierCards = Array.from(document.querySelectorAll('.tier-card'))
        .map((card) => card.getBoundingClientRect());
      const firstTop = tierCards[0]?.top ?? 0;
      const firstRowCount = tierCards.filter((rect) => Math.abs(rect.top - firstTop) < 2).length;
      const widestTier = Math.max(...tierCards.map((rect) => rect.width));
      const narrowestTier = Math.min(...tierCards.map((rect) => rect.width));
      return {
        mainContentWidth,
        modeGridWidth: modeGrid?.width ?? 0,
        tierGridWidth: tierGrid?.width ?? 0,
        modeRightGap: modeGrid ? Math.round(mainContentRight - modeGrid.right) : 0,
        tierRightGap: tierGrid ? Math.round(mainContentRight - tierGrid.right) : 0,
        firstRowCount,
        widestTier,
        narrowestTier,
      };
    });

    expect(metrics.modeGridWidth / metrics.mainContentWidth).toBeGreaterThanOrEqual(0.92);
    expect(metrics.tierGridWidth / metrics.mainContentWidth).toBeGreaterThanOrEqual(0.92);
    expect(metrics.modeRightGap).toBeLessThanOrEqual(4);
    expect(metrics.tierRightGap).toBeLessThanOrEqual(4);
    expect(metrics.firstRowCount).toBeGreaterThanOrEqual(4);
    expect(metrics.widestTier).toBeGreaterThanOrEqual(300);
    expect(metrics.narrowestTier).toBeGreaterThanOrEqual(300);
  });

  test('landing mode cards have enough visual weight on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('.build-mode-card')).toHaveCount(2);

    const metrics = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.build-mode-card')).map((card) => {
        const rect = card.getBoundingClientRect();
        const icon = card.querySelector('.material-symbols-outlined')?.getBoundingClientRect();
        const title = card.querySelector('strong')?.getBoundingClientRect();
        const body = card.querySelector('small')?.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          iconWidth: Math.round(icon?.width ?? 0),
          iconHeight: Math.round(icon?.height ?? 0),
          titleLeftGap: Math.round((title?.left ?? 0) - (icon?.right ?? 0)),
          bodyTopGap: Math.round((body?.top ?? 0) - (title?.bottom ?? 0)),
        };
      });
    });

    expect(metrics.length).toBe(2);
    for (const card of metrics) {
      expect(card.height).toBeGreaterThanOrEqual(112);
      expect(card.iconWidth).toBeGreaterThanOrEqual(40);
      expect(card.iconHeight).toBeGreaterThanOrEqual(40);
      expect(card.titleLeftGap).toBeGreaterThanOrEqual(16);
      expect(card.bodyTopGap).toBeGreaterThanOrEqual(6);
    }
  });

  test('landing mode cards expose clear action labels', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await page.goto('/');

    await expect(page.locator('.mode-card-kicker')).toHaveCount(2);
    await expect(page.locator('.mode-card-kicker', { hasText: 'Full tower' })).toBeVisible();
    await expect(page.locator('.mode-card-kicker', { hasText: 'Existing PC' })).toBeVisible();
    await expect(page.getByText('Start a new build')).toBeVisible();
    await expect(page.getByText('Plan an upgrade')).toBeVisible();
  });

  test('landing budget tier cards expose decision metadata', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockApi(page);
    await page.goto('/');

    await expect(page.locator('.tier-card')).toHaveCount(4);
    await expect(page.locator('.tier-card-header')).toHaveCount(4);
    await expect(page.locator('.tier-meta')).toHaveCount(4);
    await expect(page.getByText('Rp 7.000.000 - Rp 12.000.000')).toBeVisible();
    await expect(page.getByText('Rp 12.000.000 - Rp 22.000.000')).toBeVisible();
    await expect(page.getByText('Rp 22.000.000 - Rp 40.000.000')).toBeVisible();
    await expect(page.getByText('♾️')).toBeVisible();
    await expect(page.getByText('1080p ultra / 1440p entry')).toBeVisible();
    await expect(page.getByText('Use this budget').first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.tier-card')).map((card) => {
        const rect = card.getBoundingClientRect();
        const target = card.querySelector('.tier-target')?.getBoundingClientRect();
        const meta = card.querySelector('.tier-meta')?.getBoundingClientRect();
        const action = card.querySelector('.tier-card-action')?.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          targetBottom: Math.round(target?.bottom ?? 0),
          metaTop: Math.round(meta?.top ?? 0),
          actionBottom: Math.round(action?.bottom ?? 0),
          cardBottom: Math.round(rect.bottom),
        };
      });
    });

    for (const card of metrics) {
      expect(card.height).toBeGreaterThanOrEqual(190);
      expect(card.metaTop).toBeGreaterThan(card.targetBottom);
      expect(card.cardBottom - card.actionBottom).toBeGreaterThanOrEqual(18);
    }
  });

  test('editorial redesign keeps the title font while using the warm dark palette', async ({ page }) => {
    await mockApi(page);
    await seedStorage(page, { 'kompare:theme': 'dark' });
    await page.goto('/');
    await expect(page.locator('.pc-builder-hero h1')).toBeVisible();

    const theme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const title = getComputedStyle(document.querySelector('.pc-builder-hero h1'));
      return {
        serif: root.getPropertyValue('--font-serif'),
        bgToken: root.getPropertyValue('--bg').trim(),
        surfaceToken: root.getPropertyValue('--surface').trim(),
        accentToken: root.getPropertyValue('--accent').trim(),
        bodyBg: body.backgroundColor,
        titleFont: title.fontFamily,
      };
    });

    expect(theme.serif).toContain('Fraunces');
    expect(theme.titleFont).toContain('Fraunces');
    expect(theme.bgToken).toBe('#141312');
    expect(theme.surfaceToken).toBe('#201f1e');
    expect(theme.accentToken).toBe('#d97757');
    expect(theme.bodyBg).toBe('rgb(20, 19, 18)');
  });

  test('upgrade planner uses the sectioned editorial intake layout', async ({ page }) => {
    await mockApi(page);
    await seedStorage(page, { 'kompare:theme': 'dark' });
    await page.goto('/upgrade');

    await expect(page.getByRole('heading', { name: 'Upgrade Goals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is currently in your PC?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anything else we should consider?' })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const form = document.querySelector('.upgrade-form');
      const sections = Array.from(document.querySelectorAll('.upgrade-form-section'));
      const rect = form?.getBoundingClientRect();
      return {
        hasPanel: form?.classList.contains('editorial-form-panel') ?? false,
        sectionCount: sections.length,
        width: Math.round(rect?.width ?? 0),
      };
    });

    expect(metrics.hasPanel).toBe(true);
    expect(metrics.sectionCount).toBeGreaterThanOrEqual(3);
    expect(metrics.width).toBeGreaterThanOrEqual(760);
  });

  test('build dashboard uses editorial media cards with sticky summary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockApi(page);
    await seedStorage(page, { 'kompare:theme': 'dark' });
    await page.goto('/builder');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('.part-card')).toHaveCount(10);

    const metrics = await page.evaluate(() => {
      const result = document.querySelector('.builder-result-grid')?.getBoundingClientRect();
      const card = document.querySelector('.part-card')?.getBoundingClientRect();
      const thumb = document.querySelector('.part-card-thumb')?.getBoundingClientRect();
      const summary = document.querySelector('.build-summary')?.getBoundingClientRect();
      const summaryStyle = getComputedStyle(document.querySelector('.build-summary'));
      return {
        resultWidth: Math.round(result?.width ?? 0),
        cardWidth: Math.round(card?.width ?? 0),
        thumbWidth: Math.round(thumb?.width ?? 0),
        thumbHeight: Math.round(thumb?.height ?? 0),
        summaryLeft: Math.round(summary?.left ?? 0),
        cardRight: Math.round(card?.right ?? 0),
        summaryPosition: summaryStyle.position,
      };
    });

    expect(metrics.resultWidth).toBeGreaterThanOrEqual(980);
    expect(metrics.thumbWidth).toBeGreaterThanOrEqual(88);
    expect(metrics.thumbHeight).toBeGreaterThanOrEqual(88);
    expect(metrics.summaryLeft).toBeGreaterThan(metrics.cardRight);
    expect(metrics.summaryPosition).toBe('sticky');
    expect(metrics.cardWidth).toBeGreaterThanOrEqual(620);
  });

  test('unselected builder cards use the page background surface', async ({ page }) => {
    await mockApi(page);
    await seedStorage(page, { 'kompare:theme': 'dark' });
    await page.goto('/');
    await expect(page.locator('.build-mode-card')).toHaveCount(2);
    await expect(page.locator('.tier-card')).toHaveCount(4);

    const landingColors = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const modeCard = getComputedStyle(document.querySelector('.build-mode-card')).backgroundColor;
      const unselectedTierNode = Array.from(document.querySelectorAll('.tier-card'))
        .find((card) => !card.classList.contains('selected'));
      const unselectedTier = getComputedStyle(unselectedTierNode).backgroundColor;
      return { bodyBg, modeCard, unselectedTier };
    });

    expect(landingColors.modeCard).toBe(landingColors.bodyBg);
    expect(landingColors.unselectedTier).toBe(landingColors.bodyBg);

    await page.goto('/builder');
    await expect(page.locator('.budget-form')).toBeVisible();
    const builderColors = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const form = getComputedStyle(document.querySelector('.budget-form')).backgroundColor;
      return { bodyBg, form };
    });

    expect(builderColors.form).toBe(builderColors.bodyBg);

    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('.part-card')).toHaveCount(10);
    const resultColors = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const partCard = getComputedStyle(document.querySelector('.part-card')).backgroundColor;
      const summary = getComputedStyle(document.querySelector('.build-summary')).backgroundColor;
      return { bodyBg, partCard, summary };
    });

    expect(resultColors.partCard).toBe(resultColors.bodyBg);
    expect(resultColors.summary).toBe(resultColors.bodyBg);
  });
});

test.describe('desktop density', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('Builder result uses wide desktop space for readable part cards', async ({ page }) => {
    await mockApi(page);
    await page.goto('/builder');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('.part-card')).toHaveCount(10);

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar')?.getBoundingClientRect();
      const main = document.querySelector('.app-main')?.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll('.part-card'))
        .map((el) => el.getBoundingClientRect());
      const cardBodies = Array.from(document.querySelectorAll('.builder-result-grid > .parts-list > .part-card .part-card-body'))
        .map((el) => el.getBoundingClientRect());
      const firstRowTop = cards[0]?.top ?? 0;
      const firstRowCount = cards.filter((rect) => Math.abs(rect.top - firstRowTop) < 2).length;
      return {
        mainWidth: main?.width ?? 0,
        availableWidth: window.innerWidth - (sidebar?.width ?? 0),
        firstRowCount,
        minCardWidth: Math.min(...cards.map((rect) => rect.width)),
        minBodyWidth: Math.min(...cardBodies.map((rect) => rect.width)),
      };
    });

    expect(metrics.mainWidth / metrics.availableWidth).toBeGreaterThanOrEqual(0.84);
    expect(metrics.firstRowCount).toBe(1);
    expect(metrics.minCardWidth).toBeGreaterThanOrEqual(760);
    expect(metrics.minBodyWidth).toBeGreaterThanOrEqual(440);
  });

  test('Upgrade result uses wide desktop space for readable recommendation cards', async ({ page }) => {
    await mockApi(page);
    await page.goto('/upgrade');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/^cpu$/i).fill('Ryzen 5 5600');
    await page.getByLabel(/gpu/i).fill('RTX 3060 12GB');
    await page.getByRole('button', { name: /recommend upgrade/i }).click();
    await expect(page.locator('.upgrade-result')).toBeVisible();
    await expect(page.locator('.part-card')).toHaveCount(10);

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar')?.getBoundingClientRect();
      const main = document.querySelector('.app-main')?.getBoundingClientRect();
      const results = document.querySelector('.upgrade-result')?.getBoundingClientRect();
      const cardBodies = Array.from(document.querySelectorAll('.part-card-body'))
        .map((el) => el.getBoundingClientRect().width);
      return {
        mainWidth: main?.width ?? 0,
        availableWidth: window.innerWidth - (sidebar?.width ?? 0),
        resultsWidth: results?.width ?? 0,
        minBodyWidth: Math.min(...cardBodies),
      };
    });

    expect(metrics.mainWidth / metrics.availableWidth).toBeGreaterThanOrEqual(0.84);
    expect(metrics.resultsWidth).toBeGreaterThanOrEqual(900);
    expect(metrics.minBodyWidth).toBeGreaterThanOrEqual(160);
  });
});

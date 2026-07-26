import { expect, test } from '@playwright/test';

const responsiveViewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

const shellRoutes = ['/app', '/builder', '/upgrade', '/audit'];
const landingRoute = '/';

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    documentElement: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));

  expect(overflow.documentElement).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test('/app opens the Kompare 95 desktop shell', async ({ page }) => {
  await page.goto('/app');

  await expect(page.getByTestId('desktop-shell')).toBeVisible();
  const desktopIcons = page.getByRole('navigation', { name: 'Desktop applications' });
  await expect(desktopIcons.getByRole('button', { name: 'Build PC', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('button', { name: 'Upgrade', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('button', { name: 'Audit', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('button', { name: 'Marketplace', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('button', { name: 'Readme', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'README.TXT' })).toBeVisible();
  const taskbar = page.getByRole('navigation', { name: 'Taskbar' });
  await expect(taskbar).toBeVisible();
  await expect(taskbar.getByRole('button', { name: 'README.TXT' })).toBeVisible();
});

for (const viewport of responsiveViewports) {
  test(`landing has no horizontal overflow at ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(landingRoute);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const route of shellRoutes) {
    test(`${route} has no horizontal overflow at ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);

      await expect(page.getByTestId('desktop-shell')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('desktop application buttons open every preserved product flow', async ({ page }) => {
  await page.goto('/app');
  const desktopIcons = page.getByRole('navigation', { name: 'Desktop applications' });

  await desktopIcons.getByRole('button', { name: 'Build PC', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'BUILD_WIZARD.EXE' })).toBeVisible();

  await desktopIcons.getByRole('button', { name: 'Upgrade', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UPGRADE_PLANNER.EXE' })).toBeVisible();

  await desktopIcons.getByRole('button', { name: 'Audit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'BUILD_AUDIT.EXE' })).toBeVisible();

  const taskbar = page.getByRole('navigation', { name: 'Taskbar' });
  await expect(taskbar.getByRole('button', { name: 'BUILD_WIZARD.EXE' })).toBeVisible();
  await expect(taskbar.getByRole('button', { name: 'UPGRADE_PLANNER.EXE' })).toBeVisible();
  await expect(taskbar.getByRole('button', { name: 'BUILD_AUDIT.EXE' })).toBeVisible();
});

test('landing sells the product and routes into every flow', async ({ page }) => {
  await page.goto('/');

  // The landing is the marketing surface: no desktop chrome here.
  await expect(page.getByTestId('desktop-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Rakit PC tanpa salah beli.' })).toBeVisible();

  for (const [name, path] of [['Rakit dari nol', '/builder'], ['Upgrade PC lama', '/upgrade']]) {
    await expect(page.getByRole('link', { name, exact: true }).first()).toHaveAttribute('href', path);
  }

  await page.getByRole('link', { name: 'Buka desktop Kompare' }).click();
  await expect(page.getByTestId('desktop-shell')).toBeVisible();
});

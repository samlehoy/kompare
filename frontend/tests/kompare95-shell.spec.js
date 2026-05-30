import { expect, test } from '@playwright/test';

async function openWorkflow(page, name) {
  await page.goto('/');
  const workflows = page.getByRole('navigation', { name: 'Kompare workflows' });
  await workflows.getByRole('link', { name }).click();
}

async function expectActiveProgram(page, { url, heading, taskbarName }) {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();

  const taskbar = page.getByRole('navigation', { name: 'Taskbar' });
  const taskbarLink = taskbar.getByRole('link', { name: taskbarName });
  await expect(taskbarLink).toBeVisible();
  await expect(taskbarLink).toHaveAttribute('aria-current', 'page');
}

const responsiveViewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

const shellRoutes = ['/', '/builder', '/upgrade', '/audit'];

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    documentElement: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));

  expect(overflow.documentElement).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test('home opens the Kompare 95 control panel inside the desktop shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('desktop-shell')).toBeVisible();
  const desktopIcons = page.getByRole('navigation', { name: 'Desktop applications' });
  await expect(desktopIcons.getByRole('link', { name: 'Build PC', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('link', { name: 'Upgrade', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('link', { name: 'Audit', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('link', { name: 'Marketplace', exact: true })).toBeVisible();
  await expect(desktopIcons.getByRole('link', { name: 'Help', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KOMPARE_CONTROL_PANEL.EXE' })).toBeVisible();
  const taskbar = page.getByRole('navigation', { name: 'Taskbar' });
  await expect(taskbar).toBeVisible();
  await expect(taskbar.getByRole('link', { name: 'UPGRADE_PLANNER.EXE' })).toBeVisible();
  await expect(taskbar.getByRole('link', { name: 'BUILD_AUDIT.EXE' })).toBeVisible();
});

for (const viewport of responsiveViewports) {
  for (const route of shellRoutes) {
    test(`${route} has no horizontal overflow at ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);

      await expect(page.getByTestId('desktop-shell')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('control panel tiles navigate to every preserved product flow', async ({ page }) => {
  await openWorkflow(page, 'Build from zero');
  await expectActiveProgram(page, {
    url: /\/builder$/,
    heading: 'BUILD_WIZARD.EXE',
    taskbarName: 'BUILD_WIZARD.EXE',
  });

  await openWorkflow(page, 'Upgrade existing PC');
  await expectActiveProgram(page, {
    url: /\/upgrade$/,
    heading: 'UPGRADE_PLANNER.EXE',
    taskbarName: 'UPGRADE_PLANNER.EXE',
  });

  await openWorkflow(page, 'Audit cart or parts list');
  await expectActiveProgram(page, {
    url: /\/audit$/,
    heading: 'BUILD_AUDIT.EXE',
    taskbarName: 'BUILD_AUDIT.EXE',
  });

  await openWorkflow(page, 'Advisor after build');
  await expectActiveProgram(page, {
    url: /\/builder#advisor$/,
    heading: 'BUILD_WIZARD.EXE',
    taskbarName: 'BUILD_WIZARD.EXE',
  });
});

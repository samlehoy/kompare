import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '@/lib/api.js';
import { readAuditUpgradePrefill, writeAuditUpgradePrefill, clearAuditUpgradePrefill } from '@/lib/storage.js';

describe('api client', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
  });

  test('maps build request to the existing FastAPI payload', async () => {
    await api.recommendBuild({
      budgetIdr: 20000000,
      useCase: 'gaming',
      cpuBrand: 'AMD',
      gpuVendor: 'Nvidia',
      includeOptionalAddons: true,
      selectedOptionalAddons: ['hdd', 'ups'],
      budgetStrategy: 'maximize',
      performancePriority: 'gaming',
      allocationOverrides: {
        cpu: 20,
        gpu: 35,
        ram: 10,
        motherboard: 10,
        ssd: 10,
        psu: 8,
        case: 4,
        cpu_cooler: 2,
        fan_cooler: 1,
      },
    });

    expect(fetch).toHaveBeenCalledWith('/api/build/recommend', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        budget_idr: 20000000,
        use_case: 'gaming',
        cpu_brand: 'AMD',
        gpu_vendor: 'Nvidia',
        include_optional_addons: true,
        selected_optional_addons: ['hdd', 'ups'],
        budget_strategy: 'maximize',
        performance_priority: 'gaming',
        allocation_overrides: {
          cpu: 20,
          gpu: 35,
          ram: 10,
          motherboard: 10,
          ssd: 10,
          psu: 8,
          case: 4,
          cpu_cooler: 2,
          fan_cooler: 1,
        },
      }),
    }));
  });

  test('does not send JSON content type for requests without a body', async () => {
    await api.health();

    expect(fetch).toHaveBeenCalledWith('/api/health', expect.not.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));
  });

  test('supports direct backend base URLs for long AI requests', async () => {
    const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8000/';

    try {
      vi.resetModules();
      const { api: directApi } = await import('@/lib/api.js');

      await directApi.health();

      expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/health', expect.any(Object));
    } finally {
      if (originalBase === undefined) {
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
      }
      vi.resetModules();
    }
  });

  test('keeps upload audit requests as FormData', async () => {
    const file = new File(['hello'], 'cart.png', { type: 'image/png' });
    await api.auditBuild({ image: file, goal: 'Gaming', partsList: 'CPU: Ryzen 5 5600' });

    const [, options] = fetch.mock.calls[0];
    expect(fetch.mock.calls[0][0]).toBe('/api/build/audit');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
  });

  test('surfaces JSON detail errors with nested messages', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      detail: {
        message: 'Budget tier is unavailable',
        code: 'budget_unavailable',
      },
    }), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Budget tier is unavailable',
      status: 422,
      detail: {
        message: 'Budget tier is unavailable',
        code: 'budget_unavailable',
      },
    });
  });

  test('surfaces plain-text error bodies after JSON parsing fails', async () => {
    global.fetch = vi.fn(async () => new Response('backend is warming up', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    }));

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'backend is warming up',
      status: 503,
      detail: null,
    });
  });

  test('preserves zero as a swap candidate max price', async () => {
    await api.listSwapCandidates({
      budgetIdr: 20000000,
      useCase: 'gaming',
      slot: 'gpu',
      currentBuild: { cpu: { id: 'cpu-1' } },
      maxPrice: 0,
    });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      max_price: 0,
    }));
  });

  test('maps AI profile selection to the backend build request contract', async () => {
    await api.recommendAiBuild({
      budgetIdr: 20000000,
      useCase: 'gaming',
      aiProfile: 'local_qwen',
    });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      ai_profile: 'local_qwen',
    }));
  });

  test('loads backend-owned allocation preset metadata', async () => {
    await api.listAllocationPresets();

    expect(fetch).toHaveBeenCalledWith('/api/build/allocation-presets', expect.not.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));
  });
});

describe('audit upgrade prefill storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    clearAuditUpgradePrefill();
  });

  test('round-trips audited parts and clears them after read', () => {
    writeAuditUpgradePrefill({ parts: { cpu: 'Ryzen 5 5600' }, count: 1 });
    expect(readAuditUpgradePrefill()).toEqual({ parts: { cpu: 'Ryzen 5 5600' }, count: 1 });
    clearAuditUpgradePrefill();
    expect(readAuditUpgradePrefill()).toBeNull();
  });

  test('defaults prefill parts and count from the provided parts', () => {
    writeAuditUpgradePrefill({ parts: { cpu: 'Ryzen 5 5600', gpu: 'RTX 4060' } });
    expect(readAuditUpgradePrefill()).toEqual({
      parts: { cpu: 'Ryzen 5 5600', gpu: 'RTX 4060' },
      count: 2,
    });
  });

  test('skips writes outside a browser window', () => {
    vi.stubGlobal('window', undefined);
    expect(() => writeAuditUpgradePrefill({ parts: { cpu: 'Ryzen 5 5600' } })).not.toThrow();
  });

  test('uses an internal fallback without replacing broken localStorage at import time', async () => {
    const originalWindowStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const originalGlobalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const brokenStorage = {};

    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: brokenStorage,
      });
      vi.resetModules();

      const storage = await import('@/lib/storage.js');
      storage.writeAuditUpgradePrefill({ parts: { cpu: 'Ryzen 5 5600' } });

      expect(window.localStorage).toBe(brokenStorage);
      expect(storage.readAuditUpgradePrefill()).toEqual({
        parts: { cpu: 'Ryzen 5 5600' },
        count: 1,
      });

      storage.clearAuditUpgradePrefill();
      expect(storage.readAuditUpgradePrefill()).toBeNull();
    } finally {
      if (originalWindowStorage) {
        Object.defineProperty(window, 'localStorage', originalWindowStorage);
      } else {
        delete window.localStorage;
      }
      if (originalGlobalStorage) {
        Object.defineProperty(globalThis, 'localStorage', originalGlobalStorage);
      } else {
        delete globalThis.localStorage;
      }
      vi.resetModules();
    }
  });
});

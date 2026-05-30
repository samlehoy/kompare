import { describe, expect, test } from 'vitest';
import { formatIDR, parseIDR } from '@/lib/format.js';
import { formatSpecValue, slotLabel } from '@/lib/slots.js';

describe('Kompare 95 formatting helpers', () => {
  test('formats Indonesian rupiah with id-ID grouping', () => {
    expect(formatIDR(19480000)).toBe('Rp 19.480.000');
  });

  test('parses common budget text into integer IDR', () => {
    expect(parseIDR('20jt')).toBe(20000000);
    expect(parseIDR('7.500.000')).toBe(7500000);
  });

  test('formats PC spec values with units', () => {
    expect(formatSpecValue('capacity_gb', 1024)).toBe('1024 GB');
    expect(formatSpecValue('wattage_w', 650)).toBe('650W');
  });

  test('returns display labels for known and unknown slots', () => {
    expect(slotLabel('cpu')).toBe('Processor / CPU');
    expect(slotLabel('cpu_cooler')).toBe('CPU Cooler');
    expect(slotLabel('custom_slot')).toBe('custom slot');
    expect(slotLabel()).toBe('');
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import LandingPage from '@/components/landing/LandingPage.jsx';

describe('LandingPage', () => {
  test('states what the product is above the fold', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Build a PC without buying the wrong part.');
  });

  test('offers both primary flows as the first calls to action', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: 'Start from zero' })).toHaveAttribute('href', '/builder');
    expect(screen.getByRole('link', { name: 'Upgrade my PC' })).toHaveAttribute('href', '/upgrade');
  });

  test('routes into every visible product flow, including the desktop', () => {
    render(<LandingPage />);

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const route of ['/builder', '/upgrade', '/audit', '/app']) {
      expect(hrefs).toContain(route);
    }
  });

  test('shows every budget tier with its range', () => {
    render(<LandingPage />);

    const tiers = screen.getByRole('heading', { name: 'Pick a budget class' }).parentElement;
    for (const [label, range] of [
      ['Entry-level', 'Rp 7–12 million'],
      ['Mid-range', 'Rp 12–22 million'],
      ['High-end', 'Rp 22–40 million'],
      ['Custom', 'Any budget ∞'],
    ]) {
      const card = within(tiers).getByText(label).closest('article');
      expect(card).not.toBeNull();
      expect(within(card).getByText(range)).toBeVisible();
    }
  });

  test('does not advertise flows the product deliberately dropped', () => {
    render(<LandingPage />);

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const dropped of ['/browse', '/compare', '/chat', '/identify', '/products']) {
      expect(hrefs).not.toContain(dropped);
    }
  });
});

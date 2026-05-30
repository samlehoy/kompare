import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { RetroButton, RetroInput, RetroSelect, RetroTextarea } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';

describe('retro form controls', () => {
  test('button exposes loading state without losing accessible name', () => {
    render(<RetroButton loading>Generate</RetroButton>);
    expect(screen.getByRole('button', { name: 'Generate' })).toHaveAttribute('aria-busy', 'true');
  });

  test('input, select, and textarea render labels', () => {
    render(
      <>
        <RetroInput label="Budget" name="budget" value="" onChange={() => {}} />
        <RetroSelect label="Use case" name="use-case" value="gaming" onChange={() => {}} options={[{ value: 'gaming', label: 'Gaming' }]} />
        <RetroTextarea label="Notes" name="notes" value="" onChange={() => {}} />
      </>
    );
    expect(screen.getByLabelText('Budget')).toBeVisible();
    expect(screen.getByLabelText('Use case')).toBeVisible();
    expect(screen.getByLabelText('Notes')).toBeVisible();
  });

  test('duplicate control names still get unique label targets', () => {
    render(
      <>
        <RetroInput label="Primary budget" name="budget" value="" onChange={() => {}} />
        <RetroInput label="Comparison budget" name="budget" value="" onChange={() => {}} />
      </>
    );

    const primary = screen.getByLabelText('Primary budget');
    const comparison = screen.getByLabelText('Comparison budget');

    expect(primary).toHaveAttribute('name', 'budget');
    expect(comparison).toHaveAttribute('name', 'budget');
    expect(primary).not.toHaveAttribute('id', 'budget');
    expect(comparison).not.toHaveAttribute('id', 'budget');
    expect(primary.id).not.toBe(comparison.id);
  });

  test('button click remains interactive when enabled', async () => {
    const onClick = vi.fn();
    render(<RetroButton onClick={onClick}>Start</RetroButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('status panel', () => {
  test('renders processing state with role status', () => {
    render(<StatusPanel tone="processing" title="PROCESSING..." message="Generating build." />);
    expect(screen.getByRole('status')).toHaveTextContent('PROCESSING...');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  test('maps tones to the appropriate live region priority', () => {
    const { rerender, container } = render(<StatusPanel tone="success" title="Saved" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    rerender(<StatusPanel tone="warning" title="Check parts" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

    rerender(<StatusPanel tone="error" title="Build failed" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

    rerender(<StatusPanel tone="idle" title="Ready" />);
    const idlePanel = container.querySelector('.retro-status-panel');
    expect(idlePanel).not.toHaveAttribute('role');
    expect(idlePanel).not.toHaveAttribute('aria-live');
  });

  test('spreads section props and lets callers override live region defaults', () => {
    render(
      <>
        <p id="status-help">Shown after the build completes.</p>
        <StatusPanel
          aria-describedby="status-help"
          aria-live="assertive"
          data-testid="completion-status"
          id="completion-panel"
          role="alert"
          tone="success"
          title="Complete"
        />
      </>
    );

    const panel = screen.getByTestId('completion-status');
    expect(panel).toHaveAttribute('id', 'completion-panel');
    expect(panel).toHaveAttribute('aria-describedby', 'status-help');
    expect(panel).toHaveAttribute('role', 'alert');
    expect(panel).toHaveAttribute('aria-live', 'assertive');
  });
});

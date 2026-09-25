import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/types/fitness';

vi.mock('@/app/actions', () => ({ updateTargets: vi.fn(async () => ({ ok: false })) }));

import { EditTargets } from './EditTargets';

const member: Member = {
  id: 'm1',
  name: 'Dillon',
  accent: 'blue',
  sortOrder: 0,
  targets: {
    calories: 2500,
    protein: 156,
    carbs: 313,
    fat: 69,
    steps: 10000,
    stepsMin: 8000,
    waterMl: 2500,
    workoutsPerWeek: 4,
  },
};

const setup = () => render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);
const hidden = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);

describe('EditTargets', () => {
  it('starts in grams with the current targets', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Grams' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Protein in grams')).toHaveValue(156);
    expect(screen.getByLabelText('Carbs in grams')).toHaveValue(313);
  });

  it('derives calories from the grams, not from a stored figure', () => {
    setup();

    // 156*4 + 313*4 + 69*9 = 2,497 — the honest total, not the billed 2,500.
    expect(screen.getByLabelText('Calories from the grams below')).toHaveTextContent('2,497 kcal');
  });

  it('recalculates calories live when a gram figure changes', async () => {
    const user = userEvent.setup();
    setup();

    const protein = screen.getByLabelText('Protein in grams');
    await user.clear(protein);
    await user.type(protein, '200');

    // 200*4 + 313*4 + 69*9 = 2,673.
    expect(screen.getByLabelText('Calories from the grams below')).toHaveTextContent('2,673 kcal');
  });

  it('shows the percentage each macro represents while editing grams', () => {
    setup();

    // Protein and fat are both 25% of the playbook split, carbs 50%.
    expect(screen.getAllByText('25%')).toHaveLength(2);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('lets calories be edited directly in percent mode', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Percent' }));

    expect(screen.getByLabelText(/Calories/)).toHaveValue(2497);
  });

  it('raises every gram figure when calories rise at a fixed split', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    await user.click(screen.getByRole('button', { name: 'Percent' }));

    const before = Number(hidden(container, 'protein')?.value);

    const calories = screen.getByLabelText(/Calories/);
    await user.clear(calories);
    await user.type(calories, '3000');

    expect(Number(hidden(container, 'protein')?.value)).toBeGreaterThan(before);
    expect(Number(hidden(container, 'calories')?.value)).toBe(3000);
  });

  it('blocks saving when the split does not add up to 100', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Percent' }));

    const protein = screen.getByLabelText('Protein as a percentage');
    await user.clear(protein);
    await user.type(protein, '60');

    expect(screen.getByText(/it needs to be 100%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save targets' })).toBeDisabled();
  });

  it('carries the numbers across when switching mode', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    const protein = screen.getByLabelText('Protein in grams');
    await user.clear(protein);
    await user.type(protein, '200');

    await user.click(screen.getByRole('button', { name: 'Percent' }));
    await user.click(screen.getByRole('button', { name: 'Grams' }));

    expect(Number(hidden(container, 'protein')?.value)).toBeCloseTo(200, -1);
  });

  it('submits grams and calories whichever way they were entered', () => {
    const { container } = setup();

    expect(hidden(container, 'calories')).toHaveValue('2497');
    expect(hidden(container, 'protein')).toHaveValue('156');
    expect(hidden(container, 'memberId')).toHaveValue('m1');
  });

  it('sends no steps or water fields, leaving those targets alone', () => {
    const { container } = setup();

    for (const name of ['steps', 'stepsMin', 'waterMl']) {
      expect(hidden(container, name)).toBeNull();
    }
  });

  it('can be dismissed without saving', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<EditTargets member={member} id="t" onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSaved).toHaveBeenCalled();
  });
});

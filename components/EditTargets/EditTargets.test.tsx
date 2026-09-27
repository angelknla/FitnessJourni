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
  it('shows a decimal sleep target in sleep-only mode', () => {
    render(
      <EditTargets
        member={{ ...member, targets: { ...member.targets, sleepHours: 7.5 } }}
        id="sleep-target"
        section="sleep"
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole('spinbutton', { name: 'Hours per night' })).toHaveValue(7.5);
    expect(screen.getByRole('spinbutton', { name: 'Hours per night' })).toHaveAttribute(
      'step',
      '0.25'
    );
    expect(screen.getByRole('button', { name: 'Save sleep target' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grams' })).not.toBeInTheDocument();
  });

  it('starts in grams with the current targets', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Grams' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Protein in grams')).toHaveValue(156);
    expect(screen.getByLabelText('Carbs in grams')).toHaveValue(313);
  });

  it('shows the stored calorie target, editable from the start', () => {
    setup();

    expect(screen.getByLabelText(/Calories/)).toHaveValue(2500);
  });

  it('accepts a calorie figure that is not a round number', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    const calories = screen.getByLabelText(/Calories/);
    await user.clear(calories);
    await user.type(calories, '2543');

    // A coarse step made the browser refuse anything between its multiples.
    expect(calories).toBeValid();
    expect(hidden(container, 'calories')).toHaveValue('2543');
  });

  it('moves calories when a gram figure changes', async () => {
    const user = userEvent.setup();
    setup();

    const protein = screen.getByLabelText('Protein in grams');
    await user.clear(protein);
    await user.type(protein, '200');

    // 200*4 + 313*4 + 69*9 = 2,673.
    expect(screen.getByLabelText(/Calories/)).toHaveValue(2673);
  });

  it('keeps gram inputs blank while replacing a value', async () => {
    const user = userEvent.setup();
    setup();

    const protein = screen.getByLabelText('Protein in grams');
    await user.clear(protein);
    expect(protein).toHaveValue(null);

    await user.type(protein, '40');
    expect(protein).toHaveValue(40);
  });

  it('rescales the grams when calories are typed in grams mode', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    const before = Number(hidden(container, 'protein')?.value);

    const calories = screen.getByLabelText(/Calories/);
    await user.clear(calories);
    await user.type(calories, '3000');

    const after = Number(hidden(container, 'protein')?.value);

    expect(after).toBeGreaterThan(before);
    expect(Number(hidden(container, 'calories')?.value)).toBe(3000);
  });

  it('keeps the split when calories are rescaled', async () => {
    const user = userEvent.setup();
    setup();

    const calories = screen.getByLabelText(/Calories/);
    await user.clear(calories);
    await user.type(calories, '3000');

    // Still a 25/50/25 split, just bigger numbers.
    expect(screen.getAllByText('25%')).toHaveLength(2);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('surfaces the rounding gap rather than hiding it', async () => {
    const user = userEvent.setup();
    setup();

    const calories = screen.getByLabelText(/Calories/);
    await user.clear(calories);
    await user.type(calories, '3000');

    expect(screen.getByText(/from rounding to whole grams/)).toBeInTheDocument();
  });

  it('shows the percentage each macro represents while editing grams', () => {
    setup();

    // Protein and fat are both 25% of the playbook split, carbs 50%.
    expect(screen.getAllByText('25%')).toHaveLength(2);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('keeps the calorie figure unchanged when switching to percent mode', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Percent' }));

    expect(screen.getByLabelText(/Calories/)).toHaveValue(2500);
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

  it('keeps percentage inputs blank while replacing a value', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Percent' }));

    const protein = screen.getByLabelText('Protein as a percentage');
    await user.clear(protein);
    expect(protein).toHaveValue(null);

    await user.type(protein, '40');
    expect(protein).toHaveValue(40);
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

    expect(hidden(container, 'calories')).toHaveValue('2500');
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

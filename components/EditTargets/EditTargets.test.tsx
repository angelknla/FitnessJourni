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

describe('EditTargets', () => {
  it('prefills the current targets', () => {
    render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Protein (g)')).toHaveValue(156);
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(313);
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(69);
  });

  it('names whose targets these are', () => {
    render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    expect(screen.getByText("Dillon's macro targets")).toBeInTheDocument();
  });

  it('shows the calories the macros add up to', () => {
    render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    // 156*4 + 313*4 + 69*9 = 2,497 — within 100 of the 2,500 target.
    expect(screen.getByText(/2,497 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/in line with the 2,500 kcal target/)).toBeInTheDocument();
  });

  it('recalculates live and warns when the macros drift from the calorie target', async () => {
    const user = userEvent.setup();
    render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    const protein = screen.getByLabelText('Protein (g)');
    await user.clear(protein);
    await user.type(protein, '300');

    // 300*4 + 313*4 + 69*9 = 3,073 — 573 over.
    expect(screen.getByText(/3,073 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/573 over the 2,500 kcal target/)).toBeInTheDocument();
  });

  it('carries the member id so the write cannot hit the wrong person', () => {
    const { container } = render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    expect(container.querySelector('input[name="memberId"]')).toHaveValue('m1');
  });

  it('sends no steps, water or calorie fields, so those targets are left alone', () => {
    const { container } = render(<EditTargets member={member} id="t" onSaved={vi.fn()} />);

    for (const name of ['steps', 'stepsMin', 'waterMl', 'calories']) {
      expect(container.querySelector(`[name="${name}"]`)).toBeNull();
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

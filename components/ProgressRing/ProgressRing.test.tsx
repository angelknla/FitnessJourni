import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRing } from './ProgressRing';

describe('ProgressRing', () => {
  it('exposes value, target and percentage to assistive tech', () => {
    render(
      <ProgressRing
        label="Steps"
        display="5,000"
        targetDisplay="10,000"
        value={5000}
        target={10000}
      />
    );

    expect(
      screen.getByRole('img', { name: /Steps: 5,000 of 10,000 target, 50 percent/ })
    ).toBeInTheDocument();
  });

  it('shows the value and target as visible text', () => {
    render(
      <ProgressRing
        label="Water"
        display="2.0 L"
        targetDisplay="2.5 L"
        value={2000}
        target={2500}
      />
    );

    expect(screen.getByText('2.0 L')).toBeInTheDocument();
    expect(screen.getByText('of 2.5 L')).toBeInTheDocument();
    expect(screen.getByText('Water')).toBeInTheDocument();
  });

  it('shows a target adjustment separately while calculating against the total', () => {
    render(
      <ProgressRing
        label="Calories"
        display="2,400"
        targetDisplay="2,500"
        targetAdjustmentDisplay="360"
        value={2400}
        target={2860}
        overIsBad
      />
    );

    expect(screen.getByText('of 2,500')).toBeInTheDocument();
    expect(screen.getByText('+ 360')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Calories: 2,400 of 2,500 target plus 360 burned, 84 percent',
      })
    ).toBeInTheDocument();
  });

  it('marks a budget overshoot as over, so severity can change colour', () => {
    const { container } = render(
      <ProgressRing
        label="Calories"
        display="3,000"
        targetDisplay="2,500"
        value={3000}
        target={2500}
        overIsBad
      />
    );

    expect(container.firstElementChild).toHaveAttribute('data-state', 'over');
  });

  it('treats beating a goal as complete rather than a problem', () => {
    const { container } = render(
      <ProgressRing
        label="Steps"
        display="12,000"
        targetDisplay="10,000"
        value={12000}
        target={10000}
      />
    );

    expect(container.firstElementChild).toHaveAttribute('data-state', 'complete');
  });

  it('draws the floor tick only when a floor is given', () => {
    const { container: withFloor } = render(
      <ProgressRing
        label="Steps"
        display="0"
        targetDisplay="10,000"
        value={0}
        target={10000}
        floor={8000}
      />
    );
    expect(withFloor.querySelector('line')).not.toBeNull();

    const { container: without } = render(
      <ProgressRing label="Water" display="0" targetDisplay="2.5 L" value={0} target={2500} />
    );
    expect(without.querySelector('line')).toBeNull();
  });
});

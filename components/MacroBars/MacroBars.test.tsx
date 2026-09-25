import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroBars } from './MacroBars';

const rows = [
  { label: 'Protein', value: 150, target: 156 },
  { label: 'Carbs', value: 300, target: 313 },
  { label: 'Fat', value: 65, target: 69 },
];

describe('MacroBars', () => {
  it('renders one row per macro', () => {
    render(<MacroBars rows={rows} />);

    expect(screen.getByText('Protein')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('Fat')).toBeInTheDocument();
  });

  it('shows value and target as numbers, not just a bar', () => {
    render(<MacroBars rows={rows} />);

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('/156 g')).toBeInTheDocument();
  });

  it('describes each bar for screen readers', () => {
    render(<MacroBars rows={[{ label: 'Protein', value: 78, target: 156 }]} />);

    expect(screen.getByText(/Protein: 78 of 156 grams, 50 percent/)).toBeInTheDocument();
  });

  it('handles a zero target without dividing by zero', () => {
    render(<MacroBars rows={[{ label: 'Fat', value: 10, target: 0 }]} />);

    expect(screen.getByText(/Fat: 10 of 0 grams, 0 percent/)).toBeInTheDocument();
  });
});

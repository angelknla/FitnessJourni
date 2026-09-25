import { describe, expect, it } from 'vitest';
import { fillPercent, formatCount, formatMl, percentOfTarget } from './progress';

describe('percentOfTarget', () => {
  it('computes a straightforward percentage', () => {
    expect(percentOfTarget(1250, 2500)).toBe(50);
  });

  it('reports overshoot rather than hiding it', () => {
    expect(percentOfTarget(3000, 2500)).toBe(120);
  });

  it('returns 0 for a zero target instead of dividing by zero', () => {
    expect(percentOfTarget(100, 0)).toBe(0);
  });

  it('returns 0 for a negative target', () => {
    expect(percentOfTarget(100, -10)).toBe(0);
  });

  it('never returns a negative percentage', () => {
    expect(percentOfTarget(-500, 2500)).toBe(0);
  });

  it('survives NaN input', () => {
    expect(percentOfTarget(Number.NaN, 2500)).toBe(0);
    expect(percentOfTarget(100, Number.NaN)).toBe(0);
  });
});

describe('fillPercent', () => {
  it('matches percentOfTarget below the target', () => {
    expect(fillPercent(2000, 2500)).toBe(80);
  });

  it('caps at 100 so a bar cannot overflow its track', () => {
    expect(fillPercent(5000, 2500)).toBe(100);
  });
});

describe('formatMl', () => {
  it('renders millilitres as litres to one decimal', () => {
    expect(formatMl(2500)).toBe('2.5 L');
    expect(formatMl(0)).toBe('0.0 L');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(12431)).toBe('12,431');
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeightReminderBanner } from './WeightReminderBanner';

beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('WeightReminderBanner', () => {
    it('shows on Sunday and links directly to weight entry', () => {
        render(<WeightReminderBanner viewerId="m1" />);

        expect(screen.getByRole('complementary', { name: 'Weekly weight reminder' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Log your weight' })).toHaveAttribute(
            'href',
            '/profile#log-weight'
        );
    });

    it('does not show to visitors', () => {
        render(<WeightReminderBanner viewerId={null} />);
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('does not show on other days', () => {
        vi.setSystemTime(new Date('2026-10-05T12:00:00'));
        render(<WeightReminderBanner viewerId="m1" />);
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('remembers dismissal for this user and Sunday only', () => {
        const first = render(<WeightReminderBanner viewerId="m1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss weight reminder' }));
        first.unmount();

        const next = render(<WeightReminderBanner viewerId="m1" />);
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        next.rerender(<WeightReminderBanner viewerId="m2" />);
        expect(screen.getByRole('complementary')).toBeInTheDocument();
        next.unmount();

        vi.setSystemTime(new Date('2026-10-11T12:00:00'));
        render(<WeightReminderBanner viewerId="m1" />);
        expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('hides at midnight when Sunday ends', () => {
        vi.setSystemTime(new Date('2026-10-04T23:59:00'));
        render(<WeightReminderBanner viewerId="m1" />);
        act(() => vi.advanceTimersByTime(60_000));
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('appears when an open page reaches Sunday', () => {
        vi.setSystemTime(new Date('2026-10-03T23:59:00'));
        render(<WeightReminderBanner viewerId="m1" />);
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        act(() => vi.advanceTimersByTime(60_000));
        expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('still works when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        render(<WeightReminderBanner viewerId="m1" />);
        expect(screen.getByRole('complementary')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss weight reminder' }));
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });
});
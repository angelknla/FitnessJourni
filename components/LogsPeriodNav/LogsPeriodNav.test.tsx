import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LogsPeriodNav } from './LogsPeriodNav';

const push = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}));

describe('LogsPeriodNav', () => {
    it('keeps period links and navigates to an exact selected date', () => {
        render(<LogsPeriodNav period="week" selectedDate={null} today="2026-09-27" />);

        expect(screen.getByRole('link', { name: 'This week' })).toHaveAttribute('aria-current', 'page');
        fireEvent.change(screen.getByLabelText('View logs for a date'), {
            target: { value: '2026-09-24' },
        });

        expect(push).toHaveBeenCalledWith('/logs?date=2026-09-24');
    });

    it('shows the selected date instead of marking a preset active', () => {
        render(<LogsPeriodNav period="today" selectedDate="2026-09-24" today="2026-09-27" />);

        expect(screen.getByText('24 Sept')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
        expect(screen.getByLabelText('View logs for a date')).toHaveAttribute('max', '2026-09-27');
    });
});
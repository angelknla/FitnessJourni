import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member, MemberTargets } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
    postMessage: vi.fn(async () => ({ ok: true })),
    markMessagesRead: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

import { MessageBoard } from './MessageBoard';

const targets: MemberTargets = {
    calories: 2500,
    protein: 156,
    carbs: 313,
    fat: 69,
    steps: 10000,
    stepsMin: 8000,
    waterMl: 2500,
    workoutsPerWeek: 4,
};
const member: Member = {
    id: 'm1',
    name: 'Dillon',
    accent: 'blue',
    sortOrder: 0,
    targets,
};

describe('MessageBoard', () => {
    it('shows the composer and attributed posts for a member', () => {
        render(
            <MessageBoard
                members={[member]}
                viewerId="m1"
                messages={[
                    {
                        id: 'post-1',
                        memberId: 'm1',
                        content: 'Keep showing up.',
                        createdAt: '2026-09-25T08:30:00.000Z',
                    },
                ]}
            />
        );

        expect(screen.getByLabelText('Share something with the group')).toHaveAttribute(
            'maxlength',
            '500'
        );
        expect(screen.getByRole('list', { name: 'Conversation' })).toHaveTextContent(
            'Keep showing up.'
        );
        expect(screen.getByText('You')).toBeInTheDocument();
        expect(screen.getByText('Friday, 25 September 2026')).toBeInTheDocument();
    });

    it('filters the conversation by month', async () => {
        const user = userEvent.setup();
        render(
            <MessageBoard
                members={[member]}
                viewerId="m1"
                messages={[
                    { id: 'sep', memberId: 'm1', content: 'September', createdAt: '2026-09-25T08:30:00' },
                    { id: 'aug', memberId: 'm1', content: 'August', createdAt: '2026-08-25T08:30:00' },
                ]}
            />
        );

        await user.selectOptions(screen.getByLabelText('Show'), 'month');
        await user.type(screen.getByLabelText('Month'), '2026-09');

        expect(screen.getByText('September')).toBeInTheDocument();
        expect(screen.queryByText('August')).not.toBeInTheDocument();
    });

    it('asks visitors to choose a profile instead of showing the composer', () => {
        render(<MessageBoard members={[member]} viewerId={null} messages={[]} />);

        expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
        expect(screen.getByText(/Choose who you are/)).toBeInTheDocument();
    });
});
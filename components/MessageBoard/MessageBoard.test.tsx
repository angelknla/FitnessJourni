import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member, MemberTargets } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
    postMessage: vi.fn(async () => ({ ok: true })),
    editMessage: vi.fn(async () => ({ ok: true })),
    deleteMessage: vi.fn(async () => ({ ok: true })),
    reactToMessage: vi.fn(async () => ({ ok: true })),
    markMessagesRead: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

import { reactToMessage } from '@/app/actions';
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
    it('shows owner options and opens the inline message editor', async () => {
        const user = userEvent.setup();
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
                        reactions: [],
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
        expect(
            screen.getByRole('list', { name: 'Conversation' }).compareDocumentPosition(
                screen.getByLabelText('Share something with the group')
            ) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            screen.getByRole('list', { name: 'Conversation' }).parentElement?.className
        ).toContain('conversation');
        expect(screen.getByText('You')).toBeInTheDocument();
        expect(screen.getByText('Friday, 25 September 2026')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Message options' }));
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Message options' }));
        await user.click(screen.getByRole('button', { name: 'Edit' }));
        expect(screen.getByLabelText('Edit message')).toHaveValue('Keep showing up.');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('does not show message options for another member’s post', () => {
        render(
            <MessageBoard
                members={[member]}
                viewerId="someone-else"
                messages={[
                    {
                        id: 'post-1',
                        memberId: 'm1',
                        content: 'Keep showing up.',
                        createdAt: '2026-09-25T08:30:00.000Z',
                        reactions: [],
                    },
                ]}
            />
        );

        expect(screen.queryByRole('button', { name: 'Message options' })).not.toBeInTheDocument();
    });

    it('filters the conversation by month', async () => {
        const user = userEvent.setup();
        render(
            <MessageBoard
                members={[member]}
                viewerId="m1"
                messages={[
                    { id: 'sep', memberId: 'm1', content: 'September', createdAt: '2026-09-25T08:30:00', reactions: [] },
                    { id: 'aug', memberId: 'm1', content: 'August', createdAt: '2026-08-25T08:30:00', reactions: [] },
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

    it('shows reaction counts and offers all four reactions', async () => {
        const user = userEvent.setup();
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
                        reactions: [
                            { memberId: 'm1', type: 'heart' },
                            { memberId: 'm2', type: 'heart' },
                            { memberId: 'm3', type: 'heart' },
                        ],
                    },
                ]}
            />
        );

        expect(screen.getByRole('button', { name: 'Heart, 3 reactions' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await user.click(screen.getByRole('button', { name: 'React to message' }));
        for (const label of ['Heart', 'Smile', 'Shocked', 'Angry']) {
            expect(screen.getByRole('button', { name: `${label} reaction` })).toBeInTheDocument();
        }
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('button', { name: 'Heart reaction' })).not.toBeInTheDocument();
    });

    it('opens the reaction picker after holding a message on touch', () => {
        vi.useFakeTimers();
        render(
            <MessageBoard
                members={[member]}
                viewerId="m1"
                messages={[
                    {
                        id: 'post-1',
                        memberId: 'm1',
                        content: 'Hold this message.',
                        createdAt: '2026-09-25T08:30:00.000Z',
                        reactions: [],
                    },
                ]}
            />
        );

        const bubble = screen.getByText('Hold this message.').closest('article');
        const pointerDown = new Event('pointerdown', { bubbles: true });
        Object.defineProperties(pointerDown, {
            pointerType: { value: 'touch' },
            clientX: { value: 20 },
            clientY: { value: 20 },
        });
        fireEvent(bubble!, pointerDown);
        act(() => vi.advanceTimersByTime(500));

        expect(screen.getByRole('group', { name: 'Choose reaction' })).toBeInTheDocument();
        vi.useRealTimers();
    });

    it('reacts with a heart after double-tapping a message on touch', async () => {
        render(
            <MessageBoard
                members={[member]}
                viewerId="m1"
                messages={[
                    {
                        id: 'post-1',
                        memberId: 'm1',
                        content: 'Double tap this message.',
                        createdAt: '2026-09-25T08:30:00.000Z',
                        reactions: [],
                    },
                ]}
            />
        );

        const bubble = screen.getByText('Double tap this message.').closest('article');
        const fireTouchPointer = (type: 'pointerdown' | 'pointerup') => {
            const event = new Event(type, { bubbles: true });
            Object.defineProperties(event, {
                pointerType: { value: 'touch' },
                clientX: { value: 20 },
                clientY: { value: 20 },
            });
            fireEvent(bubble!, event);
        };

        fireTouchPointer('pointerdown');
        fireTouchPointer('pointerup');
        fireTouchPointer('pointerdown');
        fireTouchPointer('pointerup');

        await waitFor(() => expect(reactToMessage).toHaveBeenCalled());
        const submittedData = vi.mocked(reactToMessage).mock.calls.at(-1)?.[1];
        expect(submittedData?.get('messageId')).toBe('post-1');
        expect(submittedData?.get('reaction')).toBe('heart');
    });
});
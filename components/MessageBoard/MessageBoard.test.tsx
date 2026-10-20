import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Member, MemberTargets } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  postMessage: vi.fn(async () => ({ ok: true, bookedAt: 1, messageId: 'post-new' })),
  editMessage: vi.fn(async () => ({ ok: true })),
  deleteMessage: vi.fn(async () => ({ ok: true })),
  reactToMessage: vi.fn(async () => ({ ok: true })),
  markMessagesRead: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { type ActionState, postMessage, reactToMessage } from '@/app/actions';
import { MessageBoard } from './MessageBoard';

const deferReactionAction = () => {
  const resolvers: Array<(state: ActionState) => void> = [];
  vi.mocked(reactToMessage).mockImplementation(
    (_previousState, _formData) => new Promise((resolve) => resolvers.push(resolve))
  );
  return {
    resolveNext: async (state: ActionState) => {
      const resolve = resolvers.shift();
      expect(resolve).toBeDefined();
      await act(async () => {
        resolve?.(state);
        await Promise.resolve();
      });
    },
  };
};

afterEach(() => {
  vi.mocked(reactToMessage).mockReset();
  vi.mocked(reactToMessage).mockImplementation(async () => ({ ok: true }));
});

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
const angel: Member = { ...member, id: 'm2', name: 'Angel', accent: 'orange' };
const bradley: Member = { ...member, id: 'm3', name: 'Bradley', accent: 'green' };

describe('MessageBoard', () => {
  it('shows owner options and opens the inline message editor', async () => {
    const user = userEvent.setup();
    const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(
      <MessageBoard
        members={[member]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm1',
            content: 'Keep showing up.',
            createdAt,
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
      screen
        .getByRole('list', { name: 'Conversation' })
        .compareDocumentPosition(screen.getByLabelText('Share something with the group')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Conversation' }).parentElement?.className).toContain(
      'conversation'
    );
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(
      screen.getByText(
        new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(createdAt))
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Message options' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Message options' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Edit message')).toHaveValue('Keep showing up.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('offers reply but not edit or delete for another member’s post', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: 'Message options' }));
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to Dillon')).toBeInTheDocument();
    expect(screen.getAllByText('Keep showing up.')).toHaveLength(2);

    await user.type(screen.getByLabelText('Share something with the group'), 'Absolutely');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    const submitted = vi.mocked(postMessage).mock.calls.at(-1)?.[1];
    expect(submitted?.get('content')).toBe('Absolutely');
    expect(submitted?.get('replyToId')).toBe('post-1');
  });

  it('keeps expired message options available but disables edit and delete', async () => {
    const user = userEvent.setup();
    render(
      <MessageBoard
        members={[member]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm1',
            content: 'An older message.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [],
          },
        ]}
      />
    );

    const options = screen.getByRole('button', { name: 'Message options' });
    expect(options).toBeEnabled();
    await user.click(options);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('filters the conversation by date and does not offer a month filter', async () => {
    const user = userEvent.setup();
    render(
      <MessageBoard
        members={[member]}
        viewerId="m1"
        messages={[
          {
            id: 'sep',
            memberId: 'm1',
            content: 'September',
            createdAt: '2026-09-25T08:30:00',
            reactions: [],
          },
          {
            id: 'aug',
            memberId: 'm1',
            content: 'August',
            createdAt: '2026-08-25T08:30:00',
            reactions: [],
          },
        ]}
      />
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Filter messages by date'), '2026-09-25');

    expect(screen.getByText('25 Sept')).toBeInTheDocument();
    expect(screen.getByText('September')).toBeInTheDocument();
    expect(screen.queryByText('August')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear message date filter' }));
    expect(screen.getByText('August')).toBeInTheDocument();
  });

  it('asks visitors to choose a profile instead of showing the composer', () => {
    render(<MessageBoard members={[member]} viewerId={null} messages={[]} />);

    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    expect(screen.getByText(/Choose who you are/)).toBeInTheDocument();
  });

  it('grows the composer as the message wraps', () => {
    render(<MessageBoard members={[member]} viewerId="m1" messages={[]} />);

    const composer = screen.getByLabelText('Share something with the group');
    Object.defineProperty(composer, 'scrollHeight', { configurable: true, value: 72 });
    fireEvent.input(composer, { target: { value: 'A message that wraps onto another line' } });

    expect(composer).toHaveStyle({ height: '72px' });
  });

  it('shows a message optimistically, keeps failures retryable, and scrolls to it', async () => {
    const user = userEvent.setup();
    let resolvePost: (result: { ok: boolean; error?: string }) => void = () => {};
    vi.mocked(postMessage).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    );
    const { rerender } = render(<MessageBoard members={[member]} viewerId="m1" messages={[]} />);
    const conversation = screen
      .getByLabelText('Group chat')
      .querySelector('[class*="conversation"]');
    const scrollTo = vi.fn();
    Object.defineProperty(conversation, 'scrollHeight', { configurable: true, value: 240 });
    Object.defineProperty(conversation, 'scrollTo', { configurable: true, value: scrollTo });

    fireEvent.change(screen.getByLabelText('Share something with the group'), {
      target: { value: 'New win' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Send message' }).closest('form')!);

    expect(screen.getByText('New win')).toBeInTheDocument();
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 240, behavior: 'smooth' });
    });

    await act(async () => {
      resolvePost({ ok: false, error: 'Could not share that post.' });
    });
    expect(screen.getByText('Not sent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry sending message' })).toHaveAttribute(
      'title',
      'Could not share that post.'
    );

    vi.mocked(postMessage).mockResolvedValueOnce({
      ok: true,
      bookedAt: 2,
      messageId: 'post-new',
    });
    await user.click(screen.getByRole('button', { name: 'Retry sending message' }));

    rerender(
      <MessageBoard
        members={[member]}
        viewerId="m1"
        messages={[
          {
            id: 'post-new',
            memberId: 'm1',
            content: 'New win',
            createdAt: '2026-09-27T10:00:00.000Z',
            reactions: [],
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('New win')).toHaveLength(1);
    });
    expect(screen.queryByText('Shared with the group.')).not.toBeInTheDocument();
  });

  it('shows reaction counts and offers all six reactions', async () => {
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

    const reactionTrigger = screen.getByRole('button', {
      name: 'React to message. Heart, 3 reactions',
    });
    expect(reactionTrigger).toHaveTextContent('❤️3');
    await user.click(reactionTrigger);
    for (const label of ['Heart', 'Thumbs up', 'Thumbs down', 'Smile', 'Shocked', 'Angry']) {
      expect(screen.getByRole('button', { name: `${label} reaction` })).toBeInTheDocument();
    }
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: 'Heart reaction' })).not.toBeInTheDocument();
  });

  it('applies reactions immediately, replaces the viewer reaction, and toggles it off', async () => {
    const user = userEvent.setup();
    const deferred = deferReactionAction();
    const { rerender } = render(
      <MessageBoard
        members={[member, angel, bradley]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm2',
            content: 'React quickly.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [
              { memberId: 'm1', type: 'heart' },
              { memberId: 'm2', type: 'heart' },
              { memberId: 'm3', type: 'smile' },
            ],
          },
        ]}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: 'React to message. Heart, 2 reactions. Smile, 1 reaction',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Smile reaction' }));

    const replacedTrigger = await screen.findByRole('button', {
      name: 'React to message. Heart, 1 reaction. Smile, 2 reactions',
    });
    expect(replacedTrigger).toHaveTextContent('❤️1😊2');
    expect(replacedTrigger).toBeDisabled();
    expect(reactToMessage).toHaveBeenCalledOnce();
    expect(vi.mocked(reactToMessage).mock.calls[0]?.[1].get('reaction')).toBe('smile');

    rerender(
      <MessageBoard
        members={[member, angel, bradley]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm2',
            content: 'React quickly.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [
              { memberId: 'm2', type: 'heart' },
              { memberId: 'm1', type: 'smile' },
              { memberId: 'm3', type: 'smile' },
            ],
          },
        ]}
      />
    );
    await deferred.resolveNext({ ok: true });
    await waitFor(() => expect(replacedTrigger).toBeEnabled());

    await user.click(replacedTrigger);
    expect(screen.getByRole('button', { name: 'Smile reaction' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await user.click(screen.getByRole('button', { name: 'Smile reaction' }));

    const toggledTrigger = await screen.findByRole('button', {
      name: 'React to message. Heart, 1 reaction. Smile, 1 reaction',
    });
    expect(toggledTrigger).toHaveTextContent('❤️1😊1');
    expect(toggledTrigger).toBeDisabled();
    await deferred.resolveNext({ ok: true });
  });

  it('reverts the optimistic reaction and shows the action error on failure', async () => {
    const user = userEvent.setup();
    const deferred = deferReactionAction();
    render(
      <MessageBoard
        members={[member, angel]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm2',
            content: 'A reaction may fail.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [{ memberId: 'm2', type: 'heart' }],
          },
        ]}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: 'React to message. Heart, 1 reaction',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Heart reaction' }));

    const optimisticTrigger = await screen.findByRole('button', {
      name: 'React to message. Heart, 2 reactions',
    });
    expect(optimisticTrigger).toBeDisabled();

    await deferred.resolveNext({ ok: false, error: 'Could not update that reaction.' });

    expect(
      await screen.findByRole('button', {
        name: 'React to message. Heart, 1 reaction',
      })
    ).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not update that reaction.');
  });

  it('shows who added each reaction on hover', async () => {
    const user = userEvent.setup();
    render(
      <MessageBoard
        members={[member, angel, bradley]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm1',
            content: 'Reaction details.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [
              { memberId: 'm1', type: 'heart' },
              { memberId: 'm2', type: 'heart' },
              { memberId: 'm3', type: 'smile' },
            ],
          },
        ]}
      />
    );

    const reactionTrigger = screen.getByRole('button', {
      name: 'React to message. Heart, 2 reactions. Smile, 1 reaction',
    });
    await user.hover(reactionTrigger);

    const details = screen.getByRole('tooltip');
    expect(details).toHaveTextContent('Dillon, Angel');
    expect(details).toHaveTextContent('Bradley');

    await user.unhover(reactionTrigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows reaction authors after holding the reaction pill on touch', () => {
    vi.useFakeTimers();
    render(
      <MessageBoard
        members={[member, angel]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm1',
            content: 'Hold reaction details.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [
              { memberId: 'm1', type: 'heart' },
              { memberId: 'm2', type: 'heart' },
            ],
          },
        ]}
      />
    );

    const reactionTrigger = screen.getByRole('button', {
      name: 'React to message. Heart, 2 reactions',
    });
    const pointerDown = new Event('pointerdown', { bubbles: true });
    Object.defineProperties(pointerDown, {
      pointerType: { value: 'touch' },
      clientX: { value: 20 },
      clientY: { value: 20 },
    });
    fireEvent(reactionTrigger, pointerDown);
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Dillon, Angel');
    expect(screen.queryByRole('group', { name: 'Choose reaction' })).not.toBeInTheDocument();
    vi.useRealTimers();
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

  it('selects a message for reply after swiping it right', () => {
    render(
      <MessageBoard
        members={[member]}
        viewerId="m1"
        messages={[
          {
            id: 'post-1',
            memberId: 'm1',
            content: 'Swipe this message.',
            createdAt: '2026-09-25T08:30:00.000Z',
            reactions: [],
          },
        ]}
      />
    );

    const bubble = screen.getByText('Swipe this message.').closest('article');
    const fireTouchPointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerType: { value: 'touch' },
        clientX: { value: x },
        clientY: { value: 20 },
      });
      fireEvent(bubble!, event);
    };

    fireTouchPointer('pointerdown', 20);
    fireTouchPointer('pointermove', 100);
    fireTouchPointer('pointerup', 100);

    expect(screen.getByText('Replying to yourself')).toBeInTheDocument();
    expect(screen.getAllByText('Swipe this message.')).toHaveLength(2);
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

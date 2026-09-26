'use client';

import { BinIcon, CalendarIcon, CrossIcon, MoreIcon, PencilIcon, ReactionIcon, SendIcon } from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { accentHex } from '@data/fitnessData';
import { useRouter } from 'next/navigation';
import {
    type CSSProperties,
    Fragment,
    type PointerEvent as ReactPointerEvent,
    useActionState,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    type ActionState,
    deleteMessage,
    editMessage,
    markMessagesRead,
    postMessage,
    reactToMessage,
} from '@/app/actions';
import type { Member, MessagePost, MessageReactionType } from '@/types/fitness';

import styles from './MessageBoard.module.css';

interface MessageBoardProps {
    members: Member[];
    messages: MessagePost[];
    viewerId: string | null;
}

const initial: ActionState = { ok: false };
const messageTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
});
const dayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
const shortDateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
});
const reactionOptions: Array<{ type: MessageReactionType; emoji: string; label: string }> = [
    { type: 'heart', emoji: '❤️', label: 'Heart' },
    { type: 'smile', emoji: '😊', label: 'Smile' },
    { type: 'shocked', emoji: '😮', label: 'Shocked' },
    { type: 'angry', emoji: '😠', label: 'Angry' },
];

const localDateKey = (value: string): string => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MessageBubble = ({
    message,
    author,
    own,
    viewerId,
}: {
    message: MessagePost;
    author?: Member;
    own: boolean;
    viewerId: string | null;
}) => {
    const [editing, setEditing] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [editState, editAction, isEditing] = useActionState(editMessage, initial);
    const [deleteState, deleteAction, isDeleting] = useActionState(deleteMessage, initial);
    const [reactionState, reactionAction, isReacting] = useActionState(reactToMessage, initial);
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const optionsRef = useRef<HTMLSpanElement>(null);
    const reactionFormRef = useRef<HTMLFormElement>(null);
    const reactionInputRef = useRef<HTMLInputElement>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggeredRef = useRef(false);
    const lastTapRef = useRef(0);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const lastPointerTypeRef = useRef('');
    const viewerReaction = message.reactions.find(
        (reaction) => reaction.memberId === viewerId
    )?.type;
    const reactionCounts = reactionOptions
        .map((option) => ({
            ...option,
            count: message.reactions.filter((reaction) => reaction.type === option.type).length,
        }))
        .filter((option) => option.count > 0);
    const reactionSummary = reactionCounts
        .map((reaction) => `${reaction.label}, ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}`)
        .join('. ');

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const submitReaction = (reaction: MessageReactionType) => {
        if (!viewerId || isReacting || !reactionInputRef.current) return;
        reactionInputRef.current.value = reaction;
        reactionFormRef.current?.requestSubmit();
        setReactionPickerOpen(false);
    };

    const isInteractive = (target: EventTarget | null) =>
        target instanceof Element &&
        Boolean(target.closest('button, a, input, textarea, select, label, [contenteditable]'));

    const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        lastPointerTypeRef.current = event.pointerType;
        if (event.pointerType !== 'touch' || !viewerId || isInteractive(event.target)) return;

        clearLongPress();
        longPressTriggeredRef.current = false;
        touchStartRef.current = { x: event.clientX, y: event.clientY };
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            setReactionPickerOpen(true);
        }, 500);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (
            Math.abs(event.clientX - touchStartRef.current.x) > 10 ||
            Math.abs(event.clientY - touchStartRef.current.y) > 10
        ) {
            clearLongPress();
        }
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        clearLongPress();
        if (
            event.pointerType !== 'touch' ||
            !viewerId ||
            isInteractive(event.target) ||
            longPressTriggeredRef.current
        ) {
            longPressTriggeredRef.current = false;
            return;
        }

        const now = Date.now();
        if (now - lastTapRef.current < 320) {
            lastTapRef.current = 0;
            submitReaction('heart');
        } else {
            lastTapRef.current = now;
        }
    };

    useEffect(() => {
        if (editState.ok && editState.bookedAt) {
            setEditing(false);
        }
    }, [editState.ok, editState.bookedAt]);

    useEffect(() => {
        if (!optionsOpen && !reactionPickerOpen) return;

        const handleOutsidePointer = (event: PointerEvent) => {
            const target = event.target as Node;
            if (optionsOpen && !optionsRef.current?.contains(target)) setOptionsOpen(false);
            if (reactionPickerOpen && !reactionFormRef.current?.contains(target)) {
                setReactionPickerOpen(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsidePointer);
        return () => document.removeEventListener('pointerdown', handleOutsidePointer);
    }, [optionsOpen, reactionPickerOpen]);

    useEffect(
        () => () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        },
        []
    );

    return (
        <article
            className={`${styles.bubble} ${viewerId || reactionCounts.length > 0 ? styles.hasReactions : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={clearLongPress}
            onContextMenu={(event) => {
                if (lastPointerTypeRef.current === 'touch') event.preventDefault();
            }}
        >
            <header className={styles.meta}>
                <span className={styles.author}>
                    {author ? (
                        <MemberAvatar member={author} size="1.5rem" />
                    ) : (
                        <span className={styles.formerAvatar} aria-hidden="true">
                            ?
                        </span>
                    )}
                    <strong>{own ? 'You' : (author?.name ?? 'Former member')}</strong>
                </span>
                <span className={styles.messageMeta}>
                    <time dateTime={message.createdAt}>
                        {messageTime.format(new Date(message.createdAt))}
                    </time>
                    {own && (
                        <span ref={optionsRef} className={styles.options}>
                            <button
                                type="button"
                                className={styles.optionsToggle}
                                aria-label="Message options"
                                aria-expanded={optionsOpen}
                                onClick={() => setOptionsOpen((open) => !open)}
                            >
                                <MoreIcon />
                            </button>
                            {optionsOpen && (
                                <span className={styles.optionsMenu}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditing(true);
                                            setOptionsOpen(false);
                                        }}
                                    >
                                        <PencilIcon />
                                        Edit
                                    </button>
                                    <form
                                        action={deleteAction}
                                        onSubmit={(event) => {
                                            if (!window.confirm('Remove this message?')) {
                                                event.preventDefault();
                                            }
                                        }}
                                    >
                                        <input type="hidden" name="id" value={message.id} />
                                        <button type="submit" disabled={isDeleting}>
                                            <BinIcon />
                                            {isDeleting ? 'Removing…' : 'Delete'}
                                        </button>
                                    </form>
                                </span>
                            )}
                        </span>
                    )}
                </span>
            </header>
            {editing ? (
                <form action={editAction} className={styles.editForm}>
                    <input type="hidden" name="id" value={message.id} />
                    <label className="sr-only" htmlFor={`edit-message-${message.id}`}>
                        Edit message
                    </label>
                    <textarea
                        id={`edit-message-${message.id}`}
                        name="content"
                        defaultValue={message.content}
                        rows={3}
                        maxLength={500}
                        required
                    />
                    <span className={styles.editActions}>
                        <button type="button" onClick={() => setEditing(false)}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isEditing}>
                            {isEditing ? 'Saving…' : 'Save'}
                        </button>
                    </span>
                </form>
            ) : (
                <p>{message.content}</p>
            )}
            {(viewerId || reactionCounts.length > 0) && (
                <div className={styles.reactions}>
                    {viewerId ? (
                        <form ref={reactionFormRef} action={reactionAction} className={styles.reactionControl}>
                            <input type="hidden" name="messageId" value={message.id} />
                            <input ref={reactionInputRef} type="hidden" name="reaction" defaultValue="heart" />
                            <button
                                type="button"
                                className={styles.reactionToggle}
                                aria-label={reactionSummary ? `React to message. ${reactionSummary}` : 'React to message'}
                                aria-expanded={reactionPickerOpen}
                                disabled={isReacting}
                                onClick={() => setReactionPickerOpen((open) => !open)}
                            >
                                {reactionCounts.length > 0 ? (
                                    reactionCounts.map((reaction) => (
                                        <span className={styles.reactionBadge} key={reaction.type}>
                                            <span aria-hidden="true">{reaction.emoji}</span>
                                            <span>{reaction.count}</span>
                                        </span>
                                    ))
                                ) : (
                                    <ReactionIcon size={14} />
                                )}
                            </button>
                            {reactionPickerOpen && (
                                <fieldset className={styles.reactionPicker}>
                                    <legend className="sr-only">Choose reaction</legend>
                                    {reactionOptions.map((option) => (
                                        <button
                                            type="button"
                                            key={option.type}
                                            aria-label={`${option.label} reaction`}
                                            aria-pressed={viewerReaction === option.type}
                                            onClick={() => submitReaction(option.type)}
                                        >
                                            {option.emoji}
                                        </button>
                                    ))}
                                </fieldset>
                            )}
                        </form>
                    ) : (
                        <span className={styles.reactionToggle} role="img" aria-label={reactionSummary}>
                            {reactionCounts.map((reaction) => (
                                <span className={styles.reactionBadge} key={reaction.type}>
                                    <span aria-hidden="true">{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            )}
            {(editState.error || deleteState.error || reactionState.error) && (
                <span className={styles.messageError} role="alert">
                    {editState.error ?? deleteState.error ?? reactionState.error}
                </span>
            )}
        </article>
    );
};

export const MessageBoard = ({ members, messages, viewerId }: MessageBoardProps) => {
    const [state, formAction, isPending] = useActionState(postMessage, initial);
    const formRef = useRef<HTMLFormElement>(null);
    const composerInputRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();
    const [filterMode, setFilterMode] = useState<'all' | 'date'>('all');
    const [filterValue, setFilterValue] = useState('');
    const memberById = new Map(members.map((member) => [member.id, member]));
    const filteredMessages = [...messages]
        .filter((message) => {
            if (filterMode === 'all' || !filterValue) {
                return true;
            }
            const date = localDateKey(message.createdAt);
            return date === filterValue;
        })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    useEffect(() => {
        void markMessagesRead().then(() => router.refresh());
    }, [router]);

    useEffect(() => {
        if (state.ok && state.bookedAt) {
            formRef.current?.reset();
            composerInputRef.current?.style.removeProperty('height');
        }
    }, [state.ok, state.bookedAt]);

    const resizeComposer = () => {
        const input = composerInputRef.current;
        if (!input) return;
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    };

    const filterControls = (
        <div className={styles.mobileFilters}>
            <label
                className={`${styles.mobileDateControl} ${filterValue ? styles.mobileDateActive : ''}`}
                title="Filter messages by date"
            >
                <CalendarIcon size={18} />
                {filterValue && (
                    <span aria-hidden="true">
                        {shortDateLabel.format(new Date(`${filterValue}T12:00:00`))}
                    </span>
                )}
                <input
                    type="date"
                    aria-label="Filter messages by date"
                    value={filterValue}
                    onChange={(event) => {
                        setFilterMode(event.target.value ? 'date' : 'all');
                        setFilterValue(event.target.value);
                    }}
                />
            </label>
            {filterMode === 'date' && filterValue && (
                <button
                    type="button"
                    className={styles.clearFilter}
                    aria-label="Clear message date filter"
                    title="Clear filter"
                    onClick={() => {
                        setFilterMode('all');
                        setFilterValue('');
                    }}
                >
                    <CrossIcon size={14} />
                </button>
            )}
        </div>
    );

    return (
        <>
            <PageHeader
                eyebrow="Chat"
                title="Keep moving together"
                actions={messages.length > 0 ? filterControls : undefined}
            />
            <section className={styles.board} aria-label="Group chat">
                <div className={styles.conversation}>
                    {filteredMessages.length > 0 ? (
                        <ol className={styles.feed} aria-label="Conversation">
                            {filteredMessages.map((message, index) => {
                                const author = memberById.get(message.memberId);
                                const accent = author ? accentHex[author.accent] : 'var(--c-ink-muted)';
                                const date = localDateKey(message.createdAt);
                                const previousDate =
                                    index > 0 ? localDateKey(filteredMessages[index - 1].createdAt) : null;
                                const own = message.memberId === viewerId;

                                return (
                                    <Fragment key={message.id}>
                                        {date !== previousDate && (
                                            <li className={styles.dateDivider}>
                                                <span>{dayLabel.format(new Date(message.createdAt))}</span>
                                            </li>
                                        )}
                                        <li
                                            className={`${styles.message} ${own ? styles.own : ''}`}
                                            style={{ '--message-accent': accent } as CSSProperties}
                                        >
                                            <MessageBubble
                                                message={message}
                                                author={author}
                                                own={own}
                                                viewerId={viewerId}
                                            />
                                        </li>
                                    </Fragment>
                                );
                            })}
                        </ol>
                    ) : (
                        <div className={styles.empty}>
                            <strong>{messages.length > 0 ? 'No messages for that period' : 'Nothing shared yet'}</strong>
                            <span>
                                {messages.length > 0
                                    ? 'Try another date or return to all messages.'
                                    : 'Start with today’s win or the thought keeping you moving.'}
                            </span>
                        </div>
                    )}
                </div>

                {viewerId ? (
                    <form ref={formRef} action={formAction} className={styles.composer}>
                        <label className="sr-only" htmlFor="chat-message">Share something with the group</label>
                        <div className={styles.composeRow}>
                            <textarea
                                ref={composerInputRef}
                                id="chat-message"
                                name="content"
                                rows={1}
                                maxLength={500}
                                placeholder="Write a message…"
                                onInput={resizeComposer}
                                required
                            />
                            <button type="submit" disabled={isPending} aria-label="Send message">
                                <SendIcon />
                            </button>
                        </div>
                        {state.error && (
                            <p className={styles.error} role="alert">
                                {state.error}
                            </p>
                        )}
                        {state.ok && state.message && <p className={styles.success}>{state.message}</p>}
                    </form>
                ) : (
                    <p className={styles.choosePerson}>Choose who you are from Profile to share a post.</p>
                )}
            </section>
        </>
    );
};
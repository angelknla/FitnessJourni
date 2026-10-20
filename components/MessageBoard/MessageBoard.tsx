'use client';

import {
    BinIcon,
    CalendarIcon,
    CrossIcon,
    MoreIcon,
    PencilIcon,
    ReactionIcon,
    ReplyIcon,
    ResyncIcon,
    SendIcon,
} from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { accentHex } from '@data/fitnessData';
import {
    type CSSProperties,
    type FormEvent,
    Fragment,
    type PointerEvent as ReactPointerEvent,
    useActionState,
    useEffect,
    useOptimistic,
    useRef,
    useState,
    useTransition,
} from 'react';
import {
    type ActionState,
    deleteMessage,
    editMessage,
    markMessagesRead,
    postMessage,
    reactToMessage,
} from '@/app/actions';
import { canModifyMessage, MESSAGE_EDIT_WINDOW_MS } from '@/lib/messagePolicy';
import type {
    Member,
    MessagePost,
    MessageReaction,
    MessageReactionType,
    MessageReply,
} from '@/types/fitness';

import styles from './MessageBoard.module.css';

interface MessageBoardProps {
    members: Member[];
    messages: MessagePost[];
    viewerId: string | null;
}

const initial: ActionState = { ok: false };
interface OptimisticMessage {
    clientId: string;
    content: string;
    createdAt: string;
    status: 'sending' | 'failed' | 'confirmed';
    serverId?: string;
    error?: string;
    replyTo?: MessageReply;
}

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
    { type: 'thumbs_up', emoji: '👍', label: 'Thumbs up' },
    { type: 'thumbs_down', emoji: '👎', label: 'Thumbs down' },
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
    replyAuthor,
    memberById,
    own,
    viewerId,
    onReply,
}: {
    message: MessagePost;
    author?: Member;
    replyAuthor?: Member;
    memberById: Map<string, Member>;
    own: boolean;
    viewerId: string | null;
    onReply: (message: MessageReply) => void;
}) => {
    const [editing, setEditing] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [editState, editAction, isEditing] = useActionState(editMessage, initial);
    const [deleteState, deleteAction, isDeleting] = useActionState(deleteMessage, initial);
    const [optimisticReactions, addOptimisticReaction] = useOptimistic(
        message.reactions,
        (currentReactions: MessageReaction[], nextReaction: MessageReactionType) => {
            if (!viewerId) return currentReactions;
            const viewerAlreadyReacted = currentReactions.some(
                (reaction) => reaction.memberId === viewerId && reaction.type === nextReaction
            );
            const otherReactions = currentReactions.filter(
                (reaction) => reaction.memberId !== viewerId
            );
            return viewerAlreadyReacted
                ? otherReactions
                : [...otherReactions, { memberId: viewerId, type: nextReaction }];
        }
    );
    const [reactionState, reactionAction, isReacting] = useActionState(
        async (previousState: ActionState, formData: FormData) => {
            const nextReaction = formData.get('reaction');
            if (
                viewerId &&
                typeof nextReaction === 'string' &&
                reactionOptions.some((option) => option.type === nextReaction)
            ) {
                addOptimisticReaction(nextReaction as MessageReactionType);
            }
            return reactToMessage(previousState, formData);
        },
        initial
    );
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const [reactionDetailsOpen, setReactionDetailsOpen] = useState(false);
    const [canModify, setCanModify] = useState(() => canModifyMessage(message.createdAt));
    const bubbleRef = useRef<HTMLElement>(null);
    const optionsRef = useRef<HTMLSpanElement>(null);
    const reactionFormRef = useRef<HTMLFormElement>(null);
    const reactionsRef = useRef<HTMLDivElement>(null);
    const reactionInputRef = useRef<HTMLInputElement>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reactionHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reactionHoldTriggeredRef = useRef(false);
    const reactionTouchStartRef = useRef({ x: 0, y: 0 });
    const longPressTriggeredRef = useRef(false);
    const lastTapRef = useRef(0);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const swipeOffsetRef = useRef(0);
    const swipeActiveRef = useRef(false);
    const lastPointerTypeRef = useRef('');
    const viewerReaction = optimisticReactions.find(
        (reaction) => reaction.memberId === viewerId
    )?.type;
    const reactionCounts = reactionOptions
        .map((option) => ({
            ...option,
            reactors: optimisticReactions
                .filter((reaction) => reaction.type === option.type)
                .map((reaction) => memberById.get(reaction.memberId)?.name ?? 'Former member'),
        }))
        .filter((option) => option.reactors.length > 0);
    const reactionSummary = reactionCounts
        .map((reaction) => `${reaction.label}, ${reaction.reactors.length} ${reaction.reactors.length === 1 ? 'reaction' : 'reactions'}`)
        .join('. ');

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const clearReactionHold = () => {
        if (reactionHoldTimerRef.current) {
            clearTimeout(reactionHoldTimerRef.current);
            reactionHoldTimerRef.current = null;
        }
    };

    const handleReactionPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType !== 'touch' || reactionCounts.length === 0) return;
        clearReactionHold();
        reactionHoldTriggeredRef.current = false;
        reactionTouchStartRef.current = { x: event.clientX, y: event.clientY };
        reactionHoldTimerRef.current = setTimeout(() => {
            reactionHoldTriggeredRef.current = true;
            setReactionPickerOpen(false);
            setReactionDetailsOpen(true);
        }, 500);
    };

    const handleReactionPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType !== 'touch') return;
        if (
            Math.abs(event.clientX - reactionTouchStartRef.current.x) > 10 ||
            Math.abs(event.clientY - reactionTouchStartRef.current.y) > 10
        ) {
            clearReactionHold();
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
        swipeOffsetRef.current = 0;
        swipeActiveRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            setReactionPickerOpen(true);
        }, 500);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const distanceX = event.clientX - touchStartRef.current.x;
        const distanceY = event.clientY - touchStartRef.current.y;
        if (
            event.pointerType === 'touch' &&
            viewerId &&
            !isInteractive(event.target) &&
            distanceX > 4 &&
            Math.abs(distanceX) > Math.abs(distanceY)
        ) {
            clearLongPress();
            swipeActiveRef.current = true;
            swipeOffsetRef.current = Math.min(distanceX * 0.65, 64);
            bubbleRef.current?.style.setProperty('--reply-swipe', `${swipeOffsetRef.current}px`);
            bubbleRef.current?.style.setProperty(
                '--reply-progress',
                String(Math.min(swipeOffsetRef.current / 48, 1))
            );
            bubbleRef.current?.setAttribute('data-swiping', 'true');
            return;
        }
        if (
            Math.abs(distanceX) > 10 ||
            Math.abs(distanceY) > 10
        ) {
            clearLongPress();
        }
    };

    const resetSwipe = () => {
        bubbleRef.current?.style.setProperty('--reply-swipe', '0px');
        bubbleRef.current?.style.setProperty('--reply-progress', '0');
        bubbleRef.current?.removeAttribute('data-swiping');
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        clearLongPress();
        if (swipeActiveRef.current) {
            const shouldReply = swipeOffsetRef.current >= 48;
            swipeActiveRef.current = false;
            swipeOffsetRef.current = 0;
            resetSwipe();
            if (shouldReply) {
                onReply({ id: message.id, memberId: message.memberId, content: message.content });
            }
            return;
        }
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
        const expiresAt = new Date(message.createdAt).getTime() + MESSAGE_EDIT_WINDOW_MS;
        const remaining = expiresAt - Date.now();
        setCanModify(canModifyMessage(message.createdAt));

        if (remaining <= 0) return;
        const timer = window.setTimeout(() => {
            setCanModify(false);
            setEditing(false);
        }, remaining);
        return () => window.clearTimeout(timer);
    }, [message.createdAt]);

    useEffect(() => {
        if (!optionsOpen && !reactionPickerOpen && !reactionDetailsOpen) return;

        const handleOutsidePointer = (event: PointerEvent) => {
            const target = event.target as Node;
            if (optionsOpen && !optionsRef.current?.contains(target)) setOptionsOpen(false);
            if (reactionPickerOpen && !reactionFormRef.current?.contains(target)) {
                setReactionPickerOpen(false);
            }
            if (reactionDetailsOpen && !reactionsRef.current?.contains(target)) {
                setReactionDetailsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsidePointer);
        return () => document.removeEventListener('pointerdown', handleOutsidePointer);
    }, [optionsOpen, reactionDetailsOpen, reactionPickerOpen]);

    useEffect(
        () => () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (reactionHoldTimerRef.current) clearTimeout(reactionHoldTimerRef.current);
        },
        []
    );

    return (
        <article
            ref={bubbleRef}
            className={`${styles.bubble} ${viewerId || reactionCounts.length > 0 ? styles.hasReactions : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
                clearLongPress();
                swipeActiveRef.current = false;
                swipeOffsetRef.current = 0;
                resetSwipe();
            }}
            onContextMenu={(event) => {
                if (lastPointerTypeRef.current === 'touch') event.preventDefault();
            }}
        >
            {viewerId && (
                <span className={styles.swipeReplyCue} aria-hidden="true">
                    <ReplyIcon />
                </span>
            )}
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
                    {viewerId && (
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
                                            onReply({
                                                id: message.id,
                                                memberId: message.memberId,
                                                content: message.content,
                                            });
                                            setOptionsOpen(false);
                                        }}
                                    >
                                        <ReplyIcon />
                                        Reply
                                    </button>
                                    {own && (
                                        <>
                                            <button
                                                type="button"
                                                disabled={!canModify}
                                                title={!canModify ? 'Messages can only be edited within 15 minutes.' : undefined}
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
                                                <button
                                                    type="submit"
                                                    disabled={isDeleting || !canModify}
                                                    title={!canModify ? 'Messages can only be deleted within 15 minutes.' : undefined}
                                                >
                                                    <BinIcon />
                                                    {isDeleting ? 'Removing…' : 'Delete'}
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </span>
                            )}
                        </span>
                    )}
                </span>
            </header>
            {message.replyTo && (
                <blockquote className={styles.quotedMessage}>
                    <strong>
                        {message.replyTo.memberId === viewerId
                            ? 'You'
                            : (replyAuthor?.name ?? 'Former member')}
                    </strong>
                    <span>{message.replyTo.content}</span>
                </blockquote>
            )}
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
                <div ref={reactionsRef} className={styles.reactions}>
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
                                onMouseEnter={() => reactionCounts.length > 0 && setReactionDetailsOpen(true)}
                                onMouseLeave={() => setReactionDetailsOpen(false)}
                                onPointerDown={handleReactionPointerDown}
                                onPointerMove={handleReactionPointerMove}
                                onPointerUp={clearReactionHold}
                                onPointerCancel={clearReactionHold}
                                onClick={() => {
                                    if (reactionHoldTriggeredRef.current) {
                                        reactionHoldTriggeredRef.current = false;
                                        return;
                                    }
                                    setReactionDetailsOpen(false);
                                    setReactionPickerOpen((open) => !open);
                                }}
                            >
                                {reactionCounts.length > 0 ? (
                                    reactionCounts.map((reaction) => (
                                        <span className={styles.reactionBadge} key={reaction.type}>
                                            <span aria-hidden="true">{reaction.emoji}</span>
                                                <span>{reaction.reactors.length}</span>
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
                            {reactionDetailsOpen && reactionCounts.length > 0 && (
                                <span className={styles.reactionDetails} role="tooltip">
                                    {reactionCounts.map((reaction) => (
                                        <span className={styles.reactionDetailRow} key={reaction.type}>
                                            <span aria-hidden="true">{reaction.emoji}</span>
                                            <span>{reaction.reactors.join(', ')}</span>
                                        </span>
                                    ))}
                                </span>
                            )}
                        </form>
                    ) : (
                        <span className={styles.reactionControl}>
                            <span
                                className={styles.reactionToggle}
                                role="img"
                                aria-label={reactionSummary}
                                onMouseEnter={() => setReactionDetailsOpen(true)}
                                onMouseLeave={() => setReactionDetailsOpen(false)}
                                onPointerDown={handleReactionPointerDown}
                                onPointerMove={handleReactionPointerMove}
                                onPointerUp={clearReactionHold}
                                onPointerCancel={clearReactionHold}
                            >
                                {reactionCounts.map((reaction) => (
                                    <span className={styles.reactionBadge} key={reaction.type}>
                                        <span aria-hidden="true">{reaction.emoji}</span>
                                        <span>{reaction.reactors.length}</span>
                                    </span>
                                ))}
                            </span>
                            {reactionDetailsOpen && (
                                <span className={styles.reactionDetails} role="tooltip">
                                    {reactionCounts.map((reaction) => (
                                        <span className={styles.reactionDetailRow} key={reaction.type}>
                                            <span aria-hidden="true">{reaction.emoji}</span>
                                            <span>{reaction.reactors.join(', ')}</span>
                                        </span>
                                    ))}
                                </span>
                            )}
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
    const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
    const [replyTo, setReplyTo] = useState<MessageReply | null>(null);
    const [isPending, startTransition] = useTransition();
    const composerInputRef = useRef<HTMLTextAreaElement>(null);
    const conversationRef = useRef<HTMLDivElement>(null);
    const markedReadRef = useRef(false);
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
        if (markedReadRef.current) return;
        markedReadRef.current = true;
        void markMessagesRead().catch(() => { markedReadRef.current = false; });
    }, []);

    useEffect(() => {
        const confirmedIds = new Set(messages.map((message) => message.id));
        setOptimisticMessages((current) => {
            const pending = current.filter(
                (message) => !message.serverId || !confirmedIds.has(message.serverId)
            );
            return pending.length === current.length ? current : pending;
        });
    }, [messages]);

    useEffect(() => {
        if (optimisticMessages.length === 0) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            const conversation = conversationRef.current;
            conversation?.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' });
        });
        return () => cancelAnimationFrame(frame);
    }, [optimisticMessages]);

    const sendOptimisticMessage = (clientId: string, content: string, reply?: MessageReply) => {
        setOptimisticMessages((current) =>
            current.map((message) =>
                message.clientId === clientId
                    ? { ...message, status: 'sending', error: undefined }
                    : message
            )
        );

        startTransition(async () => {
            const formData = new FormData();
            formData.set('content', content);
            if (reply) formData.set('replyToId', reply.id);

            try {
                const result = await postMessage(initial, formData);
                if (!result.ok || !result.messageId) {
                    setOptimisticMessages((current) =>
                        current.map((message) =>
                            message.clientId === clientId
                                ? {
                                    ...message,
                                    status: 'failed',
                                    error: result.error ?? 'Could not share that post.',
                                }
                                : message
                        )
                    );
                    return;
                }

                setOptimisticMessages((current) =>
                    current.map((message) =>
                        message.clientId === clientId
                            ? { ...message, status: 'confirmed', serverId: result.messageId }
                            : message
                    )
                );
            } catch {
                setOptimisticMessages((current) =>
                    current.map((message) =>
                        message.clientId === clientId
                            ? { ...message, status: 'failed', error: 'Could not share that post.' }
                            : message
                    )
                );
            }
        });
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const content = String(new FormData(form).get('content') ?? '').trim();
        if (!content) {
            return;
        }

        const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const selectedReply = replyTo ?? undefined;
        setOptimisticMessages((current) => [
            ...current,
            {
                clientId,
                content,
                createdAt: new Date().toISOString(),
                status: 'sending',
                replyTo: selectedReply,
            },
        ]);
        setReplyTo(null);
        form.reset();
        composerInputRef.current?.style.removeProperty('height');
        setFilterMode('all');
        setFilterValue('');
        sendOptimisticMessage(clientId, content, selectedReply);
    };

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
        <section className={styles.chatShell} aria-label="Group chat">
            <PageHeader
                eyebrow="Chat"
                title="Keep moving together"
                actions={messages.length > 0 ? filterControls : undefined}
            />
            <div className={styles.board}>
                <div ref={conversationRef} className={styles.conversation}>
                    {filteredMessages.length > 0 || optimisticMessages.length > 0 ? (
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
                                                replyAuthor={message.replyTo ? memberById.get(message.replyTo.memberId) : undefined}
                                                memberById={memberById}
                                                own={own}
                                                viewerId={viewerId}
                                                onReply={(selected) => {
                                                    setReplyTo(selected);
                                                    requestAnimationFrame(() => composerInputRef.current?.focus());
                                                }}
                                            />
                                        </li>
                                    </Fragment>
                                );
                            })}
                            {optimisticMessages.map((message) => (
                                <li
                                    className={`${styles.message} ${styles.own}`}
                                    key={message.clientId}
                                    style={
                                        {
                                            '--message-accent': viewerId
                                                ? accentHex[memberById.get(viewerId)?.accent ?? 'blue']
                                                : 'var(--c-accent)',
                                        } as CSSProperties
                                    }
                                >
                                    <article
                                        className={`${styles.bubble} ${styles.optimisticBubble} ${message.status === 'failed' ? styles.failedBubble : ''
                                            }`}
                                    >
                                        <div className={styles.meta}>
                                            <span className={styles.author}>
                                                {viewerId && memberById.get(viewerId) && (
                                                    <MemberAvatar member={memberById.get(viewerId)!} size="1.5rem" />
                                                )}
                                                <strong>You</strong>
                                            </span>
                                            <span className={styles.deliveryState}>
                                                {message.status === 'failed' ? (
                                                    <>
                                                        <span role="alert">Not sent</span>
                                                        <button
                                                            type="button"
                                                            className={styles.retryButton}
                                                            aria-label="Retry sending message"
                                                            title={message.error}
                                                            onClick={() =>
                                                                sendOptimisticMessage(
                                                                    message.clientId,
                                                                    message.content,
                                                                    message.replyTo
                                                                )
                                                            }
                                                        >
                                                            <ResyncIcon size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span>{message.status === 'sending' ? 'Sending…' : 'Sent'}</span>
                                                )}
                                            </span>
                                        </div>
                                        {message.replyTo && (
                                            <blockquote className={styles.quotedMessage}>
                                                <strong>
                                                    {message.replyTo.memberId === viewerId
                                                        ? 'You'
                                                        : (memberById.get(message.replyTo.memberId)?.name ?? 'Former member')}
                                                </strong>
                                                <span>{message.replyTo.content}</span>
                                            </blockquote>
                                        )}
                                        <p>{message.content}</p>
                                    </article>
                                </li>
                            ))}
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
                    <form onSubmit={handleSubmit} className={styles.composer}>
                        <label className="sr-only" htmlFor="chat-message">Share something with the group</label>
                        {replyTo && (
                            <div className={styles.replyPreview}>
                                <span>
                                    <strong>
                                        Replying to{' '}
                                        {replyTo.memberId === viewerId
                                            ? 'yourself'
                                            : (memberById.get(replyTo.memberId)?.name ?? 'Former member')}
                                    </strong>
                                    <span>{replyTo.content}</span>
                                </span>
                                <button
                                    type="button"
                                    aria-label="Cancel reply"
                                    onClick={() => setReplyTo(null)}
                                >
                                    <CrossIcon size={14} />
                                </button>
                            </div>
                        )}
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
                    </form>
                ) : (
                    <p className={styles.choosePerson}>Choose who you are from Profile to share a post.</p>
                )}
            </div>
        </section>
    );
};

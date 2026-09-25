'use client';

import { BinIcon, MoreIcon, PencilIcon } from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import { useRouter } from 'next/navigation';
import { type CSSProperties, Fragment, useActionState, useEffect, useRef, useState } from 'react';
import {
    type ActionState,
    deleteMessage,
    editMessage,
    markMessagesRead,
    postMessage,
} from '@/app/actions';
import type { Member, MessagePost } from '@/types/fitness';

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
}: {
    message: MessagePost;
    author?: Member;
    own: boolean;
}) => {
    const [editing, setEditing] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [editState, editAction, isEditing] = useActionState(editMessage, initial);
    const [deleteState, deleteAction, isDeleting] = useActionState(deleteMessage, initial);

    useEffect(() => {
        if (editState.ok && editState.bookedAt) {
            setEditing(false);
        }
    }, [editState.ok, editState.bookedAt]);

    return (
        <article className={styles.bubble}>
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
                        <span className={styles.options}>
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
            {(editState.error || deleteState.error) && (
                <span className={styles.messageError} role="alert">
                    {editState.error ?? deleteState.error}
                </span>
            )}
        </article>
    );
};

export const MessageBoard = ({ members, messages, viewerId }: MessageBoardProps) => {
    const [state, formAction, isPending] = useActionState(postMessage, initial);
    const formRef = useRef<HTMLFormElement>(null);
    const router = useRouter();
    const [filterMode, setFilterMode] = useState<'all' | 'date' | 'month'>('all');
    const [filterValue, setFilterValue] = useState('');
    const memberById = new Map(members.map((member) => [member.id, member]));
    const filteredMessages = [...messages]
        .filter((message) => {
            if (filterMode === 'all' || !filterValue) {
                return true;
            }
            const date = localDateKey(message.createdAt);
            return filterMode === 'date' ? date === filterValue : date.startsWith(filterValue);
        })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    useEffect(() => {
        void markMessagesRead().then(() => router.refresh());
    }, [router]);

    useEffect(() => {
        if (state.ok && state.bookedAt) {
            formRef.current?.reset();
        }
    }, [state.ok, state.bookedAt]);

    return (
        <section className={styles.board} aria-label="Group chat">
            {messages.length > 0 && (
                <div className={styles.filters}>
                    <label>
                        <span>Show</span>
                        <select
                            value={filterMode}
                            onChange={(event) => {
                                setFilterMode(event.target.value as 'all' | 'date' | 'month');
                                setFilterValue('');
                            }}
                        >
                            <option value="all">All messages</option>
                            <option value="date">A date</option>
                            <option value="month">A month</option>
                        </select>
                    </label>
                    {filterMode !== 'all' && (
                        <label>
                            <span>{filterMode === 'date' ? 'Date' : 'Month'}</span>
                            <input
                                type={filterMode === 'date' ? 'date' : 'month'}
                                value={filterValue}
                                onChange={(event) => setFilterValue(event.target.value)}
                            />
                        </label>
                    )}
                </div>
            )}

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
                                        <MessageBubble message={message} author={author} own={own} />
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
                    <label htmlFor="chat-message">Share something with the group</label>
                    <div className={styles.composeRow}>
                        <textarea
                            id="chat-message"
                            name="content"
                            rows={2}
                            maxLength={500}
                            placeholder="A win, a reminder, or some motivation…"
                            required
                        />
                        <button type="submit" disabled={isPending}>
                            {isPending ? 'Sharing…' : 'Share'}
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
    );
};
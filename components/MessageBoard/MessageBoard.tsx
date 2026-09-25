'use client';

import { accentHex } from '@data/fitnessData';
import { useRouter } from 'next/navigation';
import { type CSSProperties, Fragment, useActionState, useEffect, useRef, useState } from 'react';
import { type ActionState, markMessagesRead, postMessage } from '@/app/actions';
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
                                    {!own && (
                                        <span className={styles.avatar} aria-hidden="true">
                                            {author?.name.charAt(0).toUpperCase() ?? '?'}
                                        </span>
                                    )}
                                    <article className={styles.bubble}>
                                        <header className={styles.meta}>
                                            <strong>{own ? 'You' : (author?.name ?? 'Former member')}</strong>
                                            <time dateTime={message.createdAt}>
                                                {messageTime.format(new Date(message.createdAt))}
                                            </time>
                                        </header>
                                        <p>{message.content}</p>
                                    </article>
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
        </section>
    );
};
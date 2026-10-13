import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Chat, MessageStatus } from '../types';
import { formatPhone, formatTime, initials } from '../utils/format';
import { Avatar } from './Avatar';

interface Props {
  chat: Chat;
  onSend: (text: string) => void;
  onBack: () => void;
}

const STATUS_ICON: Record<MessageStatus, string> = {
  pending: '🕓',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '!',
};

const STATUS_TITLE: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
};

const MAX_LENGTH = 4000; // лимит SendMessage

export function ChatWindow({ chat, onSend, onBack }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, chat.chatId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.chatId]);

  function send() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter — отправить, Shift+Enter — перенос строки
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section className="chat">
      <header className="chat__header">
        <button className="icon-btn chat__back" onClick={onBack} aria-label="Назад к чатам">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <Avatar seed={chat.chatId} text={initials(chat.name)} size={40} />
        <div>
          <div className="chat__title">{chat.name}</div>
          <div className="muted small">{chat.phone ? formatPhone(chat.phone) : `ID ${chat.chatId}`}</div>
        </div>
      </header>

      <div className="chat__messages" ref={listRef}>
        {chat.messages.length === 0 && <div className="chat__hint">Напишите первое сообщение — оно уйдёт в MAX</div>}
        {chat.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.outgoing ? 'bubble--out' : 'bubble--in'} ${m.status === 'failed' ? 'bubble--failed' : ''}`}>
            <span className="bubble__text">{m.text}</span>
            <span className="bubble__meta">
              {formatTime(m.timestamp)}
              {m.outgoing && m.status && (
                <span className={`tick tick--${m.status}`} title={STATUS_TITLE[m.status]}>
                  {STATUS_ICON[m.status]}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <footer className="composer">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={onKeyDown}
          placeholder="Сообщение"
          rows={1}
        />
        <button className="send-btn" onClick={send} disabled={!text.trim()} aria-label="Отправить">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" /></svg>
        </button>
      </footer>
    </section>
  );
}

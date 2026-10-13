import { useState, type FormEvent } from 'react';
import type { Chat } from '../types';
import type { ConnectionState } from '../hooks/useNotifications';
import { formatPhone, formatTime, initials, isValidPhone, normalizePhone } from '../utils/format';
import { Avatar } from './Avatar';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  connection: ConnectionState;
  idInstance: string;
  onSelect: (chatId: string) => void;
  onCreate: (phone: string) => Promise<void>;
  onLogout: () => void;
}

const CONNECTION_TEXT: Record<ConnectionState, string> = {
  connecting: 'Подключение…',
  online: 'В сети',
  error: 'Нет связи, переподключаемся…',
};

export function Sidebar({ chats, activeChatId, connection, idInstance, onSelect, onCreate, onLogout }: Props) {
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (!isValidPhone(digits)) {
      setError('Номер РФ (+7) или РБ (+375) в международном формате');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreate(digits);
      setPhone('');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат');
    } finally {
      setLoading(false);
    }
  }

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const visible = q ? chats.filter((c) => c.name.toLowerCase().includes(q) || (qDigits !== '' && c.phone.includes(qDigits))) : chats;

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div>
          <h2>Чаты</h2>
          <span className={`status status--${connection}`}>{CONNECTION_TEXT[connection]}</span>
        </div>
        <div className="sidebar__actions">
          <button className="icon-btn" title="Новый чат" aria-label="Новый чат" onClick={() => setAdding((v) => !v)}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <button className="icon-btn" title={`Выйти (инстанс ${idInstance})`} aria-label="Выйти" onClick={onLogout}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          </button>
        </div>
      </header>

      {adding && (
        <form className="new-chat" onSubmit={submit}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Номер получателя, +7 999 123-45-67" inputMode="tel" autoFocus />
          <button className="btn btn--small" disabled={loading || !phone}>
            {loading ? '…' : 'Создать'}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      <div className="search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" />
      </div>

      <ul className="chat-list">
        {visible.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          return (
            <li key={chat.chatId}>
              <button className={`chat-item ${chat.chatId === activeChatId ? 'chat-item--active' : ''}`} onClick={() => onSelect(chat.chatId)}>
                <Avatar seed={chat.chatId} text={initials(chat.name)} />
                <div className="chat-item__body">
                  <div className="chat-item__row">
                    <span className="chat-item__name">{chat.name}</span>
                    {last && <span className="chat-item__time">{formatTime(last.timestamp)}</span>}
                  </div>
                  <div className="chat-item__row">
                    <span className="chat-item__preview">
                      {last ? `${last.outgoing ? 'Вы: ' : ''}${last.text}` : formatPhone(chat.phone)}
                    </span>
                    {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {chats.length === 0 && (
          <li className="chat-list__empty">
            Чатов пока нет.
            <br />
            Нажмите «+», чтобы написать по номеру телефона.
          </li>
        )}
      </ul>
    </aside>
  );
}

import { useCallback, useEffect, useReducer, useState } from 'react';
import { checkAccount, sendMessage } from './api/greenApi';
import { ChatWindow } from './components/ChatWindow';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { useNotifications } from './hooks/useNotifications';
import { initialState, reducer, type ChatEvent, type State } from './store';
import type { Credentials } from './types';
import { formatPhone } from './utils/format';

const CREDS_KEY = 'max-chat:creds';
const chatsKey = (id: string) => `max-chat:chats:${id}`;

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(() => load<Credentials>(CREDS_KEY));
  if (!creds) {
    return (
      <Login
        onLogin={(c) => {
          localStorage.setItem(CREDS_KEY, JSON.stringify(c));
          setCreds(c);
        }}
      />
    );
  }
  return (
    <Messenger
      key={creds.idInstance}
      creds={creds}
      onLogout={() => {
        localStorage.removeItem(CREDS_KEY);
        setCreds(null);
      }}
    />
  );
}

function Messenger({ creds, onLogout }: { creds: Credentials; onLogout: () => void }) {
  // История чатов хранится локально в браузере, отдельно для каждого инстанса
  const [state, dispatch] = useReducer(reducer, initialState, (init): State => {
    const saved = load<State>(chatsKey(creds.idInstance));
    return saved ? { ...saved, activeChatId: null } : init;
  });

  useEffect(() => {
    localStorage.setItem(chatsKey(creds.idInstance), JSON.stringify(state));
  }, [state, creds.idInstance]);

  const onEvent = useCallback((event: ChatEvent) => dispatch({ type: 'event', event }), []);
  const { state: connection } = useNotifications(creds, onEvent);

  async function createChat(phone: string) {
    let chatId = `${phone}@c.us`; // запасной вариант, который допускает SendMessage
    try {
      const res = await checkAccount(creds, phone);
      if (res.exist === false) throw new Error('У этого номера нет аккаунта MAX');
      if (res.exist && res.chatId) chatId = res.chatId;
    } catch (e) {
      if (e instanceof Error && e.message.includes('нет аккаунта MAX')) throw e;
      // CheckAccount недоступен (лимит и т.п.) — отправим по номеру; настоящий chatId
      // придёт с первым ответом, и стор сам переключит чат на него
    }
    dispatch({ type: 'createChat', chat: { chatId, phone, name: formatPhone(phone) } });
  }

  async function send(chatId: string, text: string) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({ type: 'sendStart', chatId, message: { id: tempId, text, outgoing: true, timestamp: Date.now(), status: 'pending' } });
    try {
      const { idMessage } = await sendMessage(creds, chatId, text);
      dispatch({ type: 'sendSuccess', chatId, tempId, idMessage });
    } catch {
      dispatch({ type: 'sendFail', chatId, tempId });
    }
  }

  const active = state.chats.find((c) => c.chatId === state.activeChatId) ?? null;

  return (
    <div className={`app ${active ? 'app--chat-open' : ''}`}>
      <Sidebar
        chats={state.chats}
        activeChatId={state.activeChatId}
        connection={connection}
        idInstance={creds.idInstance}
        onSelect={(chatId) => dispatch({ type: 'selectChat', chatId })}
        onCreate={createChat}
        onLogout={onLogout}
      />
      {active ? (
        <ChatWindow chat={active} onSend={(text) => send(active.chatId, text)} onBack={() => dispatch({ type: 'selectChat', chatId: null })} />
      ) : (
        <section className="placeholder">
          <div>
            <div className="placeholder__icon">💬</div>
            <p>Выберите чат или создайте новый по номеру телефона</p>
          </div>
        </section>
      )}
    </div>
  );
}

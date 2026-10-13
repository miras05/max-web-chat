import type { Chat, Message, MessageStatus, Notification } from './types';
import { formatPhone } from './utils/format';

/* ---------- Разбор уведомлений GREEN-API ---------- */

export type ChatEvent =
  | { kind: 'message'; chatId: string; phone?: string; name?: string; message: Message }
  | { kind: 'status'; idMessage: string; status: MessageStatus };

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
};

/**
 * Превращает уведомление в событие чата. Нас интересуют только текстовые сообщения
 * (входящие, отправленные с телефона, отправленные через API) и статусы доставки.
 * Всё остальное возвращает null — такие уведомления просто удаляются из очереди.
 */
export function parseNotification(body: Notification['body']): ChatEvent | null {
  const { typeWebhook } = body;

  if (typeWebhook === 'outgoingMessageStatus' && body.idMessage && body.status) {
    const status = STATUS_MAP[body.status];
    return status ? { kind: 'status', idMessage: body.idMessage, status } : null;
  }

  const isIncoming = typeWebhook === 'incomingMessageReceived';
  const isOutgoing = typeWebhook === 'outgoingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived';
  if (!isIncoming && !isOutgoing) return null;

  const data = body.messageData;
  const text =
    data?.typeMessage === 'textMessage'
      ? data.textMessageData?.textMessage
      : data?.typeMessage === 'extendedTextMessage'
        ? data.extendedTextMessageData?.text
        : undefined;
  if (!text || !body.senderData || !body.idMessage) return null; // только текст — по ТЗ

  const s = body.senderData;
  return {
    kind: 'message',
    chatId: s.chatId,
    phone: isIncoming && s.senderPhoneNumber ? String(s.senderPhoneNumber) : undefined,
    name: isIncoming ? s.senderContactName || s.senderName || s.chatName : s.chatName,
    message: {
      id: body.idMessage,
      text,
      outgoing: isOutgoing,
      timestamp: (body.timestamp ?? Date.now() / 1000) * 1000,
      status: isOutgoing ? 'sent' : undefined,
    },
  };
}

/* ---------- Состояние приложения ---------- */

export interface State {
  chats: Chat[];
  activeChatId: string | null;
}

export type Action =
  | { type: 'createChat'; chat: Omit<Chat, 'messages' | 'unread'> }
  | { type: 'selectChat'; chatId: string | null }
  | { type: 'sendStart'; chatId: string; message: Message }
  | { type: 'sendSuccess'; chatId: string; tempId: string; idMessage: string }
  | { type: 'sendFail'; chatId: string; tempId: string }
  | { type: 'event'; event: ChatEvent };

export const initialState: State = { chats: [], activeChatId: null };

function mapChat(state: State, chatId: string, fn: (c: Chat) => Chat): State {
  return { ...state, chats: state.chats.map((c) => (c.chatId === chatId ? fn(c) : c)) };
}

/** Чат наверх списка — как в мессенджерах */
function bump(state: State, chatId: string): State {
  const chat = state.chats.find((c) => c.chatId === chatId);
  return chat ? { ...state, chats: [chat, ...state.chats.filter((c) => c !== chat)] } : state;
}

function setStatus(messages: Message[], id: string, status: MessageStatus): Message[] {
  const order: MessageStatus[] = ['pending', 'sent', 'delivered', 'read'];
  return messages.map((m) => {
    if (m.id !== id) return m;
    // статусы могут прийти не по порядку — не откатываем «прочитано» на «доставлено»
    if (status !== 'failed' && m.status && order.indexOf(m.status) > order.indexOf(status)) return m;
    return { ...m, status };
  });
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'createChat': {
      const exists = state.chats.find((c) => c.chatId === action.chat.chatId || c.phone === action.chat.phone);
      if (exists) return { ...state, activeChatId: exists.chatId };
      return {
        chats: [{ ...action.chat, messages: [], unread: 0 }, ...state.chats],
        activeChatId: action.chat.chatId,
      };
    }

    case 'selectChat':
      return {
        ...(action.chatId ? mapChat(state, action.chatId, (c) => ({ ...c, unread: 0 })) : state),
        activeChatId: action.chatId,
      };

    case 'sendStart':
      return bump(mapChat(state, action.chatId, (c) => ({ ...c, messages: [...c.messages, action.message] })), action.chatId);

    case 'sendSuccess':
      return mapChat(state, action.chatId, (c) => ({
        ...c,
        // вебхук outgoingAPIMessageReceived мог прийти раньше ответа sendMessage — убираем дубль
        messages: c.messages
          .filter((m) => m.id !== action.idMessage)
          .map((m) => (m.id === action.tempId ? { ...m, id: action.idMessage, status: 'sent' as const } : m)),
      }));

    case 'sendFail':
      return mapChat(state, action.chatId, (c) => ({ ...c, messages: setStatus(c.messages, action.tempId, 'failed') }));

    case 'event': {
      const ev = action.event;

      if (ev.kind === 'status') {
        return {
          ...state,
          chats: state.chats.map((c) =>
            c.messages.some((m) => m.id === ev.idMessage) ? { ...c, messages: setStatus(c.messages, ev.idMessage, ev.status) } : c,
          ),
        };
      }

      // Ищем чат по chatId, а если чат создан по номеру — по номеру отправителя
      let chat = state.chats.find((c) => c.chatId === ev.chatId) ?? (ev.phone ? state.chats.find((c) => c.phone === ev.phone) : undefined);
      let next = state;

      if (!chat) {
        // Новый собеседник написал первым — заводим чат автоматически
        chat = { chatId: ev.chatId, phone: ev.phone ?? '', name: ev.name || (ev.phone ? formatPhone(ev.phone) : ev.chatId), messages: [], unread: 0 };
        next = { ...state, chats: [chat, ...state.chats] };
      } else if (chat.chatId !== ev.chatId) {
        // Чат был создан по phone@c.us — переводим на настоящий chatId MAX
        const oldId = chat.chatId;
        next = {
          chats: state.chats.map((c) => (c.chatId === oldId ? { ...c, chatId: ev.chatId } : c)),
          activeChatId: state.activeChatId === oldId ? ev.chatId : state.activeChatId,
        };
      }

      const target = next.chats.find((c) => c.chatId === ev.chatId)!;
      if (target.messages.some((m) => m.id === ev.message.id)) return next; // уже есть (отправили сами)

      const isActive = next.activeChatId === ev.chatId;
      next = mapChat(next, ev.chatId, (c) => ({
        ...c,
        // пока чат назван номером телефона — подставляем имя из MAX
        name: !ev.message.outgoing && ev.name && (!c.name || c.name === formatPhone(c.phone)) ? ev.name : c.name,
        messages: [...c.messages, ev.message].sort((a, b) => a.timestamp - b.timestamp),
        unread: !ev.message.outgoing && !isActive ? c.unread + 1 : c.unread,
      }));
      return bump(next, ev.chatId);
    }
  }
}

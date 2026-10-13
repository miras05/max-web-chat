import { describe, expect, it } from 'vitest';
import { initialState, parseNotification, reducer, type State } from './store';
import type { Message, Notification } from './types';

const incoming = (over: Partial<Notification['body']> = {}): Notification['body'] => ({
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1_700_000_000,
  idMessage: 'in-1',
  senderData: { chatId: 'max-42', senderName: 'Иван', senderPhoneNumber: 79161234567 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
  ...over,
});

const outgoingMsg = (id: string): Message => ({ id, text: 'Здравствуйте', outgoing: true, timestamp: 1, status: 'pending' });

function withChat(chatId = 'max-42', phone = '79161234567'): State {
  return reducer(initialState, { type: 'createChat', chat: { chatId, phone, name: '+7 916 123-45-67' } });
}

describe('parseNotification', () => {
  it('parses an incoming text message', () => {
    const ev = parseNotification(incoming());
    expect(ev).toMatchObject({ kind: 'message', chatId: 'max-42', phone: '79161234567', name: 'Иван' });
    expect(ev?.kind === 'message' && ev.message).toMatchObject({ text: 'Привет', outgoing: false, timestamp: 1_700_000_000_000 });
  });

  it('parses extended text and outgoing API messages', () => {
    const ev = parseNotification(
      incoming({
        typeWebhook: 'outgoingAPIMessageReceived',
        messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'Ссылка' } },
      }),
    );
    expect(ev?.kind === 'message' && ev.message).toMatchObject({ text: 'Ссылка', outgoing: true, status: 'sent' });
  });

  it('maps delivery statuses', () => {
    expect(parseNotification({ typeWebhook: 'outgoingMessageStatus', idMessage: 'x', status: 'read' })).toEqual({
      kind: 'status',
      idMessage: 'x',
      status: 'read',
    });
    expect(parseNotification({ typeWebhook: 'outgoingMessageStatus', idMessage: 'x', status: 'noAccount' })).toMatchObject({
      status: 'failed',
    });
  });

  it('ignores media and service notifications', () => {
    expect(parseNotification(incoming({ messageData: { typeMessage: 'imageMessage' } }))).toBeNull();
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged' })).toBeNull();
  });
});

describe('reducer', () => {
  it('does not create a duplicate chat for the same phone', () => {
    const state = reducer(withChat(), { type: 'createChat', chat: { chatId: 'other', phone: '79161234567', name: 'x' } });
    expect(state.chats).toHaveLength(1);
  });

  it('removes the duplicate when the webhook arrives before the sendMessage response', () => {
    let state = reducer(withChat(), { type: 'sendStart', chatId: 'max-42', message: outgoingMsg('tmp-1') });
    const webhook = parseNotification(incoming({ typeWebhook: 'outgoingAPIMessageReceived', idMessage: 'real-1' }))!;
    state = reducer(state, { type: 'event', event: webhook });
    state = reducer(state, { type: 'sendSuccess', chatId: 'max-42', tempId: 'tmp-1', idMessage: 'real-1' });

    const ids = state.chats[0].messages.map((m) => m.id);
    expect(ids).toEqual(['real-1']);
  });

  it('never downgrades a status that arrives out of order', () => {
    let state = reducer(withChat(), { type: 'sendStart', chatId: 'max-42', message: { ...outgoingMsg('m1'), status: 'sent' } });
    state = reducer(state, { type: 'event', event: { kind: 'status', idMessage: 'm1', status: 'read' } });
    state = reducer(state, { type: 'event', event: { kind: 'status', idMessage: 'm1', status: 'delivered' } });
    expect(state.chats[0].messages[0].status).toBe('read');
  });

  it('creates a chat when a new contact writes first and counts unread', () => {
    const state = reducer(initialState, { type: 'event', event: parseNotification(incoming())! });
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({ chatId: 'max-42', name: 'Иван', unread: 1 });
  });

  it('switches a chat created by phone to the real MAX chatId on first reply', () => {
    let state = withChat('79161234567@c.us', '79161234567');
    state = reducer(state, { type: 'event', event: parseNotification(incoming())! });

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].chatId).toBe('max-42');
    expect(state.activeChatId).toBe('max-42');
    expect(state.chats[0].messages).toHaveLength(1);
  });

  it('ignores the same incoming message delivered twice', () => {
    const ev = parseNotification(incoming())!;
    let state = reducer(initialState, { type: 'event', event: ev });
    state = reducer(state, { type: 'event', event: ev });
    expect(state.chats[0].messages).toHaveLength(1);
  });
});

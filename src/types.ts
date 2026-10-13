export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string; // idMessage из GREEN-API (или временный id до ответа сервера)
  text: string;
  outgoing: boolean;
  timestamp: number; // мс
  status?: MessageStatus;
}

export interface Chat {
  chatId: string; // идентификатор чата MAX
  phone: string; // номер, по которому создан чат (только цифры)
  name: string;
  messages: Message[];
  unread: number;
}

/** Уведомление из очереди GREEN-API (нужные нам поля) */
export interface Notification {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;
    status?: string;
    chatId?: string;
    senderData?: {
      chatId: string;
      chatName?: string;
      senderName?: string;
      senderContactName?: string;
      senderPhoneNumber?: number;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      extendedTextMessageData?: { text: string };
    };
  };
}

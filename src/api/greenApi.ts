import type { Credentials, Notification } from '../types';

/**
 * Клиент GREEN-API для MAX (v3).
 * Формат запросов: {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 * Документация: https://green-api.com/v3/docs/request-format/
 */

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** apiUrl зависит от кластера: первые 4 цифры idInstance → https://3100.api.green-api.com */
export function defaultApiUrl(idInstance: string): string {
  const digits = idInstance.replace(/\D/g, '');
  return digits.length >= 4 ? `https://${digits.slice(0, 4)}.api.green-api.com` : 'https://api.green-api.com';
}

function url(c: Credentials, method: string, suffix = ''): string {
  const base = c.apiUrl.replace(/\/+$/, '');
  return `${base}/waInstance${c.idInstance}/${method}/${c.apiTokenInstance}${suffix}`;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError('Нет соединения с GREEN-API. Проверьте интернет и apiUrl.');
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError('Неверный idInstance или apiTokenInstance', res.status);
    }
    if (res.status === 466) throw new ApiError('Превышен лимит тарифа Developer', res.status);
    throw new ApiError(text || `Ошибка ${res.status}`, res.status);
  }
  // ReceiveNotification при пустой очереди возвращает пустое тело / null
  return (text ? JSON.parse(text) : null) as T;
}

/** Проверка учётных данных и статуса авторизации инстанса */
export function getStateInstance(c: Credentials) {
  return request<{ stateInstance: string }>(url(c, 'getStateInstance'));
}

/** Получить chatId пользователя MAX по номеру телефона */
export function checkAccount(c: Credentials, phone: string) {
  return request<{ exist?: boolean; chatId?: string; status?: boolean; reason?: string }>(
    url(c, 'checkAccount'),
    { method: 'POST', body: JSON.stringify({ phoneNumber: Number(phone) }) },
  );
}

/** Отправка текстового сообщения — https://green-api.com/v3/docs/api/sending/SendMessage/ */
export function sendMessage(c: Credentials, chatId: string, message: string) {
  return request<{ idMessage: string }>(url(c, 'sendMessage'), {
    method: 'POST',
    body: JSON.stringify({ chatId, message }),
  });
}

/** Получение уведомления из очереди (long polling до receiveTimeout секунд) */
export function receiveNotification(c: Credentials, receiveTimeout = 5) {
  return request<Notification | null>(url(c, 'receiveNotification', `?receiveTimeout=${receiveTimeout}`));
}

/** Подтверждение обработки уведомления — удаляет его из очереди */
export function deleteNotification(c: Credentials, receiptId: number) {
  return request<{ result: boolean }>(url(c, 'deleteNotification', `/${receiptId}`), { method: 'DELETE' });
}

import { useEffect, useRef, useState } from 'react';
import { deleteNotification, receiveNotification } from '../api/greenApi';
import { parseNotification, type ChatEvent } from '../store';
import type { Credentials } from '../types';

export type ConnectionState = 'connecting' | 'online' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Получение сообщений по технологии HTTP API:
 * ReceiveNotification (long polling) → обработка → DeleteNotification.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/
 *
 * Очередь FIFO: пока уведомление не удалено, следующее не придёт,
 * поэтому удаляем ВСЕ уведомления, даже те, что приложению не нужны.
 */
export function useNotifications(creds: Credentials | null, onEvent: (e: ChatEvent) => void) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!creds) return;
    let stopped = false;

    (async () => {
      let backoff = 1000;
      while (!stopped) {
        try {
          const n = await receiveNotification(creds, 5);
          if (stopped) break;
          setState('online');
          setError(null);
          backoff = 1000;
          if (!n) continue; // за 5 секунд ничего не пришло

          const event = parseNotification(n.body);
          if (event) onEventRef.current(event);
          await deleteNotification(creds, n.receiptId);
        } catch (e) {
          if (stopped) break;
          setState('error');
          setError(e instanceof Error ? e.message : 'Ошибка получения сообщений');
          await sleep(backoff);
          backoff = Math.min(backoff * 2, 15000); // не долбим API при сбое
        }
      }
    })();

    return () => {
      stopped = true;
    };
  }, [creds]);

  return { state, error };
}

import { useState, type FormEvent } from 'react';
import { ApiError, defaultApiUrl, getStateInstance } from '../api/greenApi';
import type { Credentials } from '../types';

const STATE_TEXT: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован: привяжите аккаунт MAX в личном кабинете GREEN-API',
  blocked: 'Аккаунт MAX заблокирован',
  starting: 'Инстанс запускается, попробуйте через минуту',
  yellowCard: 'На аккаунте временные ограничения (yellowCard)',
};

export function Login({ onLogin }: { onLogin: (c: Credentials) => void }) {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const creds: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim() || defaultApiUrl(idInstance),
    };
    setLoading(true);
    setError(null);
    try {
      const { stateInstance } = await getStateInstance(creds);
      if (stateInstance !== 'authorized') {
        setError(STATE_TEXT[stateInstance] ?? `Статус инстанса: ${stateInstance}`);
        return;
      }
      onLogin(creds);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось подключиться');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="logo" aria-hidden>
          <span>M</span>
        </div>
        <h1>Вход в чат</h1>
        <p className="muted">Введите данные инстанса из личного кабинета GREEN-API</p>

        <label>
          idInstance
          <input value={idInstance} onChange={(e) => setIdInstance(e.target.value)} placeholder="3100000000" inputMode="numeric" required autoFocus />
        </label>
        <label>
          apiTokenInstance
          <input value={apiTokenInstance} onChange={(e) => setToken(e.target.value)} placeholder="d75b3a66374942c5b3c019c6…" type="password" required />
        </label>

        {showAdvanced ? (
          <label>
            apiUrl
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder={idInstance ? defaultApiUrl(idInstance) : 'https://3100.api.green-api.com'} />
          </label>
        ) : (
          <button type="button" className="link" onClick={() => setShowAdvanced(true)}>
            Указать apiUrl вручную
          </button>
        )}

        {error && <div className="error">{error}</div>}

        <button className="btn" disabled={loading || !idInstance || !apiTokenInstance}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

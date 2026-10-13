/** Оставляет только цифры, 8XXXXXXXXXX → 7XXXXXXXXXX */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
  return digits;
}

/** MAX через GREEN-API поддерживает номера РФ (7) и РБ (375): 11 или 12 цифр */
export function isValidPhone(digits: string): boolean {
  return (digits.length === 11 && digits.startsWith('7')) || (digits.length === 12 && digits.startsWith('375'));
}

export function formatPhone(digits: string): string {
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('375')) {
    return `+375 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  return digits ? `+${digits}` : '';
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).map((w) => w[0]);
  return (letters.slice(0, 2).join('') || '#').toUpperCase();
}

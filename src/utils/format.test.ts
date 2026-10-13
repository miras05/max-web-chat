import { describe, expect, it } from 'vitest';
import { formatPhone, initials, isValidPhone, normalizePhone } from './format';

describe('phone helpers', () => {
  it('normalises Russian numbers written with 8', () => {
    expect(normalizePhone('8 (916) 123-45-67')).toBe('79161234567');
    expect(normalizePhone('+7 916 123 45 67')).toBe('79161234567');
  });

  it('accepts only Russian and Belarusian numbers', () => {
    expect(isValidPhone('79161234567')).toBe(true);
    expect(isValidPhone('375291234567')).toBe(true);
    expect(isValidPhone('77011234567')).toBe(true); // +7 — Kazakhstan shares the code, MAX decides
    expect(isValidPhone('4915112345678')).toBe(false);
    expect(isValidPhone('12345')).toBe(false);
  });

  it('formats numbers for display', () => {
    expect(formatPhone('79161234567')).toBe('+7 916 123-45-67');
    expect(formatPhone('375291234567')).toBe('+375 29 123-45-67');
    expect(formatPhone('')).toBe('');
  });
});

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Иван Петров')).toBe('ИП');
    expect(initials('anna')).toBe('A');
    expect(initials('+7 916')).toBe('#');
  });
});

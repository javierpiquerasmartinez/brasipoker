import { describe, expect, it } from 'vitest';
import { InvalidPhoneError, normalizePhone } from '../phone';

describe('normalizePhone', () => {
  it('normalizes a 9-digit Spanish number adding the +34 prefix', () => {
    expect(normalizePhone('612345678')).toBe('+34612345678');
    expect(normalizePhone('712345678')).toBe('+34712345678');
    expect(normalizePhone('912345678')).toBe('+34912345678');
  });

  it('removes spaces, hyphens, dots, and parentheses', () => {
    expect(normalizePhone('612 34 56 78')).toBe('+34612345678');
    expect(normalizePhone('612-34-56-78')).toBe('+34612345678');
    expect(normalizePhone('(612) 34.56.78')).toBe('+34612345678');
  });

  it('respects and cleans numbers that already include +34 or 0034', () => {
    expect(normalizePhone('+34 612 34 56 78')).toBe('+34612345678');
    expect(normalizePhone('0034 612 345 678')).toBe('+34612345678');
    expect(normalizePhone('+34612345678')).toBe('+34612345678');
  });

  it('throws InvalidPhoneError if the format is not a valid Spanish phone number', () => {
    expect(() => normalizePhone('')).toThrow(InvalidPhoneError);
    expect(() => normalizePhone('12345')).toThrow(InvalidPhoneError);
    expect(() => normalizePhone('abc612345678')).toThrow(InvalidPhoneError);
    expect(() => normalizePhone('512345678')).toThrow(InvalidPhoneError);
  });
});

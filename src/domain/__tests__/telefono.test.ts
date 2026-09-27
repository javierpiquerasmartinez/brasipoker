import { describe, expect, it } from 'vitest';
import { normalizarTelefono, TelefonoInvalidoError } from '../telefono';

describe('normalizarTelefono', () => {
  it('normaliza un número español de 9 dígitos añadiendo el prefijo +34', () => {
    expect(normalizarTelefono('612345678')).toBe('+34612345678');
    expect(normalizarTelefono('712345678')).toBe('+34712345678');
    expect(normalizarTelefono('912345678')).toBe('+34912345678');
  });

  it('elimina espacios, guiones, puntos y paréntesis', () => {
    expect(normalizarTelefono('612 34 56 78')).toBe('+34612345678');
    expect(normalizarTelefono('612-34-56-78')).toBe('+34612345678');
    expect(normalizarTelefono('(612) 34.56.78')).toBe('+34612345678');
  });

  it('respeta y limpia números que ya incluyen +34 o 0034', () => {
    expect(normalizarTelefono('+34 612 34 56 78')).toBe('+34612345678');
    expect(normalizarTelefono('0034 612 345 678')).toBe('+34612345678');
    expect(normalizarTelefono('+34612345678')).toBe('+34612345678');
  });

  it('lanza TelefonoInvalidoError si el formato no es un teléfono español válido', () => {
    expect(() => normalizarTelefono('')).toThrow(TelefonoInvalidoError);
    expect(() => normalizarTelefono('12345')).toThrow(TelefonoInvalidoError);
    expect(() => normalizarTelefono('abc612345678')).toThrow(TelefonoInvalidoError);
    expect(() => normalizarTelefono('512345678')).toThrow(TelefonoInvalidoError); // no empieza por 6, 7, 8 o 9
  });
});

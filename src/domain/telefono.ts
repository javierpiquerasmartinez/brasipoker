export class TelefonoInvalidoError extends Error {
  constructor(mensaje: string = 'El número de teléfono no es válido') {
    super(mensaje);
    this.name = 'TelefonoInvalidoError';
  }
}

/**
 * Normaliza un número de teléfono al formato es-ES estándar (+34XXXXXXXXX).
 * Acepta números con o sin espacios, guiones, puntos o prefijo internacional.
 * Valida que los 9 dígitos nacionales comiencen por 6, 7, 8 o 9.
 */
export function normalizarTelefono(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new TelefonoInvalidoError('El número de teléfono es obligatorio');
  }

  // Eliminar espacios, guiones, puntos y paréntesis
  let limpio = input.trim().replace(/[\s\-\.\(\)]/g, '');

  // Manejar prefijo internacional 0034 o +34
  if (limpio.startsWith('0034')) {
    limpio = limpio.slice(4);
  } else if (limpio.startsWith('+34')) {
    limpio = limpio.slice(3);
  }

  // Debe tener exactamente 9 dígitos numéricos y empezar por 6, 7, 8 o 9
  const regexEs = /^[6789]\d{8}$/;
  if (!regexEs.test(limpio)) {
    throw new TelefonoInvalidoError(
      `El teléfono "${input}" no corresponde a un formato válido (debe tener 9 dígitos empezando por 6, 7, 8 o 9)`
    );
  }

  return `+34${limpio}`;
}

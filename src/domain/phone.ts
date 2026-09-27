export class InvalidPhoneError extends Error {
  constructor(message: string = 'The phone number is not valid') {
    super(message);
    this.name = 'InvalidPhoneError';
  }
}

/**
 * Normalizes a phone number to the standard es-ES format (+34XXXXXXXXX).
 * Accepts numbers with or without spaces, dashes, dots, or international prefixes (0034 or +34).
 * Validates that the 9 national digits start with 6, 7, 8, or 9.
 */
export function normalizePhone(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new InvalidPhoneError('Phone number is required');
  }

  // Remove spaces, hyphens, dots, and parentheses
  let clean = input.trim().replace(/[\s\-\.\(\)]/g, '');

  // Handle international prefix 0034 or +34
  if (clean.startsWith('0034')) {
    clean = clean.slice(4);
  } else if (clean.startsWith('+34')) {
    clean = clean.slice(3);
  }

  // Must have exactly 9 numeric digits starting with 6, 7, 8, or 9
  const esRegex = /^[6789]\d{8}$/;
  if (!esRegex.test(clean)) {
    throw new InvalidPhoneError(
      `Phone "${input}" is not valid (must be a 9-digit Spanish number starting with 6, 7, 8, or 9)`
    );
  }

  return `+34${clean}`;
}

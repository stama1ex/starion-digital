// Короткий непрозрачный код для QR: /a/{code} вместо /ar/{slug}.
//
// Зачем: чем короче строка в QR, тем крупнее его модули и тем увереннее он
// читается с маленькой наклейки. Плюс код ничего не рассказывает о сувенире —
// в отличие от slug, где прямо написано название.
//
// Домен в QR спрятать нельзя в принципе (это обычная ссылка), но его можно
// сделать нейтральным: см. NEXT_PUBLIC_AR_SHORT_URL в lib/ar/config.

// Без 0/O/1/I/l — их путают, если код придётся вводить руками.
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';
export const AR_SHORT_CODE_LENGTH = 7;

export function generateShortCode(length = AR_SHORT_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export const AR_SHORT_CODE_PATTERN = new RegExp(
  `^[${ALPHABET}]{4,16}$`
);

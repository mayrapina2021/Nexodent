/** Letras unicode (incluye acentos). */
const LETTER_RE = /\p{L}/u;

/** Nombres genéricos que no deben usarse como nombre real del paciente. */
const GENERIC_NAMES = new Set([
  "contacto whatsapp",
  "nuevo contacto",
  "contacto",
  "paciente",
  "whatsapp",
  "unknown",
  "desconocido",
]);

/** Detecta si un texto es mayormente emojis/símbolos sin letras reales. */
export function isValidPatientName(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;

  const name = raw.trim();
  const lower = name.toLowerCase();

  if (GENERIC_NAMES.has(lower)) return false;
  if (/^paciente\s*#\d+$/i.test(name)) return false;

  const letters = [...name.matchAll(LETTER_RE)];
  if (letters.length < 2) return false;

  const withoutLetters = name.replace(/[\p{L}\p{N}\s]/gu, "");
  const emojiRatio = withoutLetters.length / name.length;
  if (emojiRatio > 0.4) return false;

  if (/^[\p{Emoji}\p{Symbol}\p{Punctuation}\s]+$/u.test(name)) return false;

  return true;
}

export function sanitizePatientName(raw: string): string {
  return raw
    .replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayNameForUnknownContact(): string {
  return "Nuevo contacto";
}

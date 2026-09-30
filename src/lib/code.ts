/** No O/0, I/1 or L, so a code read aloud or texted around is unambiguous. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = "";
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

/** Accepts what people paste: lower case, spaces, dashes, a leading #. */
export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, JOIN_CODE_LENGTH);
}

export function isValidJoinCode(input: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${JOIN_CODE_LENGTH}}$`).test(input);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Distinct hues for members, in assignment order. */
export const MEMBER_PALETTE_SIZE = 8;

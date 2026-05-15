import { SESSION_CODE_CHARSET, SESSION_CODE_LENGTH } from "./constants.js";

/** Cryptographically secure 8-character session code (Node crypto). */
export function generateSessionCode(
  randomBytes: (length: number) => Uint8Array,
): string {
  const charset = SESSION_CODE_CHARSET;
  const bytes = randomBytes(SESSION_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    const byte = bytes[i]!;
    code += charset[byte % charset.length]!;
  }
  return code;
}

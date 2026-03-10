// ---------------------------------------------------------------------------
// UUID v7 generator — time-ordered UUIDs per RFC 9562.
//
// Structure (128 bits):
//   48 bits: unix_ts_ms  (milliseconds since epoch)
//    4 bits: version     (0b0111 = 7)
//   12 bits: rand_a      (random)
//    2 bits: variant     (0b10)
//   62 bits: rand_b      (random)
// ---------------------------------------------------------------------------

import { randomBytes } from "node:crypto";

export const generateId = (): string => {
  const now = Date.now();
  const bytes = new Uint8Array(16);

  // Fill with random bytes first
  const rand = randomBytes(16);
  bytes.set(rand);

  // unix_ts_ms — 48 bits in bytes[0..5]
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // version — 4 bits at bytes[6] high nibble = 0111
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;

  // variant — 2 bits at bytes[8] high bits = 10
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  // Format as UUID string
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

/** ISO 8601 UTC timestamp */
export const nowUtc = (): string => new Date().toISOString();

/** ISO 8601 UTC date (no time component) */
export const todayUtc = (): string => new Date().toISOString().slice(0, 10);

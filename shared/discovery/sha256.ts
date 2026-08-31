/**
 * SHA-256, because a frozen hypothesis needs an identity and `shared/` has no Node in it.
 *
 * WHY NOT `node:crypto`. Every module in `shared/` is imported by the browser bundle as well as by
 * the server -- `client/src/lib/loop-position.ts` imports `@shared/detector` today -- and a Node
 * builtin in here is a build failure waiting for the first client module that reaches for a
 * hypothesis id. WHY NOT WebCrypto: `crypto.subtle.digest` is asynchronous, and a hypothesis id is
 * used in equality checks, map keys and assertions. An async identity would make every one of
 * those places async for a reason that has nothing to do with them.
 *
 * WHY A REIMPLEMENTATION IS ALLOWED HERE, when this project's whole discipline is not to write one.
 * SHA-256 is a fixed published function with published test vectors; it is used here as an
 * IDENTITY and never as a security primitive -- nothing authenticates on it, nothing is secret,
 * and an attacker who could forge a collision would gain the ability to give two hypotheses the
 * same name. And it is checked the way this project checks a port:
 * `tests/discovery/the-same-digest-as-the-reference.test.ts` differences it against
 * `node:crypto.createHash("sha256")` over the published vectors and thousands of random inputs,
 * including every length across the two block-padding boundaries. It is a port after golden
 * equivalence, which is the only kind this project permits.
 *
 * The implementation is FIPS 180-4 section 6.2, with no optimisations that would make it harder to
 * check against the specification it comes from.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/**
 * UTF-8 bytes of a string.
 *
 * `TextEncoder` rather than a hand-rolled loop: it is in every runtime this code targets, and the
 * surrogate-pair handling is exactly the part a hand-rolled loop gets wrong -- an emoji in a
 * predicate's free text would otherwise hash differently from the same bytes on the server.
 */
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The digest of a UTF-8 string, lowercase hex. */
export function sha256Hex(text: string): string {
  const message = utf8(text);
  const bitLength = message.length * 8;

  // Padding: the 0x80 byte, then zeros, then the length as a 64-bit big-endian integer.
  const withPadding = new Uint8Array(((message.length + 9 + 63) >> 6) << 6);
  withPadding.set(message);
  withPadding[message.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  /*
   * THE HIGH WORD IS WRITTEN, NOT ASSUMED ZERO. A string long enough to need it cannot exist in
   * this process, but a padding routine whose correctness depends on that is one that is wrong
   * where nobody is looking. `Math.floor(bitLength / 2**32)` is exact for every length JavaScript
   * can address.
   */
  view.setUint32(withPadding.length - 8, Math.floor(bitLength / 2 ** 32), false);
  view.setUint32(withPadding.length - 4, bitLength >>> 0, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let block = 0; block < withPadding.length; block += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(block + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  let hex = "";
  for (const word of h) hex += word.toString(16).padStart(8, "0");
  return hex;
}

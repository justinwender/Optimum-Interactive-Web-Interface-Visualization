/**
 * GF(2^8) arithmetic with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B).
 * Used for RLNC coding coefficients.
 */

const GF_SIZE = 256;
const PRIMITIVE_POLY = 0x11b;

// Pre-computed lookup tables for fast multiplication
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(GF_SIZE);

// Build tables using generator 0x03
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x & 0x80 ? PRIMITIVE_POLY : 0);
    x &= 0xff;
  }
  LOG_TABLE[0] = 0; // Convention: log(0) = 0, but gfMul handles 0 specially
})();

/** Addition in GF(2^8) = XOR */
export function gfAdd(a: number, b: number): number {
  return a ^ b;
}

/** Multiplication in GF(2^8) via log/exp tables */
export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/** Multiplicative inverse in GF(2^8) */
export function gfInv(a: number): number {
  if (a === 0) throw new Error('Cannot invert 0 in GF(2^8)');
  return EXP_TABLE[255 - LOG_TABLE[a]];
}

/** Generate a random nonzero element in GF(2^8) */
export function gfRandom(rngFn: () => number): number {
  return Math.floor(rngFn() * 255) + 1; // [1, 255]
}

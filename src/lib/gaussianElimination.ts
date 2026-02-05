import { gfAdd, gfMul, gfInv } from './galoisField';

/**
 * Incrementally track the rank of a matrix over GF(2^8).
 * Each call to `addRow` performs partial Gaussian elimination
 * and returns the new rank.
 */
export class IncrementalRankTracker {
  private pivots: (number[] | null)[];
  private _rank: number;
  readonly k: number;

  constructor(k: number) {
    this.k = k;
    this.pivots = new Array(k).fill(null);
    this._rank = 0;
  }

  get rank(): number {
    return this._rank;
  }

  get isFullRank(): boolean {
    return this._rank >= this.k;
  }

  /**
   * Try to add a new coding vector (row) to the matrix.
   * Returns true if the row was linearly independent (increased rank).
   */
  addRow(row: number[]): boolean {
    const r = [...row];
    for (let col = 0; col < this.k; col++) {
      if (r[col] === 0) continue;
      if (this.pivots[col] !== null) {
        // Eliminate this column using the existing pivot row
        const factor = gfMul(r[col], gfInv(this.pivots[col]![col]));
        for (let j = 0; j < this.k; j++) {
          r[j] = gfAdd(r[j], gfMul(factor, this.pivots[col]![j]));
        }
      } else {
        // New pivot found
        this.pivots[col] = r;
        this._rank++;
        return true;
      }
    }
    // Row was linearly dependent (reduced to zero)
    return false;
  }

  reset(): void {
    this.pivots = new Array(this.k).fill(null);
    this._rank = 0;
  }
}

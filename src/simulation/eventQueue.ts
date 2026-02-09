/**
 * Min-heap priority queue for the discrete-event simulation.
 * Events are ordered by their `fireAt` timestamp (lowest first).
 */

export interface HeapEvent {
  fireAt: number;
  /** Unique insertion order for stable ordering when fireAt ties */
  seq: number;
}

export class MinHeap<T extends HeapEvent> {
  private heap: T[] = [];
  private seqCounter = 0;

  get length(): number {
    return this.heap.length;
  }

  /** Assign a monotonically increasing sequence number, then push */
  push(event: T): void {
    event.seq = this.seqCounter++;
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Remove and return the event with the smallest fireAt */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  /** Peek at the next event without removing it */
  peek(): T | undefined {
    return this.heap[0];
  }

  clear(): void {
    this.heap = [];
    this.seqCounter = 0;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  private compare(a: T, b: T): number {
    const d = a.fireAt - b.fireAt;
    return d !== 0 ? d : a.seq - b.seq;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}

// ── Shard rainbow palette (RLNC) ──
export const SHARD_COLORS = [
  '#FF0000', // red
  '#FF7F00', // orange
  '#FFFF00', // yellow
  '#00FF00', // green
  '#0000FF', // blue
  '#4B0082', // indigo
  '#8B00FF', // violet
] as const;

export function shardColor(index: number): string {
  return SHARD_COLORS[index % SHARD_COLORS.length];
}

// ── GossipSub ──
export const GOSSIP_COLOR = '#FF8C00';
export const GOSSIP_DIM = '#FF8C0040';
export const GOSSIP_DUPLICATE_AMBER = '#FFD600'; // amber/yellow for duplicate receipt flash

// ── Status colors ──
export const RECONSTRUCTED_GREEN = '#00E676';
export const FAILURE_RED = '#FF1744';

// ── UI chrome ──
export const BG_PRIMARY = '#0A0E17';
export const BG_PANEL = '#141A26';
export const TEXT_PRIMARY = '#E8EAED';
export const TEXT_SECONDARY = '#9AA0A6';
export const ACCENT_TEAL = '#00BFA5';

// ── Node states ──
export const NODE_IDLE = '#4A5568';
export const NODE_PUBLISHING = '#FFFFFF';

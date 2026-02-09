'use client';

import { useState, useCallback, useEffect } from 'react';
import { ACCENT_TEAL, GOSSIP_COLOR, BG_PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/colors';

interface TutorialStep {
  title: string;
  body: string;
  /** Where the card positions itself. */
  position: 'center' | 'left' | 'right' | 'top-center' | 'bottom-center';
  /** Optional highlight region overlay */
  highlight?: 'left-sidebar' | 'right-sidebar' | 'canvas' | 'header' | 'timeline';
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the mump2p Dashboard',
    body: 'This interactive tool compares two peer-to-peer propagation protocols: mump2p (which uses Random Linear Network Coding) and GossipSub (the store-and-forward protocol used in Ethereum today).\n\nWatch how data moves through the network and see why RLNC delivers faster with less waste.',
    position: 'center',
  },
  {
    title: 'Controls Panel',
    body: 'Configure the simulation here:\n\n• Flexnode Count — number of nodes in the network (3–50)\n• Topology — how nodes are connected (mesh, ring, star, random)\n• Network Messiness — packet loss percentage (higher = harder conditions)\n• Network Preset — Ethereum or Solana timing parameters\n• Mode — "User Click" for single rounds, "Continuous" for back-to-back slots',
    position: 'left',
    highlight: 'left-sidebar',
  },
  {
    title: 'Split Visualization',
    body: 'The center area shows both protocols running side by side on identical network topologies.\n\nLeft panel: mump2p (RLNC) — diamond-shaped shard particles in rainbow colors\nRight panel: GossipSub — square block particles in orange\n\nWatch how RLNC\'s coded shards take different paths while GossipSub must relay the full message hop by hop.',
    position: 'top-center',
    highlight: 'canvas',
  },
  {
    title: 'Metrics & Comparison',
    body: 'Real-time metrics appear here as the simulation runs:\n\n• Latency — how fast each protocol delivers to all nodes\n• Delivery Success — what percentage of nodes received the data\n• Bandwidth — total transmissions, overhead, and duplicates\n• Comparison Table — head-to-head summary after each round\n\nIn continuous mode, you\'ll also see aggregate stats across many slots.',
    position: 'right',
    highlight: 'right-sidebar',
  },
  {
    title: 'How RLNC Works',
    body: 'Random Linear Network Coding splits a message into k shards and creates coded combinations. Any k linearly independent coded shards can reconstruct the original.\n\nKey advantage: relay nodes create fresh coded shards without decoding. Multiple paths deliver useful data simultaneously — no wasted bandwidth from duplicates.\n\nWhen a node collects k independent shards, it turns green (reconstructed).',
    position: 'center',
  },
  {
    title: 'How GossipSub Works',
    body: 'GossipSub forwards the full message through a gossip mesh. Each node must receive, validate, and re-forward the complete data.\n\nLimitation: if a node receives a message it already has, that\'s wasted bandwidth (shown as an amber flash). Data can only travel as fast as sequential hops allow.\n\nWhen a node receives the message, it turns orange.',
    position: 'center',
  },
  {
    title: 'Attestation Deadlines',
    body: 'In blockchain networks, validators must attest to blocks within a deadline:\n\n• Ethereum: ~4 seconds within a 12-second slot\n• Solana: ~400ms per slot\n\nIf data arrives after the deadline, the validator misses the slot and earns no reward. The Slot Timeline (visible in continuous mode) tracks which protocol met the deadline for each slot.',
    position: 'top-center',
    highlight: 'timeline',
  },
  {
    title: 'Ready to Explore!',
    body: 'Click any node in the network to simulate a block proposal from that node.\n\nKeyboard shortcuts:\n• Space — play/pause\n• S — step one tick\n• R — reset simulation\n\nTry increasing packet loss to see where RLNC really shines. Switch to Continuous mode to accumulate stats across many slots.',
    position: 'center',
  },
];

// Highlight region dimensions (rough percentages of viewport)
function getHighlightStyle(highlight: TutorialStep['highlight']): React.CSSProperties | null {
  switch (highlight) {
    case 'left-sidebar':
      return { left: 0, top: 0, width: '288px', height: '100%' };
    case 'right-sidebar':
      return { right: 0, top: 0, width: '288px', height: '100%' };
    case 'canvas':
      return { left: '288px', right: '288px', top: '52px', bottom: 0 };
    case 'header':
      return { left: 0, right: 0, top: 0, height: '52px' };
    case 'timeline':
      return { left: '288px', right: '288px', top: '52px', height: '80px' };
    default:
      return null;
  }
}

function getCardStyle(position: TutorialStep['position']): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    maxWidth: '420px',
    width: '90%',
  };
  switch (position) {
    case 'center':
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'left':
      return { ...base, top: '50%', left: '320px', transform: 'translateY(-50%)' };
    case 'right':
      return { ...base, top: '50%', right: '320px', transform: 'translateY(-50%)' };
    case 'top-center':
      return { ...base, top: '80px', left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-center':
      return { ...base, bottom: '80px', left: '50%', transform: 'translateX(-50%)' };
    default:
      return base;
  }
}

interface TutorialOverlayProps {
  onClose: () => void;
}

export default function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onClose();
  }, [step, onClose]);

  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onClose]);

  const highlightStyle = current.highlight ? getHighlightStyle(current.highlight) : null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
    >
      {/* Highlighted region cutout */}
      {highlightStyle && (
        <div
          className="absolute border-2 rounded-sm pointer-events-none"
          style={{
            ...highlightStyle,
            borderColor: ACCENT_TEAL,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,191,165,0.1)`,
            zIndex: 1,
          }}
        />
      )}

      {/* Step card */}
      <div
        style={{
          ...getCardStyle(current.position),
          backgroundColor: BG_PANEL,
          border: `1px solid ${ACCENT_TEAL}40`,
          borderRadius: '12px',
          padding: '24px',
          zIndex: 2,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium" style={{ color: ACCENT_TEAL }}>
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={onClose}
            className="text-[10px] px-2 py-0.5 rounded hover:opacity-80"
            style={{ color: TEXT_SECONDARY }}
            aria-label="Close tutorial"
          >
            Skip
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-4" style={{ backgroundColor: '#1e2840' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: ACCENT_TEAL,
              width: `${((step + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>

        <h2 className="text-base font-semibold mb-3" style={{ color: TEXT_PRIMARY }}>
          {current.title}
        </h2>

        <div
          className="text-[12px] leading-relaxed whitespace-pre-line mb-5"
          style={{ color: TEXT_SECONDARY }}
        >
          {current.body}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            className="text-[11px] px-3 py-1.5 rounded font-medium transition-opacity"
            style={{
              color: TEXT_SECONDARY,
              opacity: step === 0 ? 0.3 : 1,
              cursor: step === 0 ? 'default' : 'pointer',
            }}
            aria-label="Previous step"
          >
            ← Back
          </button>

          {/* Step dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i === step ? ACCENT_TEAL : i < step ? `${ACCENT_TEAL}60` : '#1e2840',
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="text-[11px] px-4 py-1.5 rounded font-semibold transition-colors hover:brightness-110"
            style={{
              backgroundColor: ACCENT_TEAL,
              color: '#000',
            }}
            aria-label={step === STEPS.length - 1 ? 'Close tutorial' : 'Next step'}
          >
            {step === STEPS.length - 1 ? 'Get Started →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

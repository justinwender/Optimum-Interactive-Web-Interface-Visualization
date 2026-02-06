# mump2p Dashboard — Technical Planning Document

## Optimum Interactive Web Interface Visualization

**Version:** 1.0
**Date:** 2026-02-05
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack Recommendation](#2-tech-stack-recommendation)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Model & Simulation Engine](#4-data-model--simulation-engine)
5. [Core Visualization Engine](#5-core-visualization-engine)
6. [Interactive Parameters & User Controls](#6-interactive-parameters--user-controls)
7. [Comparison Modes](#7-comparison-modes)
8. [Numerical Metrics Display](#8-numerical-metrics-display)
9. [UI/UX Wireframe Outline](#9-uiux-wireframe-outline)
10. [Implementation Phases](#10-implementation-phases)
11. [File & Directory Structure](#11-file--directory-structure)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

This document specifies a browser-based interactive dashboard that visualizes and compares **mump2p** (Optimum's Random Linear Network Coding protocol) against **GossipSub** (the traditional pub/sub protocol used in Ethereum and other blockchains). The dashboard renders a network of Flexnodes on a map, simulates message propagation under configurable conditions, and displays real-time latency, bandwidth, and reliability metrics side-by-side.

The primary goal is to make the performance advantages of RLNC — lower latency, graceful degradation under packet loss, and bandwidth efficiency through recoding — immediately visible and interactive for technical and non-technical audiences.

---

## 2. Tech Stack Recommendation

### Frontend Framework

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | **Next.js 14+ (App Router)** | SSG for the landing page, client-side rendering for the simulation canvas. Matches the `.gitignore` already in repo. |
| **Language** | **TypeScript** | Type safety for the simulation math and state machines. |
| **Styling** | **Tailwind CSS + CSS Modules** | Utility-first for layout, modules for custom visualization styles. |

### Visualization Libraries

| Component | Choice | Rationale |
|---|---|---|
| **Network Map / Graph** | **React Flow** | Purpose-built for node-edge graph rendering with pan/zoom, handles, and custom node components. Lighter weight than D3 force layouts for structured network topologies. |
| **Shard / Packet Animation** | **Framer Motion + SVG** | Declarative animation of shard particles along computed edge paths. GPU-accelerated transforms. |
| **3D Globe (optional phase)** | **React Three Fiber (Three.js)** | Only if a 3D globe view is pursued in Phase 4. Can be added without disrupting the 2D core. |
| **Metric Charts** | **Recharts** | Lightweight React-native charting. Bar/line charts for latency and bandwidth comparisons. |

### Simulation Engine

| Component | Choice | Rationale |
|---|---|---|
| **RLNC Math** | **Custom TypeScript module** | Galois field arithmetic (GF(2^8)) for coding coefficient generation; matrix rank tracking for decoding threshold. No heavy WASM needed at 6–50 nodes. |
| **Event Scheduler** | **Custom discrete-event simulation** | Tick-based scheduler (1ms resolution) driving both protocols in lockstep for fair comparison. |
| **Randomness** | **seedrandom** (npm) | Deterministic PRNG so users can reproduce scenarios. |

### Build & Deploy

| Tool | Choice |
|---|---|
| **Package Manager** | pnpm |
| **Linting** | ESLint + Prettier |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **CI/CD** | GitHub Actions |
| **Hosting** | Vercel (static export) |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Next.js App Shell                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  Controls   │  │  Network   │  │   Metrics      │  │
│  │  Panel      │  │  Canvas    │  │   Panel        │  │
│  │  (React)    │  │(React Flow)│  │  (Recharts)    │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │
│        │               │                 │           │
│        └───────┬───────┴────────┬────────┘           │
│                │                │                    │
│         ┌──────▼──────┐  ┌─────▼──────┐             │
│         │  Simulation │  │  Animation │             │
│         │  Context    │  │  Scheduler │             │
│         │  (Zustand)  │  │  (rAF loop)│             │
│         └──────┬──────┘  └────────────┘             │
│                │                                    │
│         ┌──────▼──────────────────────┐             │
│         │     Simulation Engine       │             │
│         │  ┌────────┐  ┌───────────┐  │             │
│         │  │ RLNC   │  │ GossipSub │  │             │
│         │  │ Model   │  │ Model     │  │             │
│         │  └────────┘  └───────────┘  │             │
│         │  ┌────────────────────────┐ │             │
│         │  │  Network Topology &    │ │             │
│         │  │  Discrete Event Queue  │ │             │
│         │  └────────────────────────┘ │             │
│         └─────────────────────────────┘             │
└──────────────────────────────────────────────────────┘
```

### State Management

**Zustand** store with the following slices:

- **`networkSlice`** — node positions, edges, topology type
- **`simulationSlice`** — clock, event queue, running/paused state, current tick
- **`protocolSlice`** — per-protocol state (shard maps, peer tables, delivery status)
- **`controlSlice`** — user parameters (node count, packet loss, network preset, mode)
- **`metricsSlice`** — accumulated latency samples, bandwidth counters, success/fail tallies

---

## 4. Data Model & Simulation Engine

### 4.1 Network Topology

```typescript
interface FlexNode {
  id: string;
  label: string;
  position: { x: number; y: number };       // Canvas coordinates
  geoPosition?: { lat: number; lng: number }; // For map mode
  role: 'publisher' | 'relay' | 'subscriber';
  neighbors: string[];                        // Adjacency list
}

interface Edge {
  id: string;
  source: string;
  target: string;
  latencyMs: number;      // Base propagation delay (sampled from distribution)
  packetLossRate: number;  // Effective loss = base * global messiness multiplier
}

interface NetworkTopology {
  nodes: FlexNode[];
  edges: Edge[];
  avgDegree: number;       // Target connectivity (default ~3 for 6 nodes)
}
```

Topology generation: For the default 6-node mesh, use a **random geometric graph** with a connectivity guarantee (ensure the graph is connected). For larger counts, use the **Barabási–Albert** model to mimic real P2P network degree distributions.

### 4.2 RLNC (mump2p) Model

**Core math:** Messages are divided into `k` **original shards**. Each coded shard is a random linear combination over GF(2^8):

```
coded_shard_i = Σ (c_ij * original_shard_j)  for j in 1..k
```

where `c_ij` are random coefficients from GF(2^8).

**Decoding threshold:** A receiver can reconstruct the original message once it has received **any `k` linearly independent** coded shards (the coding coefficient matrix has rank `k`).

For the dashboard's default configuration:

| Parameter | Default | Configurable? |
|---|---|---|
| Original shards (`k`) | 4 | Yes (via advanced panel) |
| Threshold display | 75% (i.e., `k` out of ~`k * 1.33` total shards sent) | Label only; reconstruction needs exactly `k` independent shards |
| Recoding at relays | Yes — relay nodes generate fresh coded shards from any coded shards they hold, without decoding | Always on |
| Shard size (visual) | Abstract unit | N/A |

**Simulation steps per hop (RLNC):**

1. Source node generates `n ≥ k` coded shards with random GF(2^8) coefficients.
2. Each shard is scheduled for delivery to each neighbor with `delay = edge.latencyMs`.
3. At each tick, for each in-flight shard, apply `packetLossRate` — if lost, the shard is dropped.
4. When a relay receives a shard, it immediately generates a **recoded shard** (new random linear combination of all shards it holds) and forwards to its downstream neighbors. This is "perfect pipelining" — no decode-then-re-encode step.
5. A subscriber tracks the rank of its received coefficient matrix. When `rank == k`, reconstruction is complete.

**Rank tracking (simplified for visualization):**

```typescript
interface RLNCReceiverState {
  nodeId: string;
  coefficientMatrix: number[][];  // Rows = received coding vectors
  rank: number;                   // Current matrix rank (Gaussian elimination)
  k: number;                      // Target rank for reconstruction
  reconstructed: boolean;
  shardsReceived: number;
  firstShardTick: number;
  reconstructionTick: number | null;
}
```

We perform incremental Gaussian elimination on each new shard arrival to update rank cheaply.

### 4.3 GossipSub Model

GossipSub propagation follows the **epidemic/rumor-mill** model:

1. Source publishes the full message to its **mesh peers** (fanout = D, default 6, capped by degree).
2. Each relay that receives the message for the first time forwards it to all mesh peers **except** the sender.
3. Duplicate messages are dropped (each node tracks `seen` message IDs).
4. Packet loss applies per-hop: if a transmission is lost, the receiver never gets it from that peer. It must wait for another peer to forward it (or the message is lost if all paths fail).

```typescript
interface GossipSubNodeState {
  nodeId: string;
  hasMessage: boolean;
  receivedAtTick: number | null;
  forwardedTo: string[];
  seenMessageIds: Set<string>;
}
```

**Key behavioral differences to highlight:**

| Property | mump2p (RLNC) | GossipSub |
|---|---|---|
| What's forwarded | Coded shards (can be recoded) | Full message or discrete chunks |
| Redundancy | Algebraic — every shard is useful if linearly independent | Structural — duplicate messages are pure waste |
| Under packet loss | Graceful — any `k`-of-`n` shards suffice | Brittle — lost message on all paths = delivery failure |
| Relay behavior | Recode and forward immediately | Store-and-forward full message |
| Bandwidth under stress | Sublinear overhead growth | Linear or super-linear overhead growth |

### 4.4 Latency Model

Base edge latency is drawn from a configurable distribution:

- **Ethereum preset:** `latencyMs ~ Normal(μ=30ms, σ=10ms)`, clamped to [5, 100].
- **Solana preset:** `latencyMs ~ Normal(μ=15ms, σ=5ms)`, clamped to [3, 50].

Processing delay per node:

- **RLNC recode:** 0.5ms (negligible GF(2^8) operations)
- **GossipSub forward:** 1ms (message validation + forwarding logic)

These are tunable constants in the simulation config.

### 4.5 Event Queue

A **priority queue** (min-heap by tick) drives the simulation:

```typescript
interface SimEvent {
  tick: number;                   // When this event fires
  type: 'shard_arrive' | 'message_arrive' | 'recode' | 'forward' | 'reconstruct';
  protocol: 'rlnc' | 'gossipsub';
  payload: {
    fromNode: string;
    toNode: string;
    shardIndex?: number;          // RLNC only
    codingVector?: number[];      // RLNC only
    messageId?: string;           // GossipSub only
  };
}
```

Both protocols are simulated in the **same event queue** so their timelines are directly comparable.

---

## 5. Core Visualization Engine

### 5.1 Global Node Map

**Default view (2D):** A stylized dark-background canvas with Flexnodes rendered as circular nodes using React Flow. Edges are curved SVG paths. Node positions can be:

- **Auto-layout:** Force-directed placement for arbitrary topologies.
- **Geo-pinned:** Placed on approximate world-map coordinates (rendered as a subtle Mercator outline behind the graph) for narrative demos.

**Node visual states:**

| State | Appearance |
|---|---|
| Idle | Dark gray circle, subtle glow |
| Publishing | Bright white pulse + expanding ring |
| Receiving shards (RLNC) | Segmented ring fills with rainbow colors per shard |
| Threshold reached (RLNC) | Ring snaps to solid **green**, "✓ Reconstructed" label |
| Received message (GossipSub) | Circle fills **orange** |
| Failed delivery | Circle border turns **red**, "✗" icon |

### 5.2 Data Pipeline Visualization — mump2p (RLNC)

**Shard particles:** Small circles (~6px) traveling along edge paths. Each shard is assigned a color from a **rainbow palette** (hue mapped to shard index mod 7):

```
Shard 0: #FF0000 (red)
Shard 1: #FF7F00 (orange)
Shard 2: #FFFF00 (yellow)
Shard 3: #00FF00 (green)
Shard 4: #0000FF (blue)
Shard 5: #4B0082 (indigo)
Shard 6: #8B00FF (violet)
```

Coded shards that are **recoded** at intermediate nodes get a subtle **shimmer/gradient effect** (two-color blend from the constituent shards) to visually signal remixing.

**Reconstruction indicator:** Each receiving node displays a small **progress bar** or **pie chart** showing `rank / k`. When `rank == k`, the indicator transitions to solid green with a brief particle burst animation.

### 5.3 Data Pipeline Visualization — GossipSub

**Message packets:** Larger circles (~10px) in solid **orange** (`#FF8C00`), traveling along edges. Only one packet per message per edge (duplicates shown as dimmed/ghosted packets that fade out on arrival).

**Duplicate waste indicator:** When a node receives a duplicate, a small "DUP" label briefly flashes and the packet dissolves — making the redundancy cost visible.

### 5.4 Recoding Logic Visualization

When a relay node recodes:

1. Incoming shard particles **converge** into the node center.
2. A brief **mixing animation** plays (rotating color wheel, ~200ms).
3. New outgoing shard particles **emerge** with blended/shifted colors.

This visually communicates that the relay is generating new coded shards from its existing pool without ever fully decoding the original message.

---

## 6. Interactive Parameters & User Controls

All controls are housed in a **collapsible left sidebar** (360px width).

### 6.1 Node Configuration

- **Flexnode Count:** Slider, range [3, 50], default 6, step 1.
- **Topology Preset:** Dropdown — "Mesh (default)", "Ring", "Star", "Random".
- **Regenerate Topology:** Button to re-roll the random graph while keeping the same parameters.

### 6.2 Network "Messiness" (Packet Loss)

- **Global Packet Loss:** Slider, range [0%, 50%], default 0%, step 1%.
- Visual indicator: A "signal strength" icon that degrades as loss increases.
- Tooltip: "Simulates network congestion, unreliable links, or adversarial conditions."

### 6.3 Network Selection (Blockchain Preset)

- **Toggle group:** "Ethereum" | "Solana" | "Custom"
- **Ethereum:** Sets latency distribution to μ=30ms, slot time = 12s, blob size context.
- **Solana:** Sets latency distribution to μ=15ms, slot time = 400ms, block size context.
- **Custom:** Unlocks manual latency/slot-time fields.
- Subtext shows target metric: "mump2p target: 150ms avg (Hoodi testnet benchmark)".

### 6.4 Protocol Parameters (Advanced, collapsed by default)

- **RLNC Original Shards (k):** Slider [2, 16], default 4.
- **RLNC Redundancy Factor:** Slider [1.0, 2.0], default 1.33 (total shards sent = k * factor).
- **GossipSub Mesh Degree (D):** Slider [2, 12], default 6.

### 6.5 Simulation Controls

- **Play / Pause / Step** buttons.
- **Speed:** Slider [0.25x, 4x], default 1x.
- **Reset:** Returns simulation to initial state.

---

## 7. Comparison Modes

### 7.1 On-Demand Request ("User Click" Mode)

1. User clicks any node to designate it as the **requester**.
2. A random (or user-selected) node is designated as the **publisher**.
3. Both protocols simulate the request-to-delivery pipeline simultaneously.
4. The visualization shows:
   - Shards (RLNC) and packets (GossipSub) propagating in parallel.
   - A **split timer** at the top: two stopwatches racing.
   - The first protocol to deliver triggers a "Winner" badge.

### 7.2 Continuous Propagation Mode

1. A random publisher is selected every **slot time** (Ethereum: 12s sim-time, Solana: 400ms sim-time).
2. The simulation runs indefinitely, accumulating metrics.
3. The metrics panel shows rolling averages and distributions.
4. Useful for demonstrating steady-state performance and long-tail behavior under packet loss.

### 7.3 Side-by-Side Split View (primary layout — implemented Phase 3)

Two copies of the network rendered left/right:
- Left: mump2p (RLNC) with rainbow shards and relay-active rainbow aura.
- Right: GossipSub with orange packets and relay-active orange aura.
- Synchronized simulation clock.
- Same topology, same node positions.
- Each canvas filters particles to its own protocol only.

---

## 8. Numerical Metrics Display

Displayed in a **right sidebar** (320px width) with real-time updates.

### 8.1 Latency

| Metric | Description |
|---|---|
| **Last Delivery** | Time (ms) from publish to last subscriber reconstruction |
| **Average Latency** | Rolling mean over last N deliveries |
| **P50 / P95 / P99** | Percentile latencies (shown after ≥20 samples) |
| **mump2p vs GossipSub Δ** | Absolute and percentage difference |

Displayed as: Two vertical bar gauges (green for RLNC, orange for GossipSub) + numeric readouts.

### 8.2 Redundancy Efficiency (Bandwidth)

| Metric | Description |
|---|---|
| **Total Transmissions** | Count of shard/packet sends across all edges |
| **Useful Transmissions** | Shards contributing new rank (RLNC) or first-delivery packets (GossipSub) |
| **Overhead Ratio** | `total / useful` — lower is better |
| **Bandwidth Saved** | `1 - (rlnc_overhead / gossipsub_overhead)` as percentage |

Displayed as: Stacked bar chart comparing useful vs. wasted transmissions per protocol.

### 8.3 Success Rate

| Metric | Description |
|---|---|
| **Delivery Success** | % of subscribers that received the full message within timeout |
| **Partial Delivery** | % of subscribers with `rank > 0` but `rank < k` (RLNC) or no message (GossipSub) |
| **Total Failure** | % of subscribers with zero progress |

Displayed as: Donut charts per protocol. Under 0% loss both should be 100%; divergence appears as loss increases.

### 8.4 Live Comparison Table

A compact table at the bottom of the metrics panel:

```
┌───────────────────┬──────────┬────────────┐
│ Metric            │  mump2p  │  GossipSub │
├───────────────────┼──────────┼────────────┤
│ Avg Latency       │   48ms   │   127ms    │
│ P95 Latency       │   62ms   │   210ms    │
│ Bandwidth Overhead│   1.15x  │   2.40x    │
│ Success @ 20% loss│  99.8%   │   87.3%    │
│ Success @ 40% loss│  97.1%   │   54.6%    │
└───────────────────┴──────────┴────────────┘
```

---

## 9. UI/UX Wireframe Outline

### 9.1 Overall Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Optimum Logo]   mump2p Dashboard        [Ethereum ▾] [Docs]  │
├──────────┬───────────────────────────────────────┬──────────────┤
│          │                                       │              │
│ CONTROLS │         NETWORK CANVAS                │   METRICS    │
│          │                                       │              │
│ Nodes: 6 │    ┌───┐         ┌───┐               │ Latency      │
│ [──●───] │    │ A ├────────►│ B │               │ ████░ 48ms   │
│          │    └─┬─┘         └─┬─┘               │ ████████ 127 │
│ Loss: 0% │      │    ┌───┐   │                  │              │
│ [──●───] │      └───►│ C ├───┘                  │ Bandwidth    │
│          │           └─┬─┘                       │ [chart]      │
│ Network: │             │                         │              │
│ (●) Eth  │           ┌─▼─┐                       │ Success      │
│ ( ) Sol  │           │ D │                       │ [donut]      │
│          │           └───┘                       │              │
│ Mode:    │                                       │ ┌──────────┐ │
│ (●) Click│   [ ▶ Play ] [ ⏸ ] [ ↺ ] [1x ▾]    │ │  Table   │ │
│ ( ) Cont.│                                       │ └──────────┘ │
│          │  ┌─ RLNC Timer: 48ms ─────────────┐  │              │
│ Advanced │  │  GossipSub Timer: ... ████░     │  │              │
│ [expand] │  └─────────────────────────────────┘  │              │
│          │                                       │              │
├──────────┴───────────────────────────────────────┴──────────────┤
│  Status: Simulation running · Tick 1,247 · 6 nodes · 0% loss   │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| ≥1440px | Three-column (controls + canvas + metrics) |
| 1024–1439px | Controls collapse to icons; metrics slide under canvas |
| <1024px | Single column: controls (top accordion) → canvas → metrics |

### 9.3 Color System

| Element | Color | Hex |
|---|---|---|
| Background | Near-black | `#0A0E17` |
| Panel backgrounds | Dark slate | `#141A26` |
| RLNC shard palette | Rainbow spectrum | See Section 5.2 |
| RLNC reconstruction | Green | `#00E676` |
| GossipSub packets | Orange | `#FF8C00` |
| GossipSub duplicate | Dim orange | `#FF8C0040` |
| Failure indicator | Red | `#FF1744` |
| Text primary | Off-white | `#E8EAED` |
| Text secondary | Gray | `#9AA0A6` |
| Accent / Optimum brand | Teal | `#00BFA5` |

### 9.4 Typography

- **Headings:** Inter (or system sans-serif), 600 weight
- **Body:** Inter, 400 weight
- **Monospace (metrics):** JetBrains Mono, for numeric readouts

---

## 10. Implementation Phases

### Phase 1 — Foundation (Static Graph + Basic Animation)

**Goal:** Render a configurable network graph with animated particles traversing edges.

**Deliverables:**
- [ ] Next.js project scaffold (App Router, TypeScript, Tailwind, pnpm)
- [ ] React Flow canvas with custom `FlexNode` components
- [ ] Static topology generation (6-node mesh)
- [ ] Node count slider that regenerates the graph
- [ ] Basic shard particle animation along edges (Framer Motion)
- [ ] Color-coded particles: rainbow for RLNC, orange for GossipSub
- [ ] Zustand store with `networkSlice` and `controlSlice`

**Acceptance criteria:** User can adjust node count, see a generated graph, and trigger a single propagation that animates colored particles from source to all nodes.

---

### Phase 2 — Simulation Engine (RLNC + GossipSub Logic)

**Goal:** Implement the discrete-event simulation driving both protocols with correct math.

**Deliverables:**
- [ ] Discrete-event priority queue (min-heap)
- [ ] RLNC model: GF(2^8) coding, incremental rank tracking, recoding at relays
- [ ] GossipSub model: store-and-forward, duplicate detection, mesh peer selection
- [ ] Packet loss application per-hop
- [ ] Simulation clock with play/pause/step/speed controls
- [ ] Latency and bandwidth counters
- [ ] Zustand `simulationSlice`, `protocolSlice`, `metricsSlice`

**Acceptance criteria:** Running the simulation with 0% loss produces correct latency numbers. Increasing loss to 30%+ shows RLNC maintaining high success while GossipSub degrades.

---

### Phase 3 — Split Canvas, Visual Fidelity, & Comparison Modes

**Goal:** Side-by-side protocol comparison with clear visual distinction and rich node state indicators.

**Key Design Decisions (agreed 2026-02-06):**
- **Split canvas layout**: Two side-by-side ReactFlow canvases — left shows mump2p (RLNC), right shows GossipSub. Same topology and node positions, synchronized simulation clock. This eliminates the problem of overlapping particles making it impossible to distinguish protocols.
- **Relay-active "aura" on propagating nodes**: Nodes that are actively sending/relaying get a glowing aura. For RLNC, a rainbow pulse appears as soon as a relay receives its first shard (it can immediately recode and forward — pipelining). For GossipSub, an orange glow appears only after the relay receives the full message (store-and-forward delay). The speed at which the aura wavefront spreads across the network visually demonstrates RLNC's pipelining advantage.
- **Receiving progress indicators**: RLNC nodes show a progress ring (rank/k filled segments). GossipSub nodes show a binary received/not-received state. This shows that RLNC accumulates information incrementally while GossipSub is all-or-nothing.

**Deliverables:**
- [x] Split-canvas layout (two ReactFlow instances, shared topology, protocol-filtered particles)
- [x] Protocol labels on each canvas ("mump2p (RLNC)" / "GossipSub")
- [x] Relay-active glow/aura (rainbow for RLNC relays, orange for GossipSub relays)
- [x] RLNC receiving progress ring (rank/k segments)
- [x] GossipSub binary received indicator
- [ ] Recoding "remix" animation at relay nodes
- [ ] GossipSub duplicate "waste" visualization
- [x] On-Demand ("User Click") mode with dual race timers
- [x] Continuous Propagation mode (auto-restart with random publisher)
- [ ] Live comparison table enhancements
- [x] Keyboard shortcuts (Space = play/pause, R = reset, S = step)

**Acceptance criteria:** User can clearly see mump2p propagating faster than GossipSub in the split view. The aura wavefront visibly spreads sooner on the RLNC side. Progress rings show incremental RLNC reconstruction. All metrics update in real time.

---

### Phase 4 — Polish, 3D Globe, & Deployment

**Goal:** Production-ready with optional 3D view and documentation.

**Deliverables:**
- [ ] Optional 3D globe view (React Three Fiber) with geo-pinned nodes
- [ ] Keyboard shortcuts (Space = play/pause, R = reset, 1/2 = mode toggle)
- [ ] URL-based state sharing (encode parameters in query string)
- [ ] Performance optimization (Web Workers for simulation if needed)
- [ ] Accessibility audit (ARIA labels, keyboard navigation, color-blind-safe palette option)
- [ ] SEO meta tags, Open Graph image
- [ ] Vercel deployment pipeline
- [ ] User-facing documentation / guided tutorial overlay

**Acceptance criteria:** Lighthouse score ≥90 on performance. Dashboard loads in <2s on 4G. Shareable URLs reproduce exact simulation state.

---

## 11. File & Directory Structure

```
/
├── public/
│   ├── fonts/
│   ├── images/
│   │   └── optimum-logo.svg
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, font loading, metadata
│   │   ├── page.tsx                # Landing / dashboard page
│   │   └── globals.css             # Tailwind base + custom properties
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── NetworkCanvas.tsx   # React Flow wrapper
│   │   │   ├── FlexNodeComponent.tsx
│   │   │   ├── EdgeComponent.tsx
│   │   │   ├── ShardParticle.tsx   # Animated RLNC shard
│   │   │   ├── PacketParticle.tsx  # Animated GossipSub packet
│   │   │   └── ReconstructionRing.tsx
│   │   ├── controls/
│   │   │   ├── ControlPanel.tsx    # Left sidebar container
│   │   │   ├── NodeCountSlider.tsx
│   │   │   ├── PacketLossSlider.tsx
│   │   │   ├── NetworkPresetToggle.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   ├── SimulationControls.tsx
│   │   │   └── AdvancedParams.tsx
│   │   ├── metrics/
│   │   │   ├── MetricsPanel.tsx    # Right sidebar container
│   │   │   ├── LatencyGauge.tsx
│   │   │   ├── BandwidthChart.tsx
│   │   │   ├── SuccessDonut.tsx
│   │   │   └── ComparisonTable.tsx
│   │   └── ui/
│   │       ├── Slider.tsx
│   │       ├── Toggle.tsx
│   │       ├── Button.tsx
│   │       └── Tooltip.tsx
│   ├── simulation/
│   │   ├── engine.ts               # Discrete-event scheduler
│   │   ├── eventQueue.ts           # Min-heap priority queue
│   │   ├── topology.ts             # Graph generation algorithms
│   │   ├── rlnc/
│   │   │   ├── codec.ts            # GF(2^8) arithmetic, encode/recode
│   │   │   ├── receiver.ts         # Rank tracking, Gaussian elimination
│   │   │   └── protocol.ts         # RLNC propagation logic
│   │   ├── gossipsub/
│   │   │   ├── protocol.ts         # GossipSub propagation logic
│   │   │   └── meshManager.ts      # Peer selection, fanout
│   │   ├── presets.ts              # Ethereum / Solana parameter sets
│   │   └── types.ts                # Shared simulation types
│   ├── store/
│   │   ├── index.ts                # Zustand store creation
│   │   ├── networkSlice.ts
│   │   ├── simulationSlice.ts
│   │   ├── protocolSlice.ts
│   │   ├── controlSlice.ts
│   │   └── metricsSlice.ts
│   ├── hooks/
│   │   ├── useSimulationLoop.ts    # rAF loop driving the simulation
│   │   ├── useAnimationState.ts    # Maps simulation state to animation props
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/
│   │   ├── galoisField.ts          # GF(2^8) multiplication/addition tables
│   │   ├── gaussianElimination.ts  # Incremental rank computation
│   │   ├── prng.ts                 # Seeded random number generator
│   │   └── math.ts                 # Statistical helpers (mean, percentile)
│   └── constants/
│       ├── colors.ts               # Color palette definitions
│       ├── defaults.ts             # Default simulation parameters
│       └── presets.ts              # Network preset configurations
├── tests/
│   ├── simulation/
│   │   ├── rlnc.test.ts
│   │   ├── gossipsub.test.ts
│   │   ├── eventQueue.test.ts
│   │   └── topology.test.ts
│   ├── lib/
│   │   ├── galoisField.test.ts
│   │   └── gaussianElimination.test.ts
│   └── e2e/
│       └── dashboard.spec.ts
├── .eslintrc.cjs
├── .prettierrc
├── tailwind.config.ts
├── tsconfig.json
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
└── vitest.config.ts
```

---

## 12. Open Questions — Resolved

All questions have been resolved. Decisions are recorded below for reference.

| # | Question | Decision | Impact |
|---|---|---|---|
| 1 | **Node geo-placement** | Abstract. Nodes randomly distributed on land masses. Population-weighted placement is a future enhancement, not MVP. | No geo-data API needed. Use simple random-on-land coordinate generation. |
| 2 | **3D globe priority** | Flat 2D map for MVP. 3D globe is a nice-to-have for a future phase. | Skip React Three Fiber / Three.js for now. Reduces bundle size by ~200KB. |
| 3 | **Web Worker for simulation** | Skip for MVP. Run simulation on main thread. Revisit only if profiling shows frame drops at high node counts (>20). | Simpler architecture. No cross-thread serialization overhead. |
| 4 | **Hoodi testnet data** | Not needed. This is an abstract visualization, not a replay of real network traces. The 150ms benchmark is referenced as context only. | No data ingestion pipeline required. |
| 5 | **Branding assets** | No brand assets for now. Use the teal/dark palette defined in this doc. Brand assets can be swapped in later if deployed on Optimum's official channels. | Proceed with planned color system. |
| 6 | **Target audience** | Technically minded blockchain professionals — potential enterprise clients and Flexnode operators. Show them why decentralized RLNC networking is more efficient. | Default to showing technical detail. "Advanced" panel can still hide protocol-level knobs (k, D) but the main UI should not oversimplify. |
| 7 | **Message/blob size parameter** | Keep `k` (original shards) as an abstract slider in the Advanced panel (default 4). No real-world byte-size mapping needed. | Simpler UI. One fewer concept for users to map. |
| 8 | **Mobile support** | Minimal. Desktop/web only for MVP. No responsive work for <1024px. | Skip mobile breakpoint implementation. Simplifies layout work in Phase 3. |

---

*All open questions resolved as of 2026-02-05. This document now serves as the approved technical blueprint for implementation. Phase 1 development can begin immediately.*

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mump2p Dashboard — RLNC vs GossipSub | Optimum',
  description:
    'Interactive visualization comparing mump2p (Random Linear Network Coding) against GossipSub for peer-to-peer block propagation. See how RLNC delivers lower latency, better reliability under packet loss, and bandwidth efficiency for blockchain validators.',
  keywords: [
    'mump2p', 'RLNC', 'GossipSub', 'Random Linear Network Coding',
    'blockchain', 'Ethereum', 'Solana', 'network coding',
    'block propagation', 'Optimum', 'Flexnode', 'validator',
  ],
  openGraph: {
    title: 'mump2p Dashboard — RLNC vs GossipSub',
    description:
      'Interactive side-by-side comparison of mump2p (RLNC) and GossipSub block propagation for blockchain validators.',
    type: 'website',
    siteName: 'Optimum',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mump2p Dashboard — RLNC vs GossipSub',
    description:
      'See why RLNC outperforms GossipSub for blockchain block propagation. Interactive visualization by Optimum.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

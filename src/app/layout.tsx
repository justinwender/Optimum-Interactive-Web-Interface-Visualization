import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mump2p Dashboard — RLNC vs GossipSub',
  description:
    'Interactive visualization comparing mump2p (Random Linear Network Coding) against GossipSub for peer-to-peer message propagation.',
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

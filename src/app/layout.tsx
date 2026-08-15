import type { Metadata } from 'next';
import { EB_Garamond, Inter } from 'next/font/google';
import './globals.css';

/**
 * Fonts are loaded through next/font so they are self-hosted and produce zero
 * layout shift. See docs/UI.md §2.2.
 *
 * Serif  — headings, event narrative, historical context. Carries period
 *          weight without being a costume.
 * Sans   — UI chrome, labels, and all data. Neutral, strong tabular figures.
 */
const garamond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-garamond',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'The American Experiment',
  description:
    'A real-time grand strategy simulation of governing the United States from its founding.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

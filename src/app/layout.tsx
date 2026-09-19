import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taskinator',
  description: 'Tâches et ménage partagés, par foyer et par conteneur.',
  manifest: '/manifest.json',
};

const THEME_INIT = `
try {
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d9488" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

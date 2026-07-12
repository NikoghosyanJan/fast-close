import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'FastClose AI — AI waiter for restaurants',
  description:
    'AI ordering agent for cafés and restaurants in Armenia. Menu-aware chat in Armenian, Russian, and English — delivery, table QR, and Telegram.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
